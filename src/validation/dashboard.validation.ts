import { z } from "zod";

export const getDashboardMetricsSchema = z.object({
  query: z.object({
    bypassCache: z.string().optional().refine((val) => !val || val === "true" || val === "false", {
      message: "bypassCache must be 'true' or 'false'",
    }),
    refresh: z.string().optional().refine((val) => !val || val === "true" || val === "false", {
      message: "refresh must be 'true' or 'false'",
    }),
  }),
});
