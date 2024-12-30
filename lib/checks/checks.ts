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
