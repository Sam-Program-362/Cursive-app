import { NextResponse } from "next/server";
import { getDb } from "@/db";

export async function GET() {
  const db = getDb();
  const dbConfigured = Boolean(process.env.DATABASE_URL);

  return NextResponse.json({
    status: "ok",
    appName: "CodePad",
    dbConnected: dbConfigured && db !== null,
    dbConfigured,
    timestamp: new Date().toISOString(),
  });
}
