import { test } from "node:test";
import assert from "node:assert/strict";
import { AIR_PROVIDERS, AIR_SOURCE, SOURCES, sourcesMarkdown, buildAttribution } from "../src/sources";
import { renderStationMarkdown } from "../src/formats";
import { PROVIDERS, type NormalizedStation } from "../src/types";
import { INSTRUCTIONS } from "../src/mcp";
import { readResource } from "../src/mcpcontent";
import { llmsTxt } from "../src/meta";
import { renderAbout, renderTerms, SOURCES_ABOUT, SOURCES_FAQ } from "../src/page";
import { renderSnapshotMarkdown } from "../src/formats";
import { t } from "../src/i18n";
import type { Lang } from "../src/i18n";

const resource = (uri: string) => readResource(uri)!.contents[0].text as string;
const snap = { generated_at: "2026-10-24T00:00:00Z", station_count: 0, providers: [], stations: [] };

// Every surface that credits the data, machine and human.
function surfaces(lang: Lang = "en"): Record<string, string> {
  return {
    instructions: INSTRUCTIONS,
    methodology: resource("mugilu://methodology"),
    license: resource("mugilu://license"),
    llms: llmsTxt("https://mugilu.live"),
    leaderboard: renderSnapshotMarkdown(snap, "https://mugilu.live"),
    about: renderAbout(lang),
    terms: renderTerms(lang),
  };
}

test("sources: OpenAQ is not a source, so no surface credits it (any language)", () => {
  for (const lang of ["en", "hi", "kn"] as Lang[]) {
    for (const [name, text] of Object.entries(surfaces(lang)))
      assert.doesNotMatch(text, /OpenAQ/i, `${name} (${lang})`);
  }
});

test("sources: the machine-readable surfaces carry the one source list", () => {
  const list = sourcesMarkdown();
  for (const s of SOURCES) assert.ok(list.includes(s.text), s.layer);
  const { instructions, methodology, license, llms, leaderboard } = surfaces();
  for (const [name, text] of Object.entries({ methodology, license, llms })) assert.ok(text.includes(list), name);
  assert.ok(instructions.includes(AIR_SOURCE));
  assert.ok(leaderboard.includes(AIR_SOURCE));
});

test("sources: the air credit names every OAQ provider", () => {
  for (const p of ["CPCB", "Airnet", "Aurassure", "AirView+", "OAQ"]) assert.ok(AIR_SOURCE.includes(p), p);
});

test("buildAttribution: dedupes credits, falls back to the raw id, and is never empty", () => {
  assert.equal(
    buildAttribution(["cpcb", "open-meteo", "open-meteo", null, "newprov"]),
    "Sources: CPCB (Govt. of India) via OAQ · Open-Meteo (CC-BY 4.0) · newprov, via mugilu",
  );
  assert.equal(buildAttribution([]), "via mugilu");
});

test("sources: the heat normals are a named source, credited to ERA5 and Copernicus", () => {
  const era5 = SOURCES.find((s) => s.names.includes("ERA5"));
  assert.ok(era5 && era5.names.includes("Copernicus") && era5.text.includes("1991-2020"));
  assert.match(buildAttribution(["era5"]), /ERA5 \(Copernicus C3S\)/);
});

test("sources: the FAQ and about credits are translated for hi and kn", () => {
  for (const lang of ["hi", "kn"] as Lang[])
    for (const en of [SOURCES_FAQ, SOURCES_ABOUT]) assert.notEqual(t(en, lang), en, lang);
});

test("hand-written credits (/about, its FAQ, /terms) name every source, in every language", () => {
  const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
  for (const lang of ["en", "hi", "kn"] as Lang[]) {
    const prose = {
      faq: t(SOURCES_FAQ, lang),
      about: t(SOURCES_ABOUT, lang),
      terms: text(renderTerms(lang)),
      aboutPage: text(renderAbout(lang)),
    };
    for (const [where, body] of Object.entries(prose))
      for (const s of SOURCES) for (const n of s.names) assert.ok(body.includes(n), `${where} (${lang}) lacks ${n}`);
  }
});

test("AIR_PROVIDERS: one map names each provider for the credit line, the air source and station files", () => {
  for (const p of PROVIDERS) {
    const { name, short } = AIR_PROVIDERS[p];
    assert.equal(buildAttribution([p]), `Sources: ${short} via OAQ, via mugilu`, p);
    assert.ok(AIR_SOURCE.includes(short), p);
    const s = { provider: p, name: "S", city: "C", lat: 1, lon: 1, aqi: 50, band: "good", pollutants: {}, yll: null };
    assert.ok(renderStationMarkdown(s as unknown as NormalizedStation, "2026-10-24T00:00:00Z", "x").includes(name), p);
  }
});
