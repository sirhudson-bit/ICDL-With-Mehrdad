import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * Note: once a Prisma config file exists, the CLI stops auto-loading `.env`
 * (it reports "skipping environment variable loading"), so the file is loaded
 * explicitly here. Without this, `prisma db push` and `prisma migrate` fail
 * with "Environment variable not found: DATABASE_URL".
 */
try {
  process.loadEnvFile();
} catch {
  // A .env file is optional when the variables are already in the environment
  // (CI, Docker, a hosting platform's secret store).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
