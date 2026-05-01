const { z } = require('zod');
const dotenv = require('dotenv');

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  BOT_TOKEN: z.string(),
  REDIS_URL: z.string().optional().default('redis://localhost:6379')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation error:', parsed.error.format());
  process.exit(1);
}

module.exports = { env: parsed.data };
