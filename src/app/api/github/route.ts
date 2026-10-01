import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { action, token, repo, branch = "main", message, files: filesToPush, path: filePath } =
      await req.json();

    const authToken = token || process.env.GITHUB_TOKEN;

    if (!authToken && action !== "pull_public") {
      return NextResponse.json(
        {
          error:
            "GitHub Access Token is required. Please provide a token in the GitHub panel or configure GITHUB_TOKEN.",
        },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CodePad-Editor",
    };

    if (authToken && authToken !== "arena-egress-dummy-token") {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    // 1. List user repos
    if (action === "list_repos") {
      const res = await fetch("https://api.github.com/user/repos?per_page=50&sort=updated", {
        headers,
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json(
          { error: `GitHub API error: ${err}` },
          { status: res.status }
        );
      }

      const repos = await res.json();
      return NextResponse.json({ repos });
    }

    // 2. Pull / Import repo files
    if (action === "pull" || action === "pull_public") {
      if (!repo) {
        return NextResponse.json(
          { error: "Repository (owner/repo) is required" },
          { status: 400 }
        );
      }

      // Fetch git tree recursively
      const treeRes = await fetch(
        `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
        { headers }
      );

      if (!treeRes.ok) {
        // Try master branch if main failed
        const treeResMaster = await fetch(
          `https://api.github.com/repos/${repo}/git/trees/master?recursive=1`,
          { headers }
        );

        if (!treeResMaster.ok) {
          const err = await treeRes.text();
          return NextResponse.json(
            { error: `Failed to fetch repo tree: ${err}` },
            { status: treeRes.status }
          );
        }

        const masterData = await treeResMaster.json();
        const files = await fetchFilesFromTree(repo, "master", masterData.tree, headers);
        return NextResponse.json({ branch: "master", files });
      }

      const data = await treeRes.json();
      const files = await fetchFilesFromTree(repo, branch, data.tree, headers);
      return NextResponse.json({ branch, files });
    }

    // 3. Push file or commit to repo
    if (action === "push") {
      if (!repo) {
        return NextResponse.json(
          { error: "Repository name is required" },
          { status: 400 }
        );
      }

      if (!filesToPush || !Array.isArray(filesToPush) || filesToPush.length === 0) {
        return NextResponse.json(
          { error: "No files provided to push" },
          { status: 400 }
        );
      }

      const results = [];
      for (const f of filesToPush) {
        if (f.isFolder) continue;

        const cleanPath = f.path.startsWith("/") ? f.path.slice(1) : f.path;
        const fileUrl = `https://api.github.com/repos/${repo}/contents/${cleanPath}`;

        // Check if file already exists to get its SHA for update
        let sha: string | undefined;
        try {
          const checkRes = await fetch(`${fileUrl}?ref=${branch}`, { headers });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            sha = checkData.sha;
          }
        } catch {}

        const encodedContent = Buffer.from(f.content || "").toString("base64");

        const putRes = await fetch(fileUrl, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            message: message || `Update ${cleanPath} via CodePad`,
            content: encodedContent,
            branch,
            sha,
          }),
        });

        if (!putRes.ok) {
          const errText = await putRes.text();
          results.push({ path: cleanPath, status: "error", message: errText });
        } else {
          results.push({ path: cleanPath, status: "success" });
        }
      }

      return NextResponse.json({
        success: true,
        repo,
        branch,
        pushedFiles: results,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("GitHub API error:", error);
    return NextResponse.json(
      { error: error?.message || "GitHub integration error" },
      { status: 500 }
    );
  }
}

async function fetchFilesFromTree(
  repo: string,
  branch: string,
  treeItems: any[],
  headers: Record<string, string>
) {
  const resultFiles = [];
  // Take up to 25 text code files
  const validFiles = treeItems
    .filter(
      (item) =>
        item.type === "blob" &&
        !item.path.includes(".git/") &&
        !item.path.includes("node_modules/") &&
        !item.path.endsWith(".png") &&
        !item.path.endsWith(".jpg") &&
        !item.path.endsWith(".zip") &&
        !item.path.endsWith(".tar.gz")
    )
    .slice(0, 30);

  for (const item of validFiles) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${item.path}`;
      const rawRes = await fetch(rawUrl, { headers });
      if (rawRes.ok) {
        const text = await rawRes.text();
        resultFiles.push({
          path: item.path.startsWith("/") ? item.path : `/${item.path}`,
          name: item.path.split("/").pop() || item.path,
          content: text,
        });
      }
    } catch {}
  }

  return resultFiles;
}
