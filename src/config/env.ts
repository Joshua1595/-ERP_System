import { z } from "zod";
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10)),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters long"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters long"),
  STORAGE_PROVIDER: z.enum(["local", "cloudinary"]).default("local"),
  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Cloudinary credentials (conditional checks can be done)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  // Graceful fallbacks for development/testing if variables are missing
  const isProd = process.env.NODE_ENV === "production";

  const rawEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT || "3000",
    JWT_SECRET: process.env.JWT_SECRET || "super-secure-default-erp-secret-key-2026",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "super-secure-default-erp-refresh-secret-key-2026",
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || "local",
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  try {
    const parsed = envSchema.parse(rawEnv);
    console.log(`✅ [EnvValidation] Configuration validated successfully. Mode: ${parsed.NODE_ENV}`);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ [EnvValidation] Configuration validation failed:");
      error.issues.forEach((issue) => {
        console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
      });
      if (isProd) {
        throw new Error("Fatal: Invalid environment configuration in production environment.");
      } else {
        console.warn("⚠️ Continuing with default fallback development configuration.");
        return rawEnv as any;
      }
    }
    throw error;
  }
}

export const envConfig = validateEnv();
