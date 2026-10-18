import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use the direct (session, port 5432) connection for migrations, not the transaction pooler.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
