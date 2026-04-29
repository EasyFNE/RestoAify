import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url().refine(
    (u) => u.includes(':6543'),
    'DATABASE_URL must use the Supabase transaction pooler (port 6543) — see .env.example',
  ),
  SUPABASE_JWT_SECRET: z.string().min(20, 'SUPABASE_JWT_SECRET is required'),
  BACKEND_API_KEY: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message — never start with bad config.
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
