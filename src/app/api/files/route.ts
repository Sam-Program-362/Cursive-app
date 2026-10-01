import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { files } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query param is required" },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json({
        configured: false,
        files: [],
        message: "Neon DB is not connected. Local storage mode is active.",
      });
    }

    const fileList = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId));

    return NextResponse.json({
      configured: true,
      files: fileList,
    });
  } catch (error: any) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch files" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      id,
      projectId,
      name,
      path,
      language,
      content,
      notes,
      isFolder,
      parentId,
    } = body;

    if (!projectId || !name) {
      return NextResponse.json(
        { error: "projectId and name are required" },
        { status: 400 }
      );
    }

    const fileId =
      id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!db) {
      return NextResponse.json({
        configured: false,
        file: {
          id: fileId,
          projectId,
          name,
          path: path || `/${name}`,
          language: language || "plaintext",
          content: content || "",
          notes: notes || "",
          isFolder: Boolean(isFolder),
          parentId: parentId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const fileData = {
      id: fileId,
      projectId,
      name,
      path: path || `/${name}`,
      language: language || "plaintext",
      content: content ?? "",
      notes: notes ?? "",
      isFolder: Boolean(isFolder),
      parentId: parentId || null,
      updatedAt: new Date(),
    };

    await db
      .insert(files)
      .values({ ...fileData, createdAt: new Date() })
      .onConflictDoUpdate({
        target: files.id,
        set: {
          name: fileData.name,
          path: fileData.path,
          language: fileData.language,
          content: fileData.content,
          notes: fileData.notes,
          isFolder: fileData.isFolder,
          parentId: fileData.parentId,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ configured: true, file: fileData });
  } catch (error: any) {
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save file" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json({ configured: false, success: true });
    }

    await db.delete(files).where(eq(files.id, id));
    return NextResponse.json({ configured: true, success: true });
  } catch (error: any) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete file" },
      { status: 500 }
    );
  }
}
