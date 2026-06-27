import type { NormalizedStation, CityGroup } from "./types";

export function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function groupByCity(stations: NormalizedStation[]): CityGroup[] {
  const by = new Map<string, NormalizedStation[]>();
  for (const s of stations) {
    const city = s.city.trim() || "Unknown";
    const slug = slugify(city);
    const arr = by.get(slug) ?? [];
    arr.push(s);
    by.set(slug, arr);
  }
  const groups: CityGroup[] = [];
  for (const [slug, arr] of by.entries()) {
    const valid = arr.filter((s) => s.aqi !== null) as (NormalizedStation & { aqi: number })[];
    const avg = valid.length ? Math.round(valid.reduce((a, s) => a + s.aqi, 0) / valid.length) : null;
    const worst = valid.length ? Math.max(...valid.map((s) => s.aqi)) : null;
    arr.sort((a, b) => {
      if (a.aqi === null && b.aqi === null) return a.name.localeCompare(b.name);
      if (a.aqi === null) return 1;
      if (b.aqi === null) return -1;
      return b.aqi - a.aqi;
    });
    groups.push({ slug, name: arr[0].city.trim() || "Unknown", stations: arr, avgAqi: avg, worstAqi: worst });
  }
  groups.sort((a, b) => {
    if (a.avgAqi === null && b.avgAqi === null) return a.name.localeCompare(b.name);
    if (a.avgAqi === null) return 1;
    if (b.avgAqi === null) return -1;
    return b.avgAqi - a.avgAqi;
  });
  return groups;
}

export function formatUpdated(iso: string): { absolute: string; relative: string } {
  const d = new Date(iso);
  const absolute =
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " IST";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  let relative: string;
  if (mins < 1) relative = "just now";
  else if (mins < 60) relative = `${mins} min ago`;
  else if (mins < 1440) relative = `${Math.floor(mins / 60)} h ago`;
  else relative = `${Math.floor(mins / 1440)} d ago`;
  return { absolute, relative };
}
