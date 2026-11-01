import {
  ensure,
  filterUndefinedProperties,
  hasElements,
  hasValue,
  isDefined,
  isString,
  isTrue,
  type NonEmptyArray,
} from "../checks";

// The "narrows the type inside the guard" tests let the guard's `asserts`
// signature drive TypeScript's narrowing. The conditionals that provide it are
// declared here (module scope) rather than inside the test bodies.
function guardDefined<T>(value: T | null | undefined): asserts value is T {
  if (!isDefined(value)) {
    throw new Error("Expected value to be defined");
  }
}

function guardHasValue(value: string | null | undefined): asserts value is string {
  if (!hasValue(value)) {
    throw new Error("Expected value to be present");
  }
}

function guardIsString(value: unknown): asserts value is string {
  if (!isString(value)) {
    throw new Error("Expected value to be a string");
  }
}

function guardIsTrue(value: unknown): asserts value is true {
  if (!isTrue(value)) {
    throw new Error("Expected value to be true");
  }
}

function guardHasElements<T>(
  arr: readonly T[] | null | undefined,
): asserts arr is NonEmptyArray<T> {
  if (!hasElements(arr)) {
    throw new Error("Expected array to have elements");
  }
}

// ---------- isDefined ----------

describe("isDefined", () => {
  it("returns true for a string value", () => {
    expect(isDefined("hello")).toBe(true);
  });

  it("returns true for an empty string", () => {
    expect(isDefined("")).toBe(true);
  });

  it("returns true for zero", () => {
    expect(isDefined(0)).toBe(true);
  });

  it("returns true for false", () => {
    expect(isDefined(false)).toBe(true);
  });

  it("returns true for an object", () => {
    expect(isDefined({})).toBe(true);
  });

  it("returns true for an array", () => {
    expect(isDefined([])).toBe(true);
  });

  it("returns false for null", () => {
    expect(isDefined(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isDefined(undefined)).toBe(false);
  });

  it("narrows the type to non-nullable T", () => {
    const value: string | null = "test";
    guardDefined(value);
    // TypeScript should infer value as string here
    expect(value.toUpperCase()).toBe("TEST");
  });
});

// ---------- hasValue ----------

describe("hasValue", () => {
  it("returns true for a non-empty string", () => {
    expect(hasValue("hello")).toBe(true);
  });

  it("returns true for a single space", () => {
    // A space is a non-empty string
    expect(hasValue(" ")).toBe(true);
  });

  it("returns false for an empty string", () => {
    expect(hasValue("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(hasValue(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasValue(undefined)).toBe(false);
  });

  it("returns false for a string of length 0 created via constructor", () => {
    expect(hasValue(String())).toBe(false);
  });

  it("narrows the type to string inside the guard", () => {
    const value: string | undefined = "movie";
    guardHasValue(value);
    expect(value.length).toBeGreaterThan(0);
  });
});

// ---------- isString ----------

describe("isString", () => {
  it("returns true for a string literal", () => {
    expect(isString("hello")).toBe(true);
  });

  it("returns true for an empty string", () => {
    expect(isString("")).toBe(true);
  });

  it("returns false for null", () => {
    expect(isString(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isString(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isString(42)).toBe(false);
  });

  it("returns false for a boolean", () => {
    expect(isString(false)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isString({})).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isString([])).toBe(false);
  });

  it("narrows unknown to string inside the guard", () => {
    const value: unknown = "test";
    guardIsString(value);
    expect(value.toUpperCase()).toBe("TEST");
  });
});

// ---------- isTrue ----------

describe("isTrue", () => {
  it("returns true for the boolean true", () => {
    expect(isTrue(true)).toBe(true);
  });

  it("returns false for the boolean false", () => {
    expect(isTrue(false)).toBe(false);
  });

  it("returns false for 1 (truthy number)", () => {
    expect(isTrue(1)).toBe(false);
  });

  it("returns false for a non-empty string", () => {
    expect(isTrue("true")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTrue(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isTrue(undefined)).toBe(false);
  });

  it("narrows unknown to true inside the guard", () => {
    const value: unknown = true;
    guardIsTrue(value);
    // TypeScript should see value as `true`
    expect(value).toBe(true);
  });
});

// ---------- hasElements ----------

describe("hasElements", () => {
  it("returns true for a non-empty array", () => {
    expect(hasElements([1, 2, 3])).toBe(true);
  });

  it("returns true for a single-element array", () => {
    expect(hasElements(["only"])).toBe(true);
  });

  it("returns false for an empty array", () => {
    expect(hasElements([])).toBe(false);
  });

  it("returns false for null", () => {
    expect(hasElements(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasElements(undefined)).toBe(false);
  });

  it("works with readonly arrays", () => {
    const arr: readonly number[] = [1, 2];
    expect(hasElements(arr)).toBe(true);
  });

  it("works with an empty readonly array", () => {
    const arr: readonly number[] = [];
    expect(hasElements(arr)).toBe(false);
  });

  it("narrows to NonEmptyArray inside the guard", () => {
    const arr: string[] | null = ["a", "b"];
    guardHasElements(arr);
    // The first element is guaranteed to exist by the NonEmptyArray type
    expect(arr[0]).toBe("a");
  });
});

// ---------- ensure ----------

describe("ensure", () => {
  it("returns the value when it is defined", () => {
    expect(ensure("hello")).toBe("hello");
  });

  it("returns zero when value is 0 (falsy but defined)", () => {
    expect(ensure(0)).toBe(0);
  });

  it("returns false when value is false (falsy but defined)", () => {
    expect(ensure(false)).toBe(false);
  });

  it("returns an object when value is an object", () => {
    const obj = { id: 1 };
    expect(ensure(obj)).toBe(obj);
  });

  it("throws TypeError when value is null", () => {
    expect(() => ensure(null)).toThrow(TypeError);
  });

  it("throws TypeError when value is undefined", () => {
    expect(() => {
      ensure(undefined);
    }).toThrow(TypeError);
  });

  it("throws the default message when none provided", () => {
    expect(() => ensure(null)).toThrow("Expected value was null or undefined");
  });

  it("throws a custom message when provided", () => {
    expect(() => {
      ensure(undefined, "Custom error message");
    }).toThrow("Custom error message");
  });

  it("does not throw for an empty string", () => {
    expect(ensure("")).toBe("");
  });

  it("does not throw for an empty array", () => {
    const arr: number[] = [];
    expect(ensure(arr)).toBe(arr);
  });
});

// ---------- filterUndefinedProperties ----------

describe("filterUndefinedProperties", () => {
  it("returns the same key-value pairs when all values are defined", () => {
    expect(filterUndefinedProperties({ a: "1", b: "2" })).toStrictEqual({
      a: "1",
      b: "2",
    });
  });

  it("removes properties with undefined values", () => {
    expect(filterUndefinedProperties({ a: "1", b: undefined })).toStrictEqual({
      a: "1",
    });
  });

  it("returns an empty object when all values are undefined", () => {
    expect(filterUndefinedProperties({ a: undefined, b: undefined })).toStrictEqual({});
  });

  it("returns an empty object for an empty input", () => {
    expect(filterUndefinedProperties({})).toStrictEqual({});
  });

  it("preserves empty string values", () => {
    expect(filterUndefinedProperties({ a: "", b: undefined })).toStrictEqual({
      a: "",
    });
  });

  it("handles a mix of defined and undefined values", () => {
    const input: Record<string, string | undefined> = {
      x: "hello",
      y: undefined,
      z: "world",
    };
    expect(filterUndefinedProperties(input)).toStrictEqual({
      x: "hello",
      z: "world",
    });
  });
});
