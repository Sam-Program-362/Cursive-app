import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { projects, files } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({
        configured: false,
        projects: [],
        message: "Neon DB is not connected. Local storage mode is active.",
      });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const query = userId
      ? db.select().from(projects).where(eq(projects.userId, userId))
      : db.select().from(projects);

    const projectList = await query;
    return NextResponse.json({
      configured: true,
      projects: projectList,
    });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, name, description, userId, githubRepo, githubBranch } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json({
        configured: false,
        project: {
          id: id || `proj_${Date.now()}`,
          name,
          description: description || "",
          userId: userId || null,
          githubRepo: githubRepo || null,
          githubBranch: githubBranch || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Saved locally (Neon DB not configured)",
      });
    }

    const newProj = {
      id: id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      description: description || "",
      userId: userId || null,
      githubRepo: githubRepo || null,
      githubBranch: githubBranch || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(projects).values(newProj).onConflictDoUpdate({
      target: projects.id,
      set: {
        name: newProj.name,
        description: newProj.description,
        githubRepo: newProj.githubRepo,
        githubBranch: newProj.githubBranch,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ configured: true, project: newProj });
  } catch (error: any) {
    console.error("Error creating/updating project:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save project" },
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
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json({
        configured: false,
        message: "Deleted locally",
      });
    }

    // Delete associated files first, then project
    await db.delete(files).where(eq(files.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));

    return NextResponse.json({ configured: true, success: true });
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete project" },
      { status: 500 }
    );
  }
}
