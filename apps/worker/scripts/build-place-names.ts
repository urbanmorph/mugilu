// Regenerate apps/worker/data/place-names.json: each named place's name in Hindi and Kannada,
// for the hi and kn pages (supporting-docs/READING_SENTENCES_SPEC.md, step 4).
//
//   npx tsx scripts/build-place-names.ts [--state DIR] [--refresh]
//
// Source: Wikidata (CC0) labels of the item that carries the district's LGD code (P12746). The
// codes come from data/lgd-districts.json (bharatlas lgd_districts: dtname, stname, dist_lgd).
// A name is taken only where the language is the state's own: Hindi in the Hindi-speaking
// states and UTs, Kannada in Karnataka. Elsewhere Wikidata's labels are often machine-made
// (Sri Ganganagar came out as "ಶ್ರೀ ಗಾಂಗಾಧರ್"), and the page keeps the Latin name.
// The major cities (slugs.ts CITY_SEEDS) take hand-written names in both languages.
// FIXES corrects labels that are an old name or misspelt; ADDED holds districts Wikidata lacks.
//
// - Caching: the Wikidata answer is kept in DIR/wikidata.json; a rerun reads it (--refresh to ask again).
// - Idempotent: the output is written only when it changes.
// - One request, so there is nothing to resume; it logs each step.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allSlugPlaces } from "../src/slugs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/place-names.json");
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const STATE = arg("--state") ?? join(ROOT, ".cache/place-names");
mkdirSync(STATE, { recursive: true });
const CACHE = join(STATE, "wikidata.json");
const log = (s: string) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);

const HINDI_STATES = new Set([
  "Uttar Pradesh",
  "Bihar",
  "Madhya Pradesh",
  "Rajasthan",
  "Uttarakhand",
  "Himachal Pradesh",
  "Haryana",
  "Delhi",
  "Jharkhand",
  "Chhattisgarh",
  "Chandigarh",
]);
const KANNADA_STATES = new Set(["Karnataka"]);

type Names = { hi?: string; kn?: string };

/** The major cities, by slug: names as their own and national press write them. */
const CITIES: Record<string, Names> = {
  delhi: { hi: "दिल्ली", kn: "ದೆಹಲಿ" },
  mumbai: { hi: "मुंबई", kn: "ಮುಂಬೈ" },
  bengaluru: { hi: "बेंगलुरु", kn: "ಬೆಂಗಳೂರು" },
  kolkata: { hi: "कोलकाता", kn: "ಕೋಲ್ಕತ್ತಾ" },
  chennai: { hi: "चेन्नई", kn: "ಚೆನ್ನೈ" },
  hyderabad: { hi: "हैदराबाद", kn: "ಹೈದರಾಬಾದ್" },
  pune: { hi: "पुणे", kn: "ಪುಣೆ" },
  ahmedabad: { hi: "अहमदाबाद", kn: "ಅಹಮದಾಬಾದ್" },
  jaipur: { hi: "जयपुर", kn: "ಜೈಪುರ" },
  lucknow: { hi: "लखनऊ", kn: "ಲಕ್ನೋ" },
  surat: { hi: "सूरत", kn: "ಸೂರತ್" },
  kanpur: { hi: "कानपुर", kn: "ಕಾನ್ಪುರ" },
  nagpur: { hi: "नागपुर", kn: "ನಾಗ್ಪುರ" },
  indore: { hi: "इंदौर", kn: "ಇಂದೋರ್" },
  bhopal: { hi: "भोपाल", kn: "ಭೋಪಾಲ್" },
  patna: { hi: "पटना", kn: "ಪಾಟ್ನಾ" },
  visakhapatnam: { hi: "विशाखापत्तनम", kn: "ವಿಶಾಖಪಟ್ಟಣಂ" },
  vadodara: { hi: "वडोदरा", kn: "ವಡೋದರಾ" },
  coimbatore: { hi: "कोयंबटूर", kn: "ಕೊಯಮತ್ತೂರು" },
  kochi: { hi: "कोच्चि", kn: "ಕೊಚ್ಚಿ" },
  chandigarh: { hi: "चंडीगढ़", kn: "ಚಂಡೀಗಢ" },
  guwahati: { hi: "गुवाहाटी", kn: "ಗುವಾಹಟಿ" },
  bhubaneswar: { hi: "भुवनेश्वर", kn: "ಭುವನೇಶ್ವರ" },
  thiruvananthapuram: { hi: "तिरुवनंतपुरम", kn: "ತಿರುವನಂತಪುರಂ" },
  ludhiana: { hi: "लुधियाना", kn: "ಲುಧಿಯಾನ" },
};

