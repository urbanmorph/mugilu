import type { Warning } from "./types";

// NDMA SACHET — official disaster warnings (the IMD-replacement layer). The
// location-wise endpoint does the point→alert spatial match for us, so /c
// warnings need no feed parsing or point-in-polygon. SACHET is .gov.in (edge
// geo-firewall risk), so this is time-boxed and failure-tolerant: a slow or
// blocked response just yields no warnings and /c still renders.

const LOCATION_ALERTS_URL = "https://sachet.ndma.gov.in/cap_public_website/FetchLocationWiseAlerts";

interface RawAlert {
  severity?: string;
  identifier?: number | string;
  effective_end_time?: string;
  disaster_type?: string;
  area_description?: string;
  severity_level?: string;
  severity_color?: string;
  warning_message?: string;
  alert_source?: string;
}

/** "Sat Jun 27 14:00:00 IST 2026" → "Sat Jun 27, 14:00". */
function shortTime(t: string): string {
  const m = t.match(/^(\w+ \w+ \d+)\s+(\d{1,2}:\d{2})/);
  return m ? `${m[1]}, ${m[2]}` : t;
}

/** Official warnings active at a point, via SACHET's location-wise endpoint. */
export async function getLocationAlerts(lat: number, lon: number, radiusKm = 40): Promise<Warning[]> {
  const url = `${LOCATION_ALERTS_URL}?lat=${lat}&long=${lon}&radius=${radiusKm}`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 300, cacheEverything: true },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { alerts?: RawAlert[] };
    return (body.alerts ?? []).map((a) => ({
      event: a.disaster_type ?? "Alert",
      severity: a.severity ?? "",
      color: a.severity_color ?? "",
      certainty: a.severity_level ?? "",
      area: a.area_description ?? "",
      issuer: a.alert_source ?? "",
      until: a.effective_end_time ? shortTime(a.effective_end_time) : "",
      identifier: String(a.identifier ?? ""),
      headline: a.warning_message ?? "",
    }));
  } catch {
    return [];
  }
}
