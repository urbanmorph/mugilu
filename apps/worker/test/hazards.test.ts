import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HAZARDS, HAZARDS_SHORT } from "../src/hazards";
import { llmsTxt, mcpJson, openApiSpec } from "../src/meta";
import { renderAbout, renderConditionsPage, renderHome } from "../src/page";
import { webManifest } from "../src/install";
import type { Conditions } from "../src/types";

// mugilu is a whole-atmosphere app: every surface that lists its hazards says the same
// list (cold included), so search snippets, agent listings and the README never drift.

const SERVER_JSON = JSON.parse(readFileSync(new URL("../../../server.json", import.meta.url), "utf8"));
const title = (html: string) => html.match(/<title>([^<]*)<\/title>/)![1];
const desc = (html: string) => html.match(/<meta name="description" content="([^"]*)"/)![1];
const websiteLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .find((j) => j["@type"] === "WebSite");

test("the canonical hazard list names cold, and the short one fits a title", () => {
  assert.equal(HAZARDS, "air, heat, cold, rain, wind, fog, dust, smoke, UV and official warnings");
  assert.equal(HAZARDS_SHORT, "air, heat, cold, fog and warnings");
});

test("llms.txt, /.well-known/mcp.json and the OpenAPI spec carry the full list", () => {
  assert.ok(llmsTxt("https://mugilu.live").replace(/\n> /g, " ").includes(HAZARDS));
  assert.ok(JSON.parse(mcpJson("https://mugilu.live")).description.includes(HAZARDS));
  assert.ok(((openApiSpec("https://mugilu.live") as any).info.description as string).includes(HAZARDS));
});

test("server.json: the Registry description carries the full list within the Registry's 100 chars", () => {
  assert.ok(SERVER_JSON.description.includes(HAZARDS), SERVER_JSON.description);
  assert.ok(SERVER_JSON.description.length <= 100, String(SERVER_JSON.description.length));
});

test("homepage: title (within 60 chars), description and WebSite JSON-LD carry the list", () => {
  const en = renderHome();
  assert.equal(title(en), `mugilu: ${HAZARDS_SHORT} anywhere in India`);
  assert.ok(title(en).length <= 60);
  assert.ok(desc(en).includes(HAZARDS));
  assert.ok(websiteLd(en).description.includes(HAZARDS));
  assert.equal(
    title(renderHome(undefined, undefined, undefined, "hi")),
    "mugilu: भारत में कहीं भी वायु, गर्मी, ठंड, कोहरा और चेतावनियाँ",
  );
  assert.equal(
    title(renderHome(undefined, undefined, undefined, "kn")),
    "mugilu: ಭಾರತದಲ್ಲಿ ಎಲ್ಲಿಯಾದರೂ ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಮಂಜು ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳು",
  );
  assert.match(desc(renderHome(undefined, undefined, undefined, "hi")), /वायु, गर्मी, ठंड, बारिश, हवा, कोहरा, धूल, धुआं, UV/);
  assert.match(desc(renderHome(undefined, undefined, undefined, "kn")), /ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಮಳೆ, ಗಾಳಿ, ಮಂಜು, ಧೂಳು, ಹೊಗೆ, UV/);
});

test("the installed app's description is the site description", () => {
  assert.ok(webManifest("en").description.includes(HAZARDS));
  assert.match(webManifest("kn").description, /ಚಳಿ/);
});

test("/about: the meta description carries the list, in each language", () => {
  assert.ok(desc(renderAbout("en")).includes(HAZARDS));
  assert.match(desc(renderAbout("hi")), /वायु, गर्मी, ठंड, बारिश, हवा, कोहरा, धूल, धुआं, UV/);
  assert.match(desc(renderAbout("kn")), /ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಮಳೆ, ಗಾಳಿ, ಮಂಜು, ಧೂಳು, ಹೊಗೆ, UV/);
});

test("a place page: the description and Dataset JSON-LD carry the list", () => {
  const c = {
    location: { lat: 28.61, lon: 77.21 },
    place: "Delhi",
    as_of: "2026-11-18T08:00:00.000Z",
    attribution: "Sources: Open-Meteo (CC-BY 4.0), via mugilu",
    disclaimer: "Informational only.",
  } as unknown as Conditions;
  const html = renderConditionsPage(c, "everyone", "https://mugilu.live/c/delhi");
  assert.ok(desc(html).includes(HAZARDS));
  assert.match(html, new RegExp(`"description":"[^"]*${HAZARDS}`));
  assert.match(desc(renderConditionsPage(c, "everyone", undefined, "kn")), /ಚಳಿ/);
  assert.match(desc(renderConditionsPage(c, "everyone", undefined, "hi")), /ठंड/);
});
