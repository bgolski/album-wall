const mockDynamoSend = jest.fn();
const mockSsmSend = jest.fn();
jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
  PutItemCommand: jest.fn((input) => ({ input })),
}));
jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn(() => ({ send: mockSsmSend })),
  GetParameterCommand: jest.fn((input) => ({ input })),
}));

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  ShareInputError,
  parseShareRequest,
  shareId,
  storeSharedWall,
} from "../lambda/discogs-proxy/share";
import { handler } from "../lambda/discogs-proxy/index";

const cover = (n: number) => `https://i.discogs.com/abc/rs:fit/w:600/${n}.jpeg`;
const valid = {
  payload: "AgQIB2JnBG9sc2tp",
  app: "https://bradleygolski.com/album-wall/?x=1#share=old",
  title: "bgolski's Album Wall",
  rows: 4,
  columns: 8,
  covers: Array.from({ length: 32 }, (_, n) => cover(n)),
};
const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ ...valid, ...overrides });

beforeEach(() => {
  mockDynamoSend.mockReset().mockResolvedValue({});
  mockSsmSend.mockReset().mockResolvedValue({ Parameter: { Value: "d111.cloudfront.net" } });
  jest.spyOn(console, "error").mockImplementation(() => {});
  process.env.SHARE_TABLE_NAME = "walls";
  process.env.SHARE_DOMAIN_PARAMETER_NAME = "/album-wall/share-domain";
});

describe("parseShareRequest", () => {
  it("keeps the app address without its query or fragment", () => {
    expect(parseShareRequest(body()).app).toBe("https://bradleygolski.com/album-wall/");
  });

  it("accepts the home preview and refuses other sites", () => {
    expect(
      parseShareRequest(body({ app: "https://albumwall.home.bradleygolski.com/album-wall/" })).app
    ).toBe("https://albumwall.home.bradleygolski.com/album-wall/");
    expect(() => parseShareRequest(body({ app: "https://evil.example/album-wall/" }))).toThrow(
      ShareInputError
    );
  });

  it("blanks covers from hosts it will not fetch, and keeps the rest in order", () => {
    const covers = [cover(1), "https://evil.example/x.jpg", "http://i.discogs.com/x.jpg", 7];
    expect(parseShareRequest(body({ covers })).covers).toEqual([cover(1), "", "", ""]);
    expect(
      parseShareRequest(body({ covers: ["https://ia800.us.archive.org/1/a.jpg"] })).covers
    ).toEqual(["https://ia800.us.archive.org/1/a.jpg"]);
  });

  it("keeps no more covers than the wall has places", () => {
    expect(parseShareRequest(body({ rows: 1, columns: 2 })).covers).toHaveLength(2);
  });

  it.each([
    ["not JSON", "{"],
    ["a missing wall", body({ payload: "" })],
    ["a wall with characters a link cannot carry", body({ payload: "a+b/c=" })],
    ["a wall that is too long", body({ payload: "a".repeat(2049) })],
    ["a wall size that is not a whole number", body({ rows: 2.5 })],
    ["a wall that is too big", body({ columns: 21 })],
    ["a request that is too large", body({ title: "x".repeat(40_000) })],
  ])("refuses %s", (_, text) => {
    expect(() => parseShareRequest(text)).toThrow(ShareInputError);
  });

  it("names the wall Album Wall when no title is given and shortens long titles", () => {
    expect(parseShareRequest(body({ title: "  " })).title).toBe("Album Wall");
    expect(parseShareRequest(body({ title: "x".repeat(200) })).title).toHaveLength(80);
  });
});

describe("shareId", () => {
  it("is eight letters and digits, the same for the same wall and different for another", () => {
    const first = shareId(parseShareRequest(body()));
    expect(first).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(shareId(parseShareRequest(body()))).toBe(first);
    expect(shareId(parseShareRequest(body({ payload: "AgQIB2JnBG9sc2tq" })))).not.toBe(first);
  });
});

describe("storeSharedWall", () => {
  it("stores the wall with an expiry a year away", async () => {
    const request = parseShareRequest(body());
    const id = await storeSharedWall(new DynamoDBClient({}), "walls", request, 1_000_000_000);
    const { input } = mockDynamoSend.mock.calls[0]![0] as {
      input: { Item: Record<string, { S?: string; N?: string }>; TableName: string };
    };
    expect(input.TableName).toBe("walls");
    expect(input.Item.id!.S).toBe(id);
    expect(input.Item.payload!.S).toBe(valid.payload);
    expect(JSON.parse(input.Item.covers!.S!)).toHaveLength(32);
    expect(Number(input.Item.expires!.N)).toBe(1_000_000 + 365 * 24 * 60 * 60);
  });
});

describe("POST /share", () => {
  const event = (text: string, path = "/share") =>
    ({ rawPath: path, body: text, requestContext: { http: { method: "POST" } } }) as Parameters<
      typeof handler
    >[0];

  it("answers with the short link on the CloudFront domain", async () => {
    const response = await handler(event(body()));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).url).toMatch(
      /^https:\/\/d111\.cloudfront\.net\/w\/[A-Za-z0-9]{8}$/
    );
  });

  it("accepts a body sent base64-encoded", async () => {
    const response = await handler({
      ...event(Buffer.from(body()).toString("base64")),
      isBase64Encoded: true,
    });
    expect(response.statusCode).toBe(200);
  });

  it("answers 400 for a bad request and 503 when storing fails", async () => {
    expect((await handler(event(body({ app: "https://evil.example/" })))).statusCode).toBe(400);
    mockDynamoSend.mockRejectedValueOnce(new Error("throttled"));
    expect((await handler(event(body()))).statusCode).toBe(503);
  });

  it("answers 404 where short links are not set up", async () => {
    delete process.env.SHARE_TABLE_NAME;
    expect((await handler(event(body()))).statusCode).toBe(404);
  });

  it("still refuses other POST requests", async () => {
    expect((await handler(event(body(), "/"))).statusCode).toBe(405);
  });
});
