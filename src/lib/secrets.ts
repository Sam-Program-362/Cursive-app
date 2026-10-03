"use client";

/**
 * Secret storage for API tokens (GitHub, AI providers).
 *
 * Inside the installed Android app the value is encrypted with an Android
 * Keystore key via the native `SecureStore` plugin, so it never sits in plain
 * text on disk. On the web there is no Keystore, so we fall back to
 * localStorage. Any token previously saved in localStorage is migrated into
 * the encrypted store the first time it is read on device.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

interface SecureStorePlugin {
  get: (options: { key: string }) => Promise<{ value?: string | null }>;
  set: (options: { key: string; value: string }) => Promise<void>;
  remove: (options: { key: string }) => Promise<void>;
}

let plugin: SecureStorePlugin | null = null;

function getPlugin(): SecureStorePlugin {
  if (!plugin) {
    plugin = registerPlugin<SecureStorePlugin>("SecureStore");
  }
  return plugin;
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function getSecret(key: string): Promise<string | null> {
  if (isNative()) {
    try {
      const result = await getPlugin().get({ key });
      const value = result?.value;
      if (typeof value === "string" && value.length > 0) return value;

      // Migrate a token saved by an older build that used localStorage.
      const legacy = readLocal(key);
      if (legacy) {
        await setSecret(key, legacy);
        removeLocal(key);
        return legacy;
      }
      return null;
    } catch {
      // Native store unavailable — fall through to localStorage.
    }
  }
  return readLocal(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (isNative()) {
    try {
      await getPlugin().set({ key, value });
      removeLocal(key);
      return;
    } catch {
      // Fall through to localStorage so the app still works.
    }
  }
  writeLocal(key, value);
}

export async function removeSecret(key: string): Promise<void> {
  if (isNative()) {
    try {
      await getPlugin().remove({ key });
    } catch {
      /* ignore */
    }
  }
  removeLocal(key);
}

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked */
  }
}

function removeLocal(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
