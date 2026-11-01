import { createHash } from "node:crypto";
import {
  type AttributeValue,
  BatchWriteItemCommand,
  type BatchWriteItemCommandOutput,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";

// What a signed-in visitor keeps in their account: a collection's saved layouts and its wall
// history, each as the same JSON text the browser keeps in local storage. The server only checks
// it is JSON; the browser checks the contents when it loads them.
const SAVED_KINDS = ["layouts", "history"] as const;
export type SavedKind = (typeof SAVED_KINDS)[number];
// The browser keeps at most 20 layouts and 50 walls of history per collection; both fit easily.
const MAX_DATA_BYTES = 64_000;
const MAX_BODY_BYTES = 70_000;
// How long a checked sign-in is trusted before Discogs is asked again who it belongs to.
const IDENTITY_TTL_MS = 10 * 60 * 1000;
const COLLECTION = /^~?[a-z0-9._-]{1,100}$/;

export class SavedInputError extends Error {}

export type SavedEntry = { data: string; updatedAt: string };
export type SavedRequest = { collection: string; kind: SavedKind; data: string };

/**
 * A collection name as the browser keys it (trimmed, lower case); `~demo` for the demo wall.
 *
 * @returns The name, or `null` when it is not one.
 */
export function collectionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().toLowerCase();
  return COLLECTION.test(name) ? name : null;
}

/**
 * Checks a save request: a known kind, a collection name and JSON text.
 *
 * @throws SavedInputError when it is not one.
 */
export function parseSavedRequest(body: string): SavedRequest {
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new SavedInputError("Too much to save.");
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new SavedInputError("Request is not JSON.");
  }
  const collection = collectionName(input.collection);
  if (!collection) throw new SavedInputError("Missing or invalid collection.");
  const kind = input.kind;
  if (typeof kind !== "string" || !SAVED_KINDS.includes(kind as SavedKind)) {
    throw new SavedInputError("Unknown kind.");
  }
  const data = input.data;
  if (typeof data !== "string" || Buffer.byteLength(data) > MAX_DATA_BYTES) {
    throw new SavedInputError("Missing or too large data.");
  }
  try {
    const value: unknown = JSON.parse(data);
    if (typeof value !== "object" || value === null) throw new Error();
  } catch {
    throw new SavedInputError("Data is not JSON.");
  }
  return { collection, kind: kind as SavedKind, data };
}

const itemKey = (user: string, kind: SavedKind, collection: string) => ({
  user: { S: user.toLowerCase() },
  item: { S: `${kind}#${collection}` },
});

/**
 * Reads a collection's layouts and history for a user.
 *
 * @returns Each kind's text and when it was saved, or `null` when nothing is saved.
 */
export async function loadSaved(
  client: DynamoDBClient,
  table: string,
  user: string,
  collection: string
): Promise<Record<SavedKind, SavedEntry | null>> {
  const entries = await Promise.all(
    SAVED_KINDS.map(async (kind) => {
      const { Item } = await client.send(
        new GetItemCommand({ TableName: table, Key: itemKey(user, kind, collection) })
      );
      return Item?.data?.S && Item.updatedAt?.S
        ? { data: Item.data.S, updatedAt: Item.updatedAt.S }
        : null;
    })
  );
  return { layouts: entries[0]!, history: entries[1]! };
}

/**
 * Saves one kind for a collection, replacing what was there.
 *
 * @returns When it was saved.
 */
export async function storeSaved(
  client: DynamoDBClient,
  table: string,
  user: string,
  request: SavedRequest,
  now = new Date()
): Promise<string> {
  const updatedAt = now.toISOString();
  await client.send(
    new PutItemCommand({
      TableName: table,
      Item: {
        ...itemKey(user, request.kind, request.collection),
        data: { S: request.data },
        updatedAt: { S: updatedAt },
      },
    })
  );
  return updatedAt;
}

/**
 * Deletes everything a user has saved.
 *
 * @returns How many items were deleted.
 */
export async function deleteAllSaved(
  client: DynamoDBClient,
  table: string,
  user: string
): Promise<number> {
  let deleted = 0;
  let start: Record<string, AttributeValue> | undefined;
  do {
    const page = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "#u = :u",
        ExpressionAttributeNames: { "#u": "user" },
        ExpressionAttributeValues: { ":u": { S: user.toLowerCase() } },
        ProjectionExpression: "#u, item",
        ExclusiveStartKey: start,
      })
    );
    const keys: Record<string, AttributeValue>[] = (page.Items ?? []).map((item) => ({
      user: item.user!,
      item: item.item!,
    }));
    for (let at = 0; at < keys.length; at += 25) {
      let pending = keys.slice(at, at + 25);
      for (let attempt = 0; pending.length > 0 && attempt < 5; attempt++) {
        const result: BatchWriteItemCommandOutput = await client.send(
          new BatchWriteItemCommand({
            RequestItems: { [table]: pending.map((Key) => ({ DeleteRequest: { Key } })) },
          })
        );
        const left: WriteRequest[] = result.UnprocessedItems?.[table] ?? [];
        deleted += pending.length - left.length;
        pending = left.map((request) => request.DeleteRequest!.Key!);
      }
    }
    start = page.LastEvaluatedKey;
  } while (start);
  return deleted;
}

/**
 * Remembers whose a sign-in is for a few minutes in this warm function, so saving does not ask
 * Discogs every time. Only a hash of the key is kept, never the key.
 */
export class IdentityCache {
  private entries = new Map<string, { user: string; until: number }>();

  constructor(private readonly lookup: (token: string, secret: string) => Promise<string>) {}

  async userFor(token: string, secret: string, now = Date.now()): Promise<string> {
    const id = createHash("sha256").update(`${token}:${secret}`).digest("hex");
    const known = this.entries.get(id);
    if (known && known.until > now) return known.user;
    const user = await this.lookup(token, secret);
    if (this.entries.size > 500) this.entries.clear();
    this.entries.set(id, { user, until: now + IDENTITY_TTL_MS });
    return user;
  }
}
