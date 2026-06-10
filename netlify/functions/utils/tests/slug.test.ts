import { describe, expect, it } from "vitest";

import {
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
  generateSlugFromName,
  generateUniqueSlug,
  isReservedSlug,
  validateSlug,
  validateSlugFormat,
} from "../slug";

// ---------- constants ----------

describe("SLUG_MIN_LENGTH / SLUG_MAX_LENGTH", () => {
  it("min length is 3", () => {
    expect(SLUG_MIN_LENGTH).toBe(3);
  });

  it("max length is 50", () => {
    expect(SLUG_MAX_LENGTH).toBe(50);
  });
});

describe("SLUG_PATTERN", () => {
  it("accepts a valid slug", () => {
    expect(SLUG_PATTERN.test("my-club")).toBe(true);
  });

  it("requires the string to start with alphanumeric", () => {
    expect(SLUG_PATTERN.test("-bad")).toBe(false);
  });

  it("requires the string to end with alphanumeric", () => {
    expect(SLUG_PATTERN.test("bad-")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(SLUG_PATTERN.test("MyClub")).toBe(false);
  });
});

// ---------- generateSlugFromName ----------

describe("generateSlugFromName", () => {
  it("lowercases the name", () => {
    expect(generateSlugFromName("MyClub")).toBe("myclub");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlugFromName("my club")).toBe("my-club");
  });

  it("collapses multiple consecutive spaces into one hyphen", () => {
    expect(generateSlugFromName("my  club")).toBe("my-club");
  });

  it("removes special characters", () => {
    expect(generateSlugFromName("my!@#club")).toBe("myclub");
  });

  it("removes leading and trailing hyphens", () => {
    expect(generateSlugFromName("  my club  ")).toBe("my-club");
  });

  it("collapses multiple hyphens into one", () => {
    expect(generateSlugFromName("my--club")).toBe("my-club");
  });

  it("truncates names longer than 50 characters", () => {
    const longName = "a".repeat(60);
    expect(generateSlugFromName(longName).length).toBeLessThanOrEqual(
      SLUG_MAX_LENGTH,
    );
  });

  it("prepends 'club-' when the resulting slug is shorter than 3 characters", () => {
    // Single character name
    expect(generateSlugFromName("ab")).toBe("club-ab");
  });

  it("handles a name that reduces to less than 3 chars after cleaning", () => {
    // Only special chars + 1 letter
    expect(generateSlugFromName("!a!")).toBe("club-a");
  });

  it("handles a normal slug without modification", () => {
    expect(generateSlugFromName("film-buffs")).toBe("film-buffs");
  });

  it("removes non-ASCII characters", () => {
    // Accented characters should be stripped
    const result = generateSlugFromName("café");
    expect(result).toBe("caf");
  });
});

// ---------- generateUniqueSlug ----------

describe("generateUniqueSlug", () => {
  it("appends a 6-character hex suffix separated by hyphen", () => {
    const result = generateUniqueSlug("my-club");
    // pattern: base-XXXXXX where X is hex
    expect(result).toMatch(/^my-club-[0-9a-f]{6}$/);
  });

  it("truncates the base slug so total length stays at or below 50", () => {
    const longBase = "a".repeat(50);
    const result = generateUniqueSlug(longBase);
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });

  it("produces different slugs on successive calls (randomness)", () => {
    const first = generateUniqueSlug("club");
    const second = generateUniqueSlug("club");
    // Probabilistically, two random 6-char hex strings differ
    // (1/16^6 ≈ 0.0000015% chance of collision — acceptable for a test)
    expect(first).not.toBe(second);
  });
});

// ---------- validateSlugFormat ----------

describe("validateSlugFormat", () => {
  it("accepts a valid slug", () => {
    expect(validateSlugFormat("my-club")).toBe(true);
  });

  it("accepts a slug with numbers", () => {
    expect(validateSlugFormat("club123")).toBe(true);
  });

  it("accepts a slug at minimum length (3)", () => {
    // "a0a" — starts and ends with alphanumeric, 3 chars
    expect(validateSlugFormat("a0a")).toBe(true);
  });

  it("rejects a slug shorter than 3 characters", () => {
    expect(validateSlugFormat("ab")).toBe(false);
  });

  it("rejects a slug longer than 50 characters", () => {
    expect(validateSlugFormat("a".repeat(51))).toBe(false);
  });

  it("rejects a slug that starts with a hyphen", () => {
    expect(validateSlugFormat("-my-club")).toBe(false);
  });

  it("rejects a slug that ends with a hyphen", () => {
    expect(validateSlugFormat("my-club-")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(validateSlugFormat("MyClub")).toBe(false);
  });

  it("rejects a slug with spaces", () => {
    expect(validateSlugFormat("my club")).toBe(false);
  });

  it("rejects a slug with underscores", () => {
    expect(validateSlugFormat("my_club")).toBe(false);
  });

  it("accepts a 50-character slug", () => {
    // 50 chars: starts with 'a', ends with 'a', all alphanumeric in between
    const slug = "a" + "b".repeat(48) + "a";
    expect(validateSlugFormat(slug)).toBe(true);
  });
});

// ---------- isReservedSlug ----------

describe("isReservedSlug", () => {
  it("identifies 'new' as reserved", () => {
    expect(isReservedSlug("new")).toBe(true);
  });

  it("identifies 'join' as reserved", () => {
    expect(isReservedSlug("join")).toBe(true);
  });

  it("identifies 'api' as reserved", () => {
    expect(isReservedSlug("api")).toBe(true);
  });

  it("identifies 'auth' as reserved", () => {
    expect(isReservedSlug("auth")).toBe(true);
  });

  it("identifies 'login' as reserved", () => {
    expect(isReservedSlug("login")).toBe(true);
  });

  it("identifies 'profile' as reserved", () => {
    expect(isReservedSlug("profile")).toBe(true);
  });

  it("is case-insensitive — 'NEW' is reserved", () => {
    expect(isReservedSlug("NEW")).toBe(true);
  });

  it("returns false for an arbitrary non-reserved slug", () => {
    expect(isReservedSlug("my-film-club")).toBe(false);
  });
});

// ---------- validateSlug ----------

describe("validateSlug", () => {
  it("returns undefined for a valid, non-reserved slug", () => {
    expect(validateSlug("film-buffs")).toBeUndefined();
  });

  it("returns an error message for an invalid format (too short)", () => {
    const result = validateSlug("ab");
    expect(typeof result).toBe("string");
    expect(result).toContain("3");
  });

  it("returns an error message for a slug starting with a hyphen", () => {
    const result = validateSlug("-bad-slug");
    expect(typeof result).toBe("string");
  });

  it("returns an error message for a reserved slug", () => {
    const result = validateSlug("new");
    expect(typeof result).toBe("string");
    expect(result).toContain("/new");
  });

  it("returns an error message when the slug is too long", () => {
    const result = validateSlug("a".repeat(51));
    expect(typeof result).toBe("string");
  });

  it("returns an error message for a slug with uppercase letters", () => {
    const result = validateSlug("MyClub-here");
    expect(typeof result).toBe("string");
  });
});
