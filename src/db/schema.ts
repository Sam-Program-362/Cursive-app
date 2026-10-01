import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  githubId: text("github_id").unique(),
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  preferences: jsonb("preferences").$type<{
    theme?: string;
    fontSize?: number;
    fontFamily?: string;
    wordWrap?: "on" | "off" | "wordWrapColumn" | "bounded";
    minimap?: boolean;
    lineNumbers?: "on" | "off" | "relative";
    customTheme?: {
      background: string;
      foreground: string;
      accent: string;
      sidebarBg: string;
      editorBg: string;
    };
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  description: text("description"),
  githubRepo: text("github_repo"),
  githubBranch: text("github_branch"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  language: text("language").notNull().default("plaintext"),
  content: text("content").notNull().default(""),
  notes: text("notes").default(""),
  isFolder: boolean("is_folder").default(false).notNull(),
  parentId: text("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type FileItem = typeof files.$inferSelect;
export type NewFileItem = typeof files.$inferInsert;
