import type { Env } from "./index";
import type { Snapshot, ConditionsSnapshot } from "./types";
import type { WarningsSnapshot } from "./sachet";

// One place for the R2-backed snapshot reads, so the key strings + casts live
// once (the web routes and the MCP tools share these).

export async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.OAQ_R2.get(key);
  return obj ? ((await obj.json()) as T) : null;
}

export const loadSnapshot = (env: Env) => loadJson<Snapshot>(env, "data/latest.json");
export const loadGrid = (env: Env) => loadJson<ConditionsSnapshot>(env, "data/conditions.json");
export const loadWarningsSnapshot = (env: Env) => loadJson<WarningsSnapshot>(env, "data/warnings.json");
