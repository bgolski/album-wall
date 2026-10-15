const mockDynamoSend = jest.fn();
const mockSsmSend = jest.fn();
jest.mock("@aws-sdk/client-dynamodb", () => {
  const command = (name: string) => jest.fn((input) => ({ name, input }));
  return {
    DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
    GetItemCommand: command("Get"),
    PutItemCommand: command("Put"),
    QueryCommand: command("Query"),
    BatchWriteItemCommand: command("BatchWrite"),
  };
});
jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn(() => ({ send: mockSsmSend })),
  GetParameterCommand: jest.fn((input) => ({ input })),
}));

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  IdentityCache,
  SavedInputError,
  collectionName,
  deleteAllSaved,
  loadSaved,
  parseSavedRequest,
  storeSaved,
} from "../lambda/discogs-proxy/saved";

type Handler = typeof import("../lambda/discogs-proxy/index").handler;
// The commands carry nested DynamoDB values; the tests read them loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sent = { name: string; input: Record<string, any> };
const sent = () => mockDynamoSend.mock.calls.map((call) => call[0] as Sent);

// A fresh module per test, so the identity cache starts empty.
function loadHandler(): Handler {
  let handler!: Handler;
  jest.isolateModules(() => {
    handler = (jest.requireActual("../lambda/discogs-proxy/index") as { handler: Handler }).handler;
  });
  return handler;
}