/** Wikidata labels that are an old name or misspelt, by "District|State" (the LGD spelling). */
const FIXES: Record<string, Names> = {
  "Amethi|Uttar Pradesh": { hi: "अमेठी" },
  "Nuh|Haryana": { hi: "नूंह" },
  "Gurugram|Haryana": { hi: "गुरुग्राम" },
  "Kabirdham|Chhattisgarh": { hi: "कबीरधाम" },
  "Dhar|Madhya Pradesh": { hi: "धार" },
  "Pilibhit|Uttar Pradesh": { hi: "पीलीभीत" },
  "Una|Himachal Pradesh": { hi: "ऊना" },
  "Raigarh|Chhattisgarh": { hi: "रायगढ़" },
  "Garhwa|Jharkhand": { hi: "गढ़वा" },
  "Lakhisarai|Bihar": { hi: "लखीसराय" },
  "Giridih|Jharkhand": { hi: "गिरिडीह" },
  "Chamoli|Uttarakhand": { hi: "चमोली" },
  "Kanpur Nagar|Uttar Pradesh": { hi: "कानपुर नगर" },
  "Balrampur|Chhattisgarh": { hi: "बलरामपुर-रामानुजगंज" },
  "Churu|Rajasthan": { hi: "चूरू" },
  "Sehore|Madhya Pradesh": { hi: "सीहोर" },
  "Lohardaga|Jharkhand": { hi: "लोहरदगा" },
  "East Nimar|Madhya Pradesh": { hi: "खंडवा" },
  "Kalaburagi|Karnataka": { kn: "ಕಲಬುರಗಿ" },
};

