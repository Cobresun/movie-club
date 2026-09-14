import { describe, expect, it } from "vitest";

import { episodeCode, formatTvAddress, parseTvAddress, tvLevel } from "../types/tv";

describe("TV addresses", () => {
  it("reads a show, a season and an episode out of one id", () => {
    expect(parseTvAddress("95396")).toEqual({
      showId: "95396",
      seasonNumber: undefined,
      episodeNumber: undefined,
    });
    expect(parseTvAddress("95396:1")).toEqual({
      showId: "95396",
      seasonNumber: 1,
      episodeNumber: undefined,
    });
    expect(parseTvAddress("95396:1:4")).toEqual({
      showId: "95396",
      seasonNumber: 1,
      episodeNumber: 4,
    });
  });

  it("names the level the address reaches", () => {
    expect(tvLevel({ showId: "95396" })).toBe("show");
    expect(tvLevel({ showId: "95396", seasonNumber: 1 })).toBe("season");
    expect(tvLevel({ showId: "95396", seasonNumber: 1, episodeNumber: 4 })).toBe("episode");
  });

  it("round-trips an address through its stored form", () => {
    const address = { showId: "95396", seasonNumber: 1, episodeNumber: 4 };
    expect(parseTvAddress(formatTvAddress(address))).toEqual(address);
  });

  it("keeps season 0 addressable, so specials are not mistaken for a show", () => {
    expect(parseTvAddress("95396:0")).toEqual({
      showId: "95396",
      seasonNumber: 0,
      episodeNumber: undefined,
    });
    expect(tvLevel({ showId: "95396", seasonNumber: 0 })).toBe("season");
  });

  it("reads anything that is not an address as no address at all", () => {
    // A Google Books id, an OpenLibrary key and a malformed address all reach
    // the parser through a mixed reviews list; none may throw.
    expect(parseTvAddress("OL45804W")).toBeUndefined();
    expect(parseTvAddress("95396:one")).toBeUndefined();
    expect(parseTvAddress("95396:1:4:2")).toBeUndefined();
    expect(parseTvAddress("")).toBeUndefined();
    expect(parseTvAddress(null)).toBeUndefined();
    expect(parseTvAddress(undefined)).toBeUndefined();
  });

  it("pads the code a club refers to an episode by", () => {
    expect(episodeCode(1, 4)).toBe("S01E04");
    expect(episodeCode(10, 12)).toBe("S10E12");
  });
});
