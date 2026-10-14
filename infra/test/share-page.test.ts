const mockDynamoSend = jest.fn();
const mockSsmSend = jest.fn();
jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
  GetItemCommand: jest.fn((input) => ({ input })),
}));
jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn(() => ({ send: mockSsmSend })),
  GetParameterCommand: jest.fn((input) => ({ input })),
}));

import sharp from "sharp";
import { drawWallImage, handler, layoutWall, previewPage } from "../lambda/share-page/index";

const item = {
  id: { S: "AbCd1234" },
  payload: { S: "AgQIB2JnBG9sc2tp" },
  app: { S: "https://bradleygolski.com/album-wall/" },
  title: { S: "bgolski's <Album> Wall" },
  rows: { N: "1" },
  columns: { N: "2" },
  covers: { S: JSON.stringify(["https://i.discogs.com/a.jpg", ""]) },
};
const event = (path: string, userAgent = "Mozilla/5.0 (iPhone) Safari") => ({
  rawPath: path,
  headers: { "user-agent": userAgent },
});

beforeEach(() => {
  mockDynamoSend.mockReset().mockResolvedValue({ Item: item });
  mockSsmSend.mockReset().mockResolvedValue({ Parameter: { Value: "d111.cloudfront.net" } });
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
});

describe("share page", () => {
  it("sends a person straight to the app with the wall in the address", async () => {
    const response = await handler(event("/w/AbCd1234"));
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "https://bradleygolski.com/album-wall/#share=AgQIB2JnBG9sc2tp"
    );
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it.each([
    "facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0",
    "WhatsApp/2.23",
    "Mozilla/5.0 (compatible; Discordbot/2.0)",
  ])("gives the preview fetcher %s a page with the wall's picture", async (userAgent) => {
    const response = await handler(event("/w/AbCd1234", userAgent));
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(
      '<meta property="og:image" content="https://d111.cloudfront.net/w/AbCd1234.jpg">'
    );
  });

  it("escapes the title in the page", () => {
    const html = previewPage(
      {
        payload: "x",
        app: "https://bradleygolski.com/album-wall/",
        title: 'a"<b>',
        rows: 1,
        columns: 1,
        covers: [],
      },
      "https://d1/w/x"
    );
    expect(html).toContain("a&quot;&lt;b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("sends an unknown or malformed link to the app", async () => {
    mockDynamoSend.mockResolvedValue({});
    expect((await handler(event("/w/Zzzzzzzz"))).headers.location).toBe(
      "https://bradleygolski.com/album-wall/"
    );
    expect((await handler(event("/w/../etc"))).headers.location).toBe(
      "https://bradleygolski.com/album-wall/"
    );
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
  });

  it("serves the wall's picture as a JPEG cached for a year", async () => {
    const response = await handler(event("/w/AbCd1234.jpg"));
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/jpeg");
    expect(response.headers["cache-control"]).toContain("immutable");
    expect(response.isBase64Encoded).toBe(true);
    const meta = await sharp(Buffer.from(response.body!, "base64")).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 630]);
  });
});

describe("drawWallImage", () => {
  it("draws each cover in its place and a plain tile where one is missing", async () => {
    const red = await sharp({
      create: { width: 600, height: 600, channels: 3, background: "#ff0000" },
    })
      .jpeg()
      .toBuffer();
    const image = await drawWallImage(
      { rows: 1, columns: 2, covers: ["red", "missing"] },
      async (url) => (url === "red" ? red : null)
    );
    const { size, left, top, gap } = layoutWall(1, 2);
    const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number): [number, number, number] => {
      const at = (y * info.width + x) * info.channels;
      return [data[at]!, data[at + 1]!, data[at + 2]!];
    };
    const middle = top + Math.floor(size / 2);
    const [r, g, b] = pixel(left + Math.floor(size / 2), middle);
    expect(r).toBeGreaterThan(200);
    expect(g + b).toBeLessThan(60);
    const [pr, pg, pb] = pixel(left + size + gap + Math.floor(size / 2), middle);
    expect(Math.abs(pr - 0x1f) + Math.abs(pg - 0x29) + Math.abs(pb - 0x37)).toBeLessThan(12);
  });

  it("fits an 8 x 4 wall inside the picture with room around it", () => {
    const { size, gap, left, top } = layoutWall(4, 8);
    expect(left).toBeGreaterThanOrEqual(40);
    expect(top).toBeGreaterThanOrEqual(40);
    expect(left + 8 * size + 7 * gap).toBeLessThanOrEqual(1160);
    expect(size).toBeGreaterThan(120);
  });
});
