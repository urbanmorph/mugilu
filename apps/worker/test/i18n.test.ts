import { test } from "node:test";
import assert from "node:assert/strict";
import { t, lp, langUrl, langCss, LANG_NAME, LANGS } from "../src/i18n";
import {
  renderHome,
  renderNotFound,
  renderConditionsPage,
  renderDisplayBuilder,
  renderWarningsPage,
  renderKioskPage,
  renderAbout,
  renderMethodology,
  renderTerms,
} from "../src/page";
import type { Conditions } from "../src/types";

const REAL_DISCLAIMER =
  "Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD.";
function cond(overrides: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 28.61, lon: 77.21 },
    as_of: "2026-06-26T14:05:00.000Z",
    air: {
      aqi: 320,
      band: "severe",
      pollutants: { pm25: 250 },
      yll: 5,
      station: { id: "x", name: "y", city: "Delhi", distance_km: 2 },
      source: "airnet",
    },
    heat: { temp_c: 41, humidity_pct: 40, apparent_c: 44, wet_bulb_c: 27, source: "open-meteo" },
    attribution: "Sources: CPCB · Open-Meteo, via mugilu",
    disclaimer: REAL_DISCLAIMER,
    ...overrides,
  } as Conditions;
}

test("t(): English is identity; hi/kn look up; unknown key falls back to English", () => {
  assert.equal(t("Popular:", "en"), "Popular:");
  assert.equal(t("Popular:", "hi"), "प्रसिद्ध स्थान:");
  assert.equal(t("Popular:", "kn"), "ಜನಪ್ರಿಯ ಸ್ಥಳಗಳು:");
  // a string with no translation entry renders the English source, never a blank
  assert.equal(t("this key does not exist anywhere", "kn"), "this key does not exist anywhere");
});

test("LANG_NAME: each language named in its own script", () => {
  assert.deepEqual([...LANGS], ["en", "hi", "kn"]);
  assert.equal(LANG_NAME.en, "English");
  assert.equal(LANG_NAME.hi, "हिंदी");
  assert.equal(LANG_NAME.kn, "ಕನ್ನಡ");
});

test("lp(): English stays unprefixed; hi/kn get a path prefix; root has no trailing slash", () => {
  assert.equal(lp("/c/12.97,77.59", "en"), "/c/12.97,77.59");
  assert.equal(lp("/c/12.97,77.59", "kn"), "/kn/c/12.97,77.59");
  assert.equal(lp("/", "en"), "/");
  assert.equal(lp("/", "kn"), "/kn");
});

test("langUrl(): inserts the prefix into a canonical URL, home + deep + query", () => {
  assert.equal(langUrl("https://mugilu.live", "en"), "https://mugilu.live");
  assert.equal(langUrl("https://mugilu.live", "kn"), "https://mugilu.live/kn");
  assert.equal(langUrl("https://mugilu.live/warnings", "hi"), "https://mugilu.live/hi/warnings");
  assert.equal(langUrl("https://mugilu.live/go?q=delhi", "kn"), "https://mugilu.live/kn/go?q=delhi");
});

test("langCss(): none for English; Indic font vars + relaxed line-height otherwise", () => {
  assert.equal(langCss("en"), "");
  assert.match(langCss("kn"), /Noto Serif Kannada/);
  assert.match(langCss("kn"), /Noto Sans Kannada/);
  assert.match(langCss("hi"), /Noto Serif Devanagari/);
  assert.match(langCss("hi"), /line-height/);
});

test("renderHome(en): unchanged English, html lang=en, unprefixed canonical", () => {
  const html = renderHome(undefined, undefined, undefined, "en");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /What's it like outside, right now\?/);
  assert.match(html, /The open sky of India, one coordinate at a time\./);
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live">/);
  // hreflang alternates for every language + x-default
  assert.match(html, /hreflang="hi" href="https:\/\/mugilu\.live\/hi"/);
  assert.match(html, /hreflang="kn" href="https:\/\/mugilu\.live\/kn"/);
  assert.match(html, /hreflang="x-default" href="https:\/\/mugilu\.live"/);
});

