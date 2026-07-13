import { z } from "zod";

export const uploadIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid resource ID format"),
  }),
});

export const fileIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "File ID is required"),
  }),
});
