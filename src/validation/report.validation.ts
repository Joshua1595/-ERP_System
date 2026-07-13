import { z } from "zod";

const dateStringRefiner = (val: string | undefined) => {
  if (!val) return true;
  const parsed = Date.parse(val);
  return !isNaN(parsed);
};

export const getReportSchema = z.object({
  query: z.object({
    startDate: z.string().optional().refine(dateStringRefiner, {
      message: "startDate must be a valid ISO-8601 date string (e.g. YYYY-MM-DD)",
    }),
    endDate: z.string().optional().refine(dateStringRefiner, {
      message: "endDate must be a valid ISO-8601 date string (e.g. YYYY-MM-DD)",
    }),
    bypassCache: z.string().optional().refine((val) => !val || val === "true" || val === "false", {
      message: "bypassCache must be 'true' or 'false'",
    }),
    format: z.string().optional().refine((val) => !val || ["excel", "pdf", "json"].includes(val), {
      message: "format must be 'excel', 'pdf' or 'json'",
    }),
  }),
});
