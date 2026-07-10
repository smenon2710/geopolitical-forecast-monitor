import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DailyDigest } from "@/types";

export function getLatestDigest(): DailyDigest {
  const path = join(process.cwd(), "data", "latest.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as DailyDigest;
}
