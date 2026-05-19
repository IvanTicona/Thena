import { defineConfig } from "prisma/config";

// Load .env for local dev; in production containers env vars are injected by docker-compose
try { require("dotenv").config(); } catch { /* not available in production — env vars already set */ }

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
