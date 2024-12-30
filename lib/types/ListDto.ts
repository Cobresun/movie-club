import { z } from "zod";

import { WorkType } from "./generated/db.js";

export const listInsertDtoSchema = z.object({
  type: z.nativeEnum(WorkType),
  title: z.string(),
  externalId: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type ListInsertDto = z.infer<typeof listInsertDtoSchema>;
