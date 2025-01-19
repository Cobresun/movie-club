export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Returns true if the object is not null or undefined
 * @param value
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null;
}

/**
 * Returns true if string is defined and not empty, with type hint
 * @param s
 */
export function hasValue(s: string | undefined | null): s is string {
  return typeof s === "string" && s.length > 0;
}

/**
 * Returns true if the object specified is a string
 * @param s
 */
export function isString(s: unknown): s is string {
  return typeof s === "string";
}

/**
 * Returns true if the object specified is a boolean
 * @param b
 */
export function isTrue(b: unknown): b is true {
  return b === true;
}

/**
 * Return true if the object specified is an array and is not empty.
 * @param arr
 */
export function hasElements<T>(
  arr: ReadonlyArray<T> | null | undefined,
): arr is NonEmptyArray<T> {
  return isDefined(arr) && Array.isArray(arr) && arr.length > 0;
}
