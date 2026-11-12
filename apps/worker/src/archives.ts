// When the newest file of each R2 archive was written: the hourly air archive (refresh.ts) and the 4-hourly
// conditions archive (collect.ts). Served at /health/archives so ops can tell when a record that can never be
// refilled stops growing. Reads only the listings of today's and yesterday's folders (UTC), never a file.

const ARCHIVES = ["air", "conditions"] as const;
type Kind = (typeof ARCHIVES)[number];
type Listable = { list(o: { prefix: string }): Promise<{ objects: { key: string }[]; truncated: boolean }> };

export interface ArchiveAge {
  /** the newest file's hour, ISO ("2026-11-12T08:00:00Z"); null when none in the last two days */
  latest: string | null;
  /** hours since then, one decimal; null with it */
  age_hours: number | null;
}

/** The newest file of each archive and its age. */
export async function archiveHealth(
  bucket: Listable,
  now = Date.now(),
): Promise<{ checked_at: string } & Record<Kind, ArchiveAge>> {
  const days = [0, 1].map((d) => new Date(now - d * 86_400_000).toISOString().slice(0, 10));
  const out = { checked_at: new Date(now).toISOString() } as { checked_at: string } & Record<Kind, ArchiveAge>;
  await Promise.all(
    ARCHIVES.map(async (kind) => {
      const keys = (await Promise.all(days.map((d) => bucket.list({ prefix: `archive/${kind}/${d}/` })))).flatMap((r) =>
        r.objects.map((o) => o.key),
      );
      const hours = keys
        .map((k) => k.match(/^archive\/[a-z]+\/(\d{4}-\d{2}-\d{2})\/(\d{2})\.json\.gz$/))
        .filter((m): m is RegExpMatchArray => m != null)
        .map((m) => `${m[1]}T${m[2]}:00:00Z`)
        .sort();
      const latest = hours.at(-1) ?? null;
      out[kind] = { latest, age_hours: latest ? Math.round((now - Date.parse(latest)) / 360_000) / 10 : null };
    }),
  );
  return out;
}
