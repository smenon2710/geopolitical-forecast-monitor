import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), "data", "cache");

export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
}

/**
 * Committed to the repo alongside data/history so the last real payload per
 * source survives across GitHub Action runs (each run starts from a fresh
 * checkout — nothing in-memory persists between them).
 */
export function readCache<T>(key: string): CacheEntry<T> | null {
  const path = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, `${key}.json`);
  writeFileSync(path, JSON.stringify({ data, cachedAt: new Date().toISOString() }, null, 2));
}
