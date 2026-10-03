"use client";

/**
 * Device file access (Android only).
 *
 * Wraps the native `DeviceFiles` plugin so Cursive can open and save real
 * files in a normal folder such as Documents/Cursive. On the web every call
 * reports "unavailable" and the UI simply hides the device buttons.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface DeviceEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

export interface DevicePaths {
  documents: string;
  workspace: string;
  granted: boolean;
}

export interface DeviceAccess {
  granted: boolean;
  sdk: number;
  needsSettings: boolean;
}

export interface DeviceFile {
  name: string;
  path: string;
  content: string;
}

interface DeviceFilesPlugin {
  hasAccess: () => Promise<DeviceAccess>;
  requestAccess: () => Promise<{ opened?: boolean; granted?: boolean }>;
  getPaths: () => Promise<DevicePaths>;
  list: (options: { path?: string }) => Promise<{
    path: string;
    parent?: string | null;
    entries: DeviceEntry[];
  }>;
  readText: (options: { path: string }) => Promise<DeviceFile>;
  writeText: (options: { path: string; content: string }) => Promise<{ path: string }>;
  makeDirectory: (options: { path: string }) => Promise<{ path: string }>;
  getInitialFile: () => Promise<{ name?: string | null; path?: string | null; content?: string | null }>;
}

let plugin: DeviceFilesPlugin | null = null;

function getPlugin(): DeviceFilesPlugin {
  if (!plugin) plugin = registerPlugin<DeviceFilesPlugin>("DeviceFiles");
  return plugin;
}

export function isDeviceFilesAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export async function hasDeviceAccess(): Promise<DeviceAccess> {
  if (!isDeviceFilesAvailable()) return { granted: false, sdk: 0, needsSettings: false };
  try {
    return await getPlugin().hasAccess();
  } catch {
    return { granted: false, sdk: 0, needsSettings: false };
  }
}

export async function requestDeviceAccess(): Promise<void> {
  if (!isDeviceFilesAvailable()) return;
  await getPlugin().requestAccess();
}

export async function getDevicePaths(): Promise<DevicePaths | null> {
  if (!isDeviceFilesAvailable()) return null;
  try {
    return await getPlugin().getPaths();
  } catch {
    return null;
  }
}

export async function listDeviceDir(path?: string) {
  return getPlugin().list({ path });
}

export async function readDeviceText(path: string): Promise<DeviceFile> {
  return getPlugin().readText({ path });
}

export async function writeDeviceText(path: string, content: string): Promise<string> {
  const result = await getPlugin().writeText({ path, content });
  return result.path;
}

export async function makeDeviceDir(path: string): Promise<string> {
  const result = await getPlugin().makeDirectory({ path });
  return result.path;
}

/** The file the app was launched with (e.g. a .py opened from a file manager). */
export async function getLaunchFile(): Promise<DeviceFile | null> {
  if (!isDeviceFilesAvailable()) return null;
  try {
    const result = await getPlugin().getInitialFile();
    if (result?.content != null && result.path) {
      return {
        name: result.name || "untitled.py",
        path: result.path,
        content: result.content,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function joinDevicePath(dir: string, name: string): string {
  if (!dir) return name;
  const separator = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith(separator) ? `${dir}${name}` : `${dir}${separator}${name}`;
}

export function fileExtension(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1].toLowerCase() : "";
}
