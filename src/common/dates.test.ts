import {
  dateInputValueToIso,
  formatIsoDate,
  parseIsoDate,
  relativeTime,
  toDateInputValue,
  utcYear,
} from "./dates";

// The suite pins TZ=UTC (vite.config.ts). The zone-sensitive cases move the
// clock themselves, which Node picks up when TZ is reassigned.
function inTimeZone<T>(timeZone: string, run: () => T): T {
  const original = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return run();
  } finally {
    process.env.TZ = original;
  }
}

describe("formatIsoDate", () => {
  it("formats a timestamp at each length", () => {
    expect(formatIsoDate("2024-01-05T15:30:00.000Z", "short")).toBe("1/5/2024");
    expect(formatIsoDate("2024-01-05T15:30:00.000Z", "medium")).toBe("Jan 5, 2024");
    expect(formatIsoDate("2024-01-05T15:30:00.000Z", "full")).toBe("January 5, 2024");
  });

  it("shows a timestamp on the reader's own calendar day", () => {
    inTimeZone("America/Los_Angeles", () => {
      expect(formatIsoDate("2024-01-05T03:00:00.000Z", "medium")).toBe("Jan 4, 2024");
    });
  });

  it("keeps a bare calendar date on that day west of Greenwich", () => {
    inTimeZone("America/Los_Angeles", () => {
      expect(formatIsoDate("2024-05-01", "medium")).toBe("May 1, 2024");
    });
  });

  it("reads a UTC calendar day the same in every timezone", () => {
    inTimeZone("America/Los_Angeles", () => {
      expect(formatIsoDate("2022-02-18", "medium", "utc")).toBe("Feb 18, 2022");
      expect(formatIsoDate("2022-02-18T00:00:00.000Z", "medium", "utc")).toBe("Feb 18, 2022");
    });
  });

  it("gives nothing for a string that is not a date", () => {
    expect(formatIsoDate("not a date", "medium")).toBeUndefined();
  });
});

describe("utcYear", () => {
  it("reads the year on the UTC clock, not the reader's", () => {
    inTimeZone("America/Los_Angeles", () => {
      expect(utcYear("2025-01-01T02:00:00.000Z")).toBe(2025);
    });
  });
});

describe("date input values", () => {
  it("writes a date as the local day an input shows", () => {
    inTimeZone("America/Los_Angeles", () => {
      expect(toDateInputValue(parseIsoDate("2024-01-05T03:00:00.000Z"))).toBe("2024-01-04");
    });
  });

  it("reads an input's day back as the start of that local day", () => {
    inTimeZone("America/Los_Angeles", () => {
      expect(dateInputValueToIso("2024-01-04")).toBe("2024-01-04T08:00:00.000Z");
    });
  });

  it("gives nothing for an empty or malformed input", () => {
    expect(dateInputValueToIso("")).toBeUndefined();
    expect(dateInputValueToIso("2024-13-45")).toBeUndefined();
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("uses the largest unit that has fully elapsed", () => {
    expect(relativeTime("2026-07-30T11:59:40Z", now)).toBe("20 seconds ago");
    expect(relativeTime("2026-07-30T11:56:00Z", now)).toBe("4 minutes ago");
    expect(relativeTime("2026-07-30T09:00:00Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-07-28T12:00:00Z", now)).toBe("2 days ago");
    expect(relativeTime("2026-04-30T12:00:00Z", now)).toBe("3 months ago");
    expect(relativeTime("2024-07-30T12:00:00Z", now)).toBe("2 years ago");
  });

  it("counts a unit only once all of it has passed", () => {
    expect(relativeTime("2026-07-29T12:00:01Z", now)).toBe("23 hours ago");
    expect(relativeTime("2026-06-30T12:00:01Z", now)).toBe("29 days ago");
  });

  it("measures a month by the calendar, to the last day of a shorter month", () => {
    expect(relativeTime("2024-01-31T12:00:00Z", new Date("2024-02-29T12:00:00Z"))).toBe(
      "1 month ago",
    );
  });

  it("describes a time still to come", () => {
    expect(relativeTime("2026-07-30T14:00:00Z", now)).toBe("in 2 hours");
  });

  it("gives nothing for a string that is not a date", () => {
    expect(relativeTime("not a date", now)).toBeUndefined();
  });
});
