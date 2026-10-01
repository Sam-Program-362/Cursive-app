import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Cache database connection
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return null;
  }

  if (!dbInstance) {
    try {
      const sql = neon(connectionString);
      dbInstance = drizzle(sql, { schema });
    } catch (err) {
      console.warn("Failed to initialize Neon DB connection:", err);
      return null;
    }
  }

  return dbInstance;
}

export const schemaExport = schema;
