import crypto from "crypto";

// Reserved slugs that cannot be used for clubs
const RESERVED_SLUGS = [
  "new",
  "create",
  "join",
  "settings",
  "api",
  "share",
  "admin",
  "invite",
  "clubs",
  "member",
  "auth",
  "login",
  "signup",
  "logout",
  "profile",
];

// Slug constraints
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 50;
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

/**
 * Generate a URL-friendly slug from a club name
 */
export function generateSlugFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .substring(0, SLUG_MAX_LENGTH); // Max length 50

  // Ensure minimum length of 3
  if (slug.length < SLUG_MIN_LENGTH) {
    return `club-${slug}`;
  }

  return slug;
}

/**
 * Generate a unique slug by appending a random suffix
 */
export function generateUniqueSlug(baseSlug: string): string {
  const randomSuffix = crypto.randomBytes(3).toString("hex"); // 6 chars
  const maxBaseLength = SLUG_MAX_LENGTH - randomSuffix.length - 1; // -1 for hyphen
  const truncatedBase = baseSlug.substring(0, maxBaseLength);
  return `${truncatedBase}-${randomSuffix}`;
}

/**
 * Validate slug format according to our rules
 * - 3-50 characters
 * - Lowercase letters, numbers, and hyphens only
 * - Cannot start or end with a hyphen
 */
export function validateSlugFormat(slug: string): boolean {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return false;
  }

  return SLUG_PATTERN.test(slug);
}

/**
 * Check if a slug is reserved
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

/**
 * Validate a slug for use in club creation/update
 * Returns error message if invalid, undefined if valid
 */
export function validateSlug(slug: string): string | undefined {
  if (!validateSlugFormat(slug)) {
    return `URL must be ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} characters, contain only lowercase letters, numbers, and hyphens, and not start or end with a hyphen`;
  }

  if (isReservedSlug(slug)) {
    return `The URL "/${slug}" is reserved and cannot be used`;
  }

  return undefined;
}
