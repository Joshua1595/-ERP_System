import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse req.body, req.query, and req.params through the schema
      const validated = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as any;

      // Update the request objects only if they are validated/present
      if (validated.body !== undefined) {
        req.body = validated.body;
      }
      if (validated.query !== undefined) {
        req.query = validated.query;
      }
      if (validated.params !== undefined) {
        req.params = validated.params;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Map the errors to a clean, readable dictionary
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        return res.status(400).json({
          status: "fail",
          statusCode: 400,
          message: "Request validation failed.",
          errors: formattedErrors,
        });
      }
      next(error);
    }
  };
};
