const mockSend = jest.fn();
jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn(() => ({ send: mockSend })),
  GetParameterCommand: jest.fn((input) => ({ input })),
}));

import { cleanArtistName, handler } from "../lambda/discogs-proxy/index";

describe("cleanArtistName", () => {
  it.each([
    ["Travis Scott (2)", "Travis Scott"],
    ["Asia (2)", "Asia"],
    ["Prince (12)", "Prince"],
    ["Daft Punk", "Daft Punk"],
    ["Sunn O)))", "Sunn O)))"],
    ["Blink-182", "Blink-182"],
    ["Mumford (and) Sons", "Mumford (and) Sons"],
    ["10cc (2) Live", "10cc (2) Live"],
  ])("%s -> %s", (input, expected) => {
    expect(cleanArtistName(input)).toBe(expected);
  });
});

describe("artist names in the collection", () => {
  beforeEach(() => {
    process.env.DISCOGS_TOKEN_PARAMETER_NAME = "/album-wall/discogs-token";
    mockSend.mockReset().mockResolvedValue({ Parameter: { Value: "secret-token" } });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("drops the Discogs numbers and joins artists with the separator Discogs puts on the earlier one", async () => {
    const release = (id: number, artists: { name: string; join?: string }[]) => ({
      id,
      basic_information: { id, title: `T${id}`, cover_image: "c.jpg", artists, genres: [] },
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pagination: { pages: 1 },
          releases: [
            release(1, [{ name: "Travis Scott (2)" }]),
            release(2, [
              { name: "Jay-Z", join: "&" },
              { name: "Kanye West (3)", join: "" },
            ]),
            release(3, [{ name: "Tony Bennett", join: "Feat." }, { name: "Amy Winehouse" }]),
            release(4, [
              { name: "Simon (2)", join: "," },
              { name: "Garfunkel", join: "" },
              { name: "Friends" },
            ]),
          ],
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const response = await handler({
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { username: "vinylfan" },
    });

    expect(response.statusCode).toBe(200);
    const { albums } = JSON.parse(response.body);
    expect(albums.map((album: { artist: string }) => album.artist)).toEqual([
      "Travis Scott",
      "Jay-Z & Kanye West",
      "Tony Bennett Feat. Amy Winehouse",
      "Simon, Garfunkel, Friends",
    ]);
  });
});
