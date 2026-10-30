import { describe, expect, it } from "vitest";

import { findOutOfOrderMigrations, formatOutOfOrderError } from "./check-migration-order";

const onMain = ["20260914_AddTvClubType", "20261019_Rekey", "20261027_AddWorkParent"];

describe("findOutOfOrderMigrations", () => {
  it("passes a branch with no new migrations", () => {
    expect(findOutOfOrderMigrations(onMain, onMain)).toEqual([]);
  });

  it("passes a migration dated after main's newest", () => {
    expect(findOutOfOrderMigrations(onMain, [...onMain, "20261101_AddThing"])).toEqual([]);
  });

  it("passes a same-day migration whose name sorts after main's newest", () => {
    expect(findOutOfOrderMigrations(onMain, [...onMain, "20261027_ZAddThing"])).toEqual([]);
  });

  it("flags a migration dated before main's newest", () => {
    expect(findOutOfOrderMigrations(onMain, [...onMain, "20260914_AddTvDetails"])).toEqual([
      "20260914_AddTvDetails",
    ]);
  });

  it("flags a same-day migration whose name sorts before main's newest", () => {
    expect(findOutOfOrderMigrations(onMain, [...onMain, "20261027_AAddThing"])).toEqual([
      "20261027_AAddThing",
    ]);
  });

  it("flags only the out-of-order file when a branch adds several", () => {
    expect(
      findOutOfOrderMigrations(onMain, [...onMain, "20261101_AddThing", "20261001_AddOther"]),
    ).toEqual(["20261001_AddOther"]);
  });

  it("does not flag a migration only main has, from a branch behind it", () => {
    expect(findOutOfOrderMigrations(onMain, onMain.slice(0, 2))).toEqual([]);
  });

  it("passes everything when main has no migrations", () => {
    expect(findOutOfOrderMigrations([], ["20260914_AddTvDetails"])).toEqual([]);
  });
});

describe("formatOutOfOrderError", () => {
  it("names the file and main's newest, and says to rename to a later date", () => {
    const message = formatOutOfOrderError(["20260914_AddTvDetails"], onMain);

    expect(message).toContain("20260914_AddTvDetails");
    expect(message).toContain("20261027_AddWorkParent");
    expect(message).toContain("Rename the file to a later date");
  });
});