const layouts = JSON.stringify({
  v: 1,
  layouts: [{ v: 1, id: "a", name: "Spring", savedAt: "2026-10-15T08:00:00.000Z", wall: {} }],
});
const request = (
  method: string,
  path: string,
  options: { body?: unknown; query?: Record<string, string>; auth?: string | null } = {}
) =>
  ({
    rawPath: path,
    requestContext: { http: { method } },
    queryStringParameters: options.query ?? null,
    headers: options.auth === null ? {} : { authorization: options.auth ?? "Bearer tok:sec" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }) as unknown as Parameters<Handler>[0];
const bodyOf = (response: { body?: string }) => JSON.parse(response.body ?? "null");
let identityUser = "Bgolski";

beforeEach(() => {
  identityUser = "Bgolski";
  mockDynamoSend.mockReset().mockResolvedValue({});
  mockSsmSend.mockReset().mockResolvedValue({ Parameter: { Value: "consumer-value" } });
  process.env.SAVED_TABLE_NAME = "saved";
  process.env.DISCOGS_CONSUMER_KEY_PARAMETER_NAME = "/k";
  process.env.DISCOGS_CONSUMER_SECRET_PARAMETER_NAME = "/s";
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).endsWith("/oauth/identity")) {
      return new Response(JSON.stringify({ username: identityUser }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as unknown as typeof fetch;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("parseSavedRequest", () => {
  it("accepts a collection, a kind and a JSON list", () => {
    expect(
      parseSavedRequest(JSON.stringify({ collection: " Bgolski ", kind: "layouts", data: layouts }))
    ).toEqual({
      collection: "bgolski",
      kind: "layouts",
      data: layouts,
    });
    expect(collectionName("~demo")).toBe("~demo");
  });

  it.each([
    ["not JSON", "{"],
    ["an unknown kind", JSON.stringify({ collection: "a", kind: "secrets", data: "[]" })],
    ["a bad collection name", JSON.stringify({ collection: "a/b", kind: "layouts", data: "[]" })],
    ["data that is not JSON", JSON.stringify({ collection: "a", kind: "layouts", data: "{" })],
    ["data that is a bare value", JSON.stringify({ collection: "a", kind: "layouts", data: "3" })],
    [
      "data that is too large",
      JSON.stringify({
        collection: "a",
        kind: "layouts",
        data: JSON.stringify(["x".repeat(65_000)]),
      }),
    ],
  ])("refuses %s", (_, text) => {
    expect(() => parseSavedRequest(text)).toThrow(SavedInputError);
  });
});

describe("saved walls in DynamoDB", () => {
  const client = new DynamoDBClient({});

  it("keys each item by account (lower case), kind and collection", async () => {
    const at = await storeSaved(
      client,
      "saved",
      "Bgolski",
      { collection: "bgolski", kind: "layouts", data: layouts },
      new Date("2026-10-15T09:00:00Z")
    );
    expect(at).toBe("2026-10-15T09:00:00.000Z");
    expect(sent()[0]).toMatchObject({
      name: "Put",
      input: {
        TableName: "saved",
        Item: { user: { S: "bgolski" }, item: { S: "layouts#bgolski" }, data: { S: layouts } },
      },
    });
  });

  it("stores wall history, which is kept as an object", async () => {
    const history = JSON.stringify({ v: 1, hangs: [] });
    await storeSaved(client, "saved", "bgolski", {
      collection: "bgolski",
      kind: "history",
      data: history,
    });
    expect(sent()[0]).toMatchObject({
      name: "Put",
      input: { Item: { item: { S: "history#bgolski" }, data: { S: history } } },
    });
  });

  it("reads both kinds, null where nothing is saved", async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ Item: { data: { S: layouts }, updatedAt: { S: "t1" } } })
      .mockResolvedValueOnce({});
    expect(await loadSaved(client, "saved", "bgolski", "bgolski")).toEqual({
      layouts: { data: layouts, updatedAt: "t1" },
      history: null,
    });
  });

  it("deletes every item of an account, 25 at a time, retrying unprocessed ones", async () => {
    const items = Array.from({ length: 30 }, (_, n) => ({
      user: { S: "bgolski" },
      item: { S: `layouts#c${n}` },
    }));
    mockDynamoSend.mockImplementation(async (command: Sent) => {
      if (command.name === "Query") return { Items: items };
      const batch = command.input.RequestItems.saved;
      // The first batch leaves one item for a retry.
      if (
        batch.length === 25 &&
        !mockDynamoSend.mock.calls.some(
          (c) => (c[0] as Sent).input.RequestItems?.saved?.length === 1
        )
      ) {
        return { UnprocessedItems: { saved: [batch[0]] } };
      }
      return {};
    });
    expect(await deleteAllSaved(client, "saved", "Bgolski")).toBe(30);
    expect(sent()[0]!.input.ExpressionAttributeValues).toEqual({ ":u": { S: "bgolski" } });
  });
});

describe("IdentityCache", () => {
  it("asks Discogs once per sign-in for ten minutes and keeps only a hash", async () => {
    const lookup = jest.fn().mockResolvedValue("bgolski");
    const cache = new IdentityCache(lookup);
    await cache.userFor("tok", "sec", 0);
    await cache.userFor("tok", "sec", 9 * 60 * 1000);
    expect(lookup).toHaveBeenCalledTimes(1);
    await cache.userFor("tok", "sec", 11 * 60 * 1000);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(
      JSON.stringify([...(cache as unknown as { entries: Map<string, unknown> }).entries.keys()])
    ).not.toContain("tok");
  });
});

describe("/saved routes", () => {
  it("refuses requests without a sign-in", async () => {
    const response = await loadHandler()(
      request("GET", "/saved", { query: { collection: "bgolski" }, auth: null })
    );
    expect(response.statusCode).toBe(401);
    expect(mockDynamoSend).not.toHaveBeenCalled();
  });

  it("reads the signed-in account's walls, whatever username the request names", async () => {
    mockDynamoSend.mockResolvedValue({});
    const response = await loadHandler()(
      request("GET", "/saved", { query: { collection: "someone-else", username: "someone-else" } })
    );
    expect(response.statusCode).toBe(200);
    expect(sent().every((command) => command.input.Key.user.S === "bgolski")).toBe(true);
    expect(sent()[0]!.input.Key.item.S).toBe("layouts#someone-else");
  });

  it("saves under the account the token belongs to, not one named in the body", async () => {
    identityUser = "Alice";
    const response = await loadHandler()(
      request("POST", "/saved", {
        body: { collection: "bgolski", kind: "layouts", data: layouts, user: "bgolski" },
      })
    );
    expect(response.statusCode).toBe(200);
    expect(sent()[0]!.input.Item.user.S).toBe("alice");
  });

  it("deletes everything for the signed-in account", async () => {
    mockDynamoSend.mockImplementation(async (command: Sent) =>
      command.name === "Query" ? { Items: [] } : {}
    );
    const response = await loadHandler()(request("POST", "/saved/delete"));
    expect(bodyOf(response)).toEqual({ deleted: 0 });
    expect(sent()[0]!.input.ExpressionAttributeValues[":u"].S).toBe("bgolski");
  });

  it("answers 400 for a bad save, 401 when Discogs rejects the sign-in, 503 when storage fails", async () => {
    const handler = loadHandler();
    expect(
      (
        await handler(
          request("POST", "/saved", { body: { collection: "a", kind: "x", data: "[]" } })
        )
      ).statusCode
    ).toBe(400);
    mockDynamoSend.mockRejectedValueOnce(new Error("throttled"));
    expect(
      (
        await handler(
          request("POST", "/saved", { body: { collection: "a", kind: "layouts", data: layouts } })
        )
      ).statusCode
    ).toBe(503);
    global.fetch = jest.fn(
      async () => new Response("{}", { status: 401 })
    ) as unknown as typeof fetch;
    expect(
      (await loadHandler()(request("GET", "/saved", { query: { collection: "a" } }))).statusCode
    ).toBe(401);
  });

  it("answers 404 where saved walls are not set up", async () => {
    delete process.env.SAVED_TABLE_NAME;
    expect(
      (await loadHandler()(request("GET", "/saved", { query: { collection: "a" } }))).statusCode
    ).toBe(404);
  });
});