test("renderHome(kn): Kannada hero + tagline, html lang=kn, /kn canonical, Indic font", () => {
  const html = renderHome(undefined, undefined, undefined, "kn");
  assert.match(html, /<html lang="kn">/);
  assert.match(html, /ಈಗ ಹೊರಗೆ ಹೇಗಿದೆ\?/); // hero
  assert.match(html, /ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ, ನಿರ್ದೇಶಾಂಕ ಒಂದೊಂದಾಗಿ\./); // tagline
  assert.match(html, /ಜನಪ್ರಿಯ ಸ್ಥಳಗಳು:/); // Popular:
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/kn">/);
  assert.match(html, /Noto Serif Kannada/); // font override injected
  assert.match(html, /ಎಚ್ಚರಿಕೆಗಳು<\/span>/); // covers row localized (warnings)
  assert.match(html, /placeholder="ಭಾರತದಲ್ಲಿ ಒಂದು ಸ್ಥಳ/); // localized, no leak
  assert.doesNotMatch(html, /\(placeholder\)/); // the disambiguation key never leaks
});

test("renderHome(kn): highlights hero localized; place + state names kept English", () => {
  const hl = {
    hottest: { name: "Sitapur", state: "Uttar Pradesh", lat: 27.5, lon: 80.7, apparent_c: 41, wet_bulb_c: 29 },
    dustiest: { name: "Jaisalmer", state: "Rajasthan", lat: 26.9, lon: 70.9, dust_ug_m3: 600 },
    worstAir: { name: "New Delhi", state: "Delhi", lat: 28.6, lon: 77.2, aqi: 500, band: "severe" },
  } as unknown as Parameters<typeof renderHome>[1];
  const html = renderHome(undefined, hl, undefined, "kn");
  assert.match(html, /ಈಗ ಭಾರತದಾದ್ಯಂತ/); // "Right now in India" heading
  assert.match(html, /ಅತ್ಯಂತ ಬಿಸಿಲು: <b>Sitapur, Uttar Pradesh<\/b>/); // label localized, place English
  assert.match(html, /41° ಅನಿಸುತ್ತದೆ/); // "feels" (anisuttade), after the number
  assert.match(html, /ಅಪಾಯಕಾರವಾದ ಆರ್ದ್ರತೆ ಮತ್ತು ಬಿಸಿಲು/); // heat phrase
  assert.match(html, /ತೀವ್ರ ಧೂಳು/); // dust phrase
  assert.doesNotMatch(html, /feels 41|Hottest:|Dustiest:|Worst air:/); // no English leaked
});

test("renderHome(hi): Hindi hero, html lang=hi", () => {
  const html = renderHome(undefined, undefined, undefined, "hi");
  assert.match(html, /<html lang="hi">/);
  assert.match(html, /बाहर अभी कैसा है\?/);
  assert.doesNotMatch(html, /मौसम/); // "weather" is deliberately avoided (mugilu is broader)
});

test("language switcher: current language bold, the others link to the same page", () => {
  const kn = renderHome(undefined, undefined, undefined, "kn");
  assert.match(kn, /class="langsw"/);
  assert.match(kn, /<b>ಕನ್ನಡ<\/b>/); // current is not a link
  // switcher links are relative (host-agnostic), not absolute prod URLs
  assert.match(kn, /href="\/" hreflang="en">English<\/a>/);
  assert.match(kn, /href="\/hi" hreflang="hi">हिंदी<\/a>/);
  assert.doesNotMatch(kn, /langsw[\s\S]*href="https:\/\/mugilu/);
});

test("footer nav: internal links carry the lang prefix; labels localized", () => {
  const kn = renderHome(undefined, undefined, undefined, "kn");
  assert.match(kn, /href="\/kn\/about"/);
  assert.match(kn, /href="\/kn\/methodology"/);
  assert.match(kn, /href="\/kn\/terms"/);
  // English footer keeps clean unprefixed links
  const en = renderHome(undefined, undefined, undefined, "en");
  assert.match(en, /href="\/about"/);
  assert.doesNotMatch(en, /href="\/en\//);
});

test("renderNotFound(kn): localized 404 with a coordinate example still linked", () => {
  const html = renderNotFound("kn");
  assert.match(html, /<html lang="kn">/);
  assert.match(html, /ಈ ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ/); // localized "Not here." header
  assert.match(html, /\/kn\/c\/12\.97,77\.59/); // example link is lang-prefixed
});

test("nav preserves language: home Popular + hero + recents carry the /kn prefix", () => {
  const hl = {
    hottest: { name: "Sitapur", state: "UP", lat: 27.5, lon: 80.7, apparent_c: 41, wet_bulb_c: 29 },
  } as unknown as Parameters<typeof renderHome>[1];
  const kn = renderHome(undefined, hl, { popular: [{ label: "Delhi", lat: 28.6, lon: 77.2 }] }, "kn");
  assert.match(kn, /href="\/kn\/c\/28\.6,77\.2"/); // Popular link
  assert.match(kn, /class="hl"[^>]*href="\/kn\/c\//); // hero highlight
  assert.match(kn, /var LP="\/kn"/); // client prefix
  assert.match(kn, /\+ ?LP ?\+ ?'\/c\/'/); // recents/autocomplete built with LP
  const en = renderHome(undefined, hl, { popular: [{ label: "Delhi", lat: 28.6, lon: 77.2 }] }, "en");
  assert.match(en, /var LP=""/);
  assert.match(en, /href="\/c\/28\.6,77\.2"/);
  assert.doesNotMatch(en, /\/en\/c\//);
});

test("conditions /c (kn): pills/Display prefixed; format words translit+localised; Sources localised", () => {
  const html = renderConditionsPage(cond(), "everyone", "https://mugilu.live/c/28.61,77.21", "kn");
  assert.match(html, /<html lang="kn">/);
  assert.match(html, /href="\/kn\/c\/28\.61,77\.21\?as=asthma"/); // persona pill prefixed
  assert.match(html, />JSON<\/a>/); // format token stays Latin (typed/searched)
  assert.match(html, />ಪ್ರದರ್ಶನ<\/a>/); // Display (a plain word) localised
  assert.match(html, /href="\/kn\/c\/28\.61,77\.21\?kiosk"/); // Display link prefixed
  assert.match(html, /href="\/c\/28\.61,77\.21\.json"/); // data sibling stays unprefixed
  assert.match(html, /ಮೂಲಗಳು: CPCB/); // Sources localised, source names English
  assert.match(html, /ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ/); // disclaimer localised
});

test("conditions /c (en): unchanged — English format words, unprefixed links", () => {
  const html = renderConditionsPage(cond(), "everyone", "https://mugilu.live/c/28.61,77.21", "en");
  assert.match(html, />JSON<\/a>/);
  assert.match(html, />Display<\/a>/);
  assert.match(html, /Sources: CPCB/);
  assert.match(html, /href="\/c\/28\.61,77\.21\?as=asthma"/);
  assert.doesNotMatch(html, /\/en\/c\//);
});

test("display builder (kn): tiles + form + button carry the prefix / localise", () => {
  const html = renderDisplayBuilder("everyone", "kn");
  assert.match(html, /class="dtile" href="\/kn\/c\/[a-z]+\?kiosk"/); // tile prefixed
  assert.match(html, /action="\/kn\/go"/); // search form prefixed
  assert.match(html, /ಪ್ರದರ್ಶನವನ್ನು ತೆರೆಯಿರಿ/); // "Open display" localised
});

test("warnings (kn): heading + empty state localised", () => {
  const html = renderWarningsPage(null, "kn");
  assert.match(html, /ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು/); // heading
  assert.doesNotMatch(html, /No active national alerts/); // English empty-state gone
});

test("kiosk (?kiosk) is chromeless: no header bar, footer nav or language switcher bleeds through", () => {
  const html = renderKioskPage(cond(), "everyone", "https://mugilu.live/c/28.61,77.21", "<svg></svg>", "kn");
  assert.match(html, /<html lang="kn">/); // still localized + Indic fonts
  assert.match(html, /Noto Serif Kannada/);
  assert.doesNotMatch(html, /class="langsw"/); // no language switcher on a wall display
  assert.doesNotMatch(html, /class="foot"/); // no footer nav
  assert.doesNotMatch(html, /class="bar"/); // no header bar
});

test("renderAbout(kn): prose localized, proper nouns + brand Latin, gloss present; en unchanged", () => {
  const kn = renderAbout("kn");
  assert.match(kn, /<html lang="kn">/);
  assert.match(kn, /ಜನರಿಗೆ ಸಂಪೂರ್ಣ ಆಕಾಶದ ನೋಟ/); // lead
  assert.match(kn, /<span>mugilu ಏಕೆ<\/span>/); // heading, brand Latin
  assert.match(kn, /ಮುಕ್ತ ಆಕಾಶಕ್ಕೆ ಕನ್ನಡ ಪದ/); // the meaning gloss
  assert.match(kn, /ಡೆವಲಪರ್‌ಗಳಿಗೆ/); // developer label (tech, not property)
  assert.match(kn, /CPCB/); // proper nouns stay Latin
  assert.doesNotMatch(kn, /ಶಾಖ|ಪರದೆ|ಗಿಟ್‌ಹೌಸ್/); // no reverted-vocab / GitHouse
  assert.match(kn, /MCP ಸರ್ವರ್/); // "Build on it" list DETAIL localized (MCP token Latin)
  assert.doesNotMatch(kn, /tools for conditions|snapshot image/); // no English detail leaks
  assert.match(kn, /← mugilu ಗೆ ಹಿಂತಿರುಗಿ/); // back-link text localized
  const en = renderAbout("en");
  assert.match(en, /For years, people across India/); // English prose intact
  assert.match(en, /<b>CPCB<\/b>/); // English keeps inline markup
});

test("renderMethodology(kn): prose localized, acronyms + numbers Latin, links preserved; en unchanged", () => {
  const kn = renderMethodology("kn");
  assert.match(kn, /<html lang="kn">/);
  assert.match(kn, /ಪಾರದರ್ಶಕ ವ್ಯವಸ್ಥೆ/); // "glass box" rendered in the lead
  assert.match(kn, /ಮಿತಿಗಳು/); // "The thresholds" heading localized
  assert.match(kn, /ವಾಯುಗುಣ \(AQI\)/); // table label localized, acronym Latin
  assert.match(kn, /CPCB/); // proper nouns/acronyms stay Latin
  assert.match(kn, /WBGT/);
  assert.match(kn, /301\+/); // numeric thresholds stay Arabic numerals
  assert.match(kn, /score\.ts<\/a>/); // {score} slot filled, link preserved
  assert.match(kn, /href="\/kn\/terms"/); // {terms} link lang-prefixed
  assert.doesNotMatch(kn, /ಶಾಖ|ಪರದೆ/); // reverted-vocab guard (heat/screen)
  assert.doesNotMatch(kn, /\{score\}|\{terms\}/); // no unfilled slot leaks
  // English is byte-for-byte the pre-i18n page: inline markup + unprefixed link
  const en = renderMethodology("en");
  assert.match(en, /How the Ambient read works/);
  assert.match(en, /<b>worst<\/b>/);
  assert.match(en, /href="\/terms">terms &amp; attribution<\/a>/);
});

test("renderTerms(kn): prose localized, source names + brand Latin, links preserved; en unchanged", () => {
  const kn = renderTerms("kn");
  assert.match(kn, /<html lang="kn">/);
  assert.match(kn, /ಷರತ್ತುಗಳು ಮತ್ತು ಮನ್ನಣೆ/); // "Terms & attribution" heading localized
  assert.match(kn, /ಗೌಪ್ಯತೆ/); // "Privacy" heading localized
  assert.match(kn, /CPCB|OpenAQ|NASA FIRMS/); // source names stay Latin
  assert.match(kn, /Cloudflare Web Analytics/); // brand kept Latin in the privacy note
  assert.match(kn, /github\.com\/urbanmorph\/mugilu">ರೆಪೊಸಿಟರಿ<\/a>/); // {repo} slot filled + localized text
  assert.match(kn, /mdshare\.live">mdshare<\/a>\.?/); // {md} commons link preserved
  assert.doesNotMatch(kn, /ಶಾಖ|ಪರದೆ/); // reverted-vocab guard
  assert.doesNotMatch(kn, /\{repo\}|\{um\}|\{bl\}|\{md\}/); // no unfilled slot leaks
  assert.match(kn, /ಬ್ರೋಕರ್ ಮೂಲಕ/); // source-detail line localized (was English)
  assert.doesNotMatch(kn, /broker; plus OpenAQ|admin boundaries from/); // no English detail leaks
  assert.match(kn, /← mugilu ಗೆ ಹಿಂತಿರುಗಿ/); // back-link text localized
  // English is byte-for-byte the pre-i18n page: inline markup + entity + links intact
  const en = renderTerms("en");
  assert.match(en, /<h1 class="ahero">Terms &amp; attribution<\/h1>/);
  assert.match(en, /<b>code is MIT<\/b>/);
  assert.match(en, /A digital commons by <a href="https:\/\/urbanmorph\.com">urbanmorph<\/a>, alongside/);
});

test("SEO: titles + descriptions are value-forward and localized (en/kn)", () => {
  const en = renderAbout("en");
  assert.match(en, /<title>About mugilu: the open sky of India<\/title>/); // not the old "About: mugilu"
  // description front-loads the real value + keywords (so Google quotes it, not the disclaimer)
  assert.match(en, /<meta name="description" content="mugilu shows the air, heat, rain[^"]*/);
  assert.doesNotMatch(en, /<title>About: mugilu<\/title>/);
  const kn = renderAbout("kn");
  assert.match(kn, /<title>mugilu ಬಗ್ಗೆ: ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ<\/title>/); // localized title
  assert.match(kn, /<meta name="description" content="mugilu ಈಗ ಭಾರತದ/); // localized description
  // home + methodology titles localized too
  assert.match(renderMethodology("kn"), /<title>mugilu ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ: Ambient/);
  assert.match(renderHome(undefined, undefined, undefined, "hi"), /<title>mugilu: भारत में किसी भी बिंदु/);
});

test("prose pages (hi): Devanagari renders, proper nouns Latin, links + slots resolved", () => {
  const about = renderAbout("hi");
  assert.match(about, /<html lang="hi">/);
  assert.match(about, /Noto (Serif|Sans) Devanagari/); // Indic font override
  assert.match(about, /पूरे आकाश/); // lead localized (Sarvam + restore)
  assert.match(about, /mugilu/); // brand stays Latin, not मुगिलु
  assert.doesNotMatch(about, /मुगिल|मगुल|भारतल|सी\.पी\.सी/); // no residual transliteration
  const meth = renderMethodology("hi");
  assert.match(meth, /पारदर्शी व्यवस्था/); // "glass box" (hand-constructed, no Sarvam)
  assert.match(meth, /CPCB/); // acronyms Latin
  assert.match(meth, /301\+/); // numbers stay Latin
  assert.match(meth, /href="\/hi\/terms"/); // {terms} slot filled, lang-prefixed
  assert.match(meth, /score\.ts<\/a>/); // {score} slot filled
  const terms = renderTerms("hi");
  assert.match(terms, /शर्तें और श्रेय/); // H1 localized
  assert.match(terms, /Cloudflare Web Analytics/); // brand Latin in privacy note
  assert.match(terms, /ब्रोकर के माध्यम से/); // source-detail line localized (hi)
  assert.match(about, /MCP सर्वर/); // "Build on it" detail localized (hi)
  assert.match(meth, /mugilu पर वापस/); // back-link localized (hi)
  assert.doesNotMatch(terms, /broker; plus OpenAQ|admin boundaries from/); // no English detail leak
  assert.match(terms, /urbanmorph\/mugilu">रिपॉजिटरी<\/a>/); // {repo} slot filled + localized
  for (const html of [about, meth, terms]) {
    assert.doesNotMatch(html, /\{score\}|\{terms\}|\{repo\}|\{um\}|\{bl\}|\{md\}/); // no slot leaks
  }
});
