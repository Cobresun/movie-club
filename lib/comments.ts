import { z } from "zod";

import { hasValue, isDefined } from "./checks/checks.js";
import { giphyIdSchema } from "./giphy.js";

export const MAX_COMMENT_LENGTH = 2000;

const commentBodySchema = z.object({
  content: z.string().trim().max(MAX_COMMENT_LENGTH),
  gifId: giphyIdSchema.optional(),
});

/** A comment is text, a GIF, or both. */
export const hasTextOrGif = ({ content, gifId }: { content: string; gifId?: string }) =>
  hasValue(content.trim()) || isDefined(gifId);

export const addCommentSchema = commentBodySchema
  .extend({ spoiler: z.boolean().optional().default(false) })
  .refine(hasTextOrGif, "A comment needs text or a GIF");

// A full replacement of the comment's text and GIF: leaving `gifId` out
// removes the GIF. Leaving `spoiler` out keeps the comment's flag.
export const updateCommentSchema = commentBodySchema
  .extend({ spoiler: z.boolean().optional() })
  .refine(hasTextOrGif, "A comment needs text or a GIF");
