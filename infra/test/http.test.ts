import { readBody } from "../lambda/shared/http";

describe("readBody", () => {
  it("returns a plain request body as it is", () => {
    expect(readBody({ body: '{"size":"A2"}' })).toBe('{"size":"A2"}');
    expect(readBody({ body: "plain", isBase64Encoded: false })).toBe("plain");
  });

  it("decodes a base64 body as UTF-8", () => {
    const body = Buffer.from('{"name":"Sigur Rós"}', "utf-8").toString("base64");
    expect(readBody({ body, isBase64Encoded: true })).toBe('{"name":"Sigur Rós"}');
  });

  it("reads a missing body as empty text", () => {
    expect(readBody({})).toBe("");
    expect(readBody({ body: null })).toBe("");
    expect(readBody({ isBase64Encoded: true })).toBe("");
  });
});
