import { z } from "zod";

/**
 * A comment stores a GIPHY id, never a URL, and the client builds the address
 * from it, so a comment can only ever show an image GIPHY serves. The pattern
 * keeps an id from carrying a path or query of its own.
 */
export const giphyIdSchema = z.string().regex(/^[A-Za-z0-9]{1,64}$/);

/**
 * `200` is the 200px-tall rendition shown in a comment, `100` the thumbnail
 * the picker lays out.
 */
export const giphyImageUrl = (id: string, height: "100" | "200") =>
  `https://media.giphy.com/media/${id}/${height}.webp`;
