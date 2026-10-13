import { store } from "./store";

/** Settings the admin can change at runtime. */
export type Config = {
  /** Overrides BUILDING_PIN once set from the admin page. */
  pin?: string;
  /** Bumping this signs every device out. */
  epoch: number;
};

const KEY = "wm:config";
const CACHE_MS = 30_000;
let cache: { v: Config; at: number } | undefined;

/** Cached per instance for 30s, so device checks don't cost a Redis call each. */
export async function getConfig(): Promise<Config> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.v;
  const v = (await store().get<Config>(KEY)) ?? { epoch: 0 };
  cache = { v, at: Date.now() };
  return v;
}

export async function updateConfig(patch: Partial<Config> | ((current: Config) => Partial<Config>)) {
  const current = (await store().get<Config>(KEY)) ?? { epoch: 0 };
  const v = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
  await store().set(KEY, v);
  cache = { v, at: Date.now() };
  return v;
}

export async function buildingPin() {
  return (await getConfig()).pin || process.env.BUILDING_PIN || (process.env.NODE_ENV !== "production" ? "0000" : "");
}
