import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcp } from "../src/mcp";
import type { Env } from "../src/index";

// Ops' scenario checks on mugilu.live, 25 Nov 2026 (22:00 IST).

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const env = { OAQ_R2: { get: async () => null } } as unknown as Env;
async function tool(name: string, args: Record<string, unknown>) {
  const req = new Request("https://mugilu.live/mcp", {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    headers: { "content-type": "application/json" },
  });
  return ((await (await handleMcp(req, env, ctx)).json()) as any).result;
}

test("a coordinate outside India says so, not 'try search_place'", async () => {
  for (const place of ["15.0,88.0", "27.7172,85.324"]) {
    for (const name of ["conditions_at", "nearest_stations"]) {
      const r = await tool(name, { place });
      assert.equal(r.isError, true);
      assert.match(r.content[0].text, /is outside India/, `${name} ${place}`);
      assert.doesNotMatch(r.content[0].text, /search_place/);
    }
  }
});

test("namesakes: a name several named places share lists the others, with how to ask", async () => {
  const { namesakes, namesakeNote } = await import("../src/slugs");
  const others = namesakes("Aurangabad", "Bihar");
  assert.deepEqual(
    others.map((p) => `${p.name}, ${p.state}`),
    ["Aurangabad, Maharashtra"],
  );
  assert.equal(
    namesakeNote("Aurangabad, Bihar", others),
    'This is Aurangabad, Bihar. Another place has the same name: Aurangabad, Maharashtra (ask for "Aurangabad, Maharashtra").',
  );
  assert.deepEqual(namesakes("Pune", "Maharashtra"), []);
});

test("a warning's places: the districts and states its area covers, for the region filter", async () => {
  const { warningPlaces, warningMatches } = await import("../src/warnareas");
  // A box around Kozhikode town (Kerala).
  const ring: [number, number][] = [
    [75.7, 11.2],
    [75.9, 11.2],
    [75.9, 11.4],
    [75.7, 11.4],
    [75.7, 11.2],
  ];
  const where = warningPlaces([ring], "Kozhikode");
  assert.ok(where.includes("Kozhikode"), where.join("; "));
  assert.ok(where.includes("Kerala"), where.join("; "));
  const malayalam = { headline: "അടുത്ത 3 മണിക്കൂറിൽ കോഴിക്കോട് ജില്ലയിൽ", category: "Met", issuer: "IMD Thiruvananthapuram" };
  assert.ok(warningMatches(malayalam, where, "kerala"));
  assert.ok(warningMatches(malayalam, where, "Kozhikode"));
  assert.ok(!warningMatches(malayalam, where, "karnataka"));
  assert.ok(warningMatches(malayalam, [], "thiruvananthapuram"), "the headline, category and issuer still count");
});

test("Noida's state is Uttar Pradesh, not Delhi (the district that holds it)", async () => {
  const { stateAt } = await import("../src/place");
  assert.equal(stateAt(28.5447608, 77.3231257), "Uttar Pradesh");
});

test("headline: high cold reads 'Very cold', in en, hi and kn", async () => {
  const { headline } = await import("../src/score");
  const { t } = await import("../src/i18n");
  const say = (lang: "en" | "hi" | "kn") => {
    const h = headline({ band: "high", driver: "Cold" }, (en) => t(en, lang));
    return `${h.word} ${h.noun}`;
  };
  assert.equal(say("en"), "Very cold");
  assert.equal(say("hi"), "बहुत ठंड");
  assert.equal(say("kn"), "ತುಂಬಾ ಚಳಿ");
  const s = headline({ band: "severe", driver: "Cold" });
  assert.equal(`${s.word} ${s.noun}`, "Severe cold");
  const h = headline({ band: "high", driver: "Heat" });
  assert.equal(`${h.word} ${h.noun}`, "High heat");
});