/** Districts with no Wikidata item for their LGD code (new in 2023-24). */
const ADDED: Record<string, Names> = {
  "Mohla Manpur Ambagarh Chouki|Chhattisgarh": { hi: "मोहला-मानपुर-अंबागढ़ चौकी" },
  "Shahpura|Rajasthan": { hi: "शाहपुरा" },
  "Phalodi|Rajasthan": { hi: "फलोदी" },
  "Jodhpur Gramin|Rajasthan": { hi: "जोधपुर ग्रामीण" },
  "Beawar|Rajasthan": { hi: "ब्यावर" },
  "Kekri|Rajasthan": { hi: "केकड़ी" },
  "Dudu|Rajasthan": { hi: "दूदू" },
  "Anoopgarh|Rajasthan": { hi: "अनूपगढ़" },
  "Shahdara|Delhi": { hi: "शाहदरा" },
  "Deeg|Rajasthan": { hi: "डीग" },
  "Jaipur Gramin|Rajasthan": { hi: "जयपुर ग्रामीण" },
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");
/** "अल्मोड़ा ज़िला" → "अल्मोड़ा"; "हमीरपुर जिला, हिमाचल प्रदेश" → "हमीरपुर"; "पलवल-Palwal" → "पलवल". */
const clean = (s: string) =>
  s
    .split(",")[0]
    .replace(/\s*(ज़िला|जिला|जनपद|ಜಿಲ್ಲೆ)$/u, "")
    .replace(/-[A-Za-z ]+$/, "")
    .trim();
const DEVANAGARI = /^[ऀ-ॿ\s-]+$/u;
const KANNADA = /^[ಀ-೿\s-]+$/u;

async function wikidata(): Promise<Map<string, Names>> {
  if (!existsSync(CACHE) || process.argv.includes("--refresh")) {
    log("asking Wikidata for every item with an LGD district code (P12746)");
    const q = `SELECT ?code ?hi ?kn WHERE { ?d wdt:P12746 ?code.
      OPTIONAL { ?d rdfs:label ?hi FILTER(lang(?hi) = "hi") }
      OPTIONAL { ?d rdfs:label ?kn FILTER(lang(?kn) = "kn") } }`;
    let body = "";
    for (let tries = 1; ; tries++) {
      const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(q)}`, {
        headers: { accept: "application/sparql-results+json", "user-agent": "mugilu-build/1.0" },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        body = await res.text();
        break;
      }
      if (tries >= 4) throw new Error(`wikidata ${res.status}`);
      log(`wikidata ${res.status}, retrying in ${5 * tries} s`);
      await new Promise((r) => setTimeout(r, 5000 * tries));
    }
    writeFileSync(CACHE, body);
  } else log(`reading the cached Wikidata answer (${CACHE})`);
  type B = { code: { value: string }; hi?: { value: string }; kn?: { value: string } };
  const rows = (JSON.parse(readFileSync(CACHE, "utf8")) as { results: { bindings: B[] } }).results.bindings;
  const byCode = new Map<string, Names>();
  for (const b of rows) {
    const n = byCode.get(b.code.value) ?? {};
    n.hi ??= b.hi?.value;
    n.kn ??= b.kn?.value;
    byCode.set(b.code.value, n);
  }
  log(`${byCode.size} LGD codes on Wikidata`);
  return byCode;
}

async function main() {
  const byCode = await wikidata();
  const lgd = JSON.parse(readFileSync(join(ROOT, "data/lgd-districts.json"), "utf8")) as {
    name: string;
    state: string;
    lgd: number;
  }[];
  const codeOf = (name: string, state: string) => {
    let c = lgd.filter((r) => norm(r.name) === norm(name));
    if (c.length > 1) c = c.filter((r) => norm(r.state) === norm(state));
    return c.length === 1 ? String(c[0].lgd) : undefined;
  };

  const out: Record<string, Names> = {};
  let hi = 0;
  let kn = 0;
  for (const p of allSlugPlaces()) {
    const state = p.state ?? "";
    const key = `${p.name}|${state}`;
    const wd = byCode.get(codeOf(p.name, state) ?? "") ?? {};
    const pick: Names = CITIES[p.slug] ?? {
      hi: HINDI_STATES.has(state) ? (FIXES[key]?.hi ?? ADDED[key]?.hi ?? (wd.hi && clean(wd.hi))) : undefined,
      kn: KANNADA_STATES.has(state) ? (FIXES[key]?.kn ?? ADDED[key]?.kn ?? (wd.kn && clean(wd.kn))) : undefined,
    };
    if (pick.hi && !DEVANAGARI.test(pick.hi)) throw new Error(`${key}: Hindi name not in Devanagari: ${pick.hi}`);
    if (pick.kn && !KANNADA.test(pick.kn)) throw new Error(`${key}: Kannada name not in Kannada: ${pick.kn}`);
    if (!pick.hi && !pick.kn) continue;
    out[p.slug] = { ...(pick.hi && { hi: pick.hi }), ...(pick.kn && { kn: pick.kn }) };
    hi += +!!pick.hi;
    kn += +!!pick.kn;
  }
  const sorted =
    "{\n" +
    Object.keys(out)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${JSON.stringify(out[k])}`)
      .join(",\n") +
    "\n}\n";
  if (existsSync(OUT) && readFileSync(OUT, "utf8") === sorted) return log(`unchanged: ${OUT}`);
  writeFileSync(OUT, sorted);
  log(`wrote ${Object.keys(out).length} places (${hi} Hindi, ${kn} Kannada) to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
