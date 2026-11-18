import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDisplayBuilder, renderNotFound, renderWarningsPage, warningType } from "../src/page";
import { cycloneIn } from "../src/sachet";
import type { WarningsSnapshot } from "../src/sachet";
import { STANDARD_CSS } from "../src/ui/standard";

// Phase 2C of the signage redesign: /warnings, /display and the 404 page on the new shell
// (supporting-docs/redesign boards SignWarnings/DeskWarnings, SignDisplay/DeskDisplay,
// SignNotFound/DeskNotFound). Headlines are real ones from the SACHET feed, 18 Nov 2026.

const AVALANCHE =
  "Avalanche with low danger level is likely to occur above 2800 meters over Ganderbal in next 24 hours.";
const AKVAN =
  "The SEVERE CYCLONIC STORM AKVAN with maximum wind speed of 90-100 gusting to 110 Kmph lays centred at 1130 IST of 18.11.26 near latitude 13.1N and longitude 85.4E, 540 Km southeast of Narsapur, Andhra Pradesh. Cyclone Warning for Alluri Sitharama Raju, Anakapalli, Srikakulam, Visakhapatnam, Vizianagaram.";
const BENGALI =
  "নদীয়া জেলার কিছু অংশে রাত ৮:৫৩ থেকে আগামী ২-৩ ঘণ্টার মধ্যে বজ্রপাতসহ মাঝারি ধরনের বৃষ্টি ও তীব্র বৃষ্টির সম্ভাবনা রয়েছে।";
const TELUGU =
  "బంగాళాఖాతంలోని అక్వాన్ తుపాను ప్రభావంతో  రేపు మీ ప్రాంతంలో  ఈదురుగాలులతో కూడిన భారీ వర్షాలు కురిసే అవకాశం ఉంది.ప్రజలు అప్రమత్తంగా ఉండి తగిన జాగ్రత్తలు తీసుకోవాలి-ఆంధ్రప్రదేశ్ ప్రభుత్వం";
const LONG =
  "Lightning/Thunderstorms/Rainfall is Likely to occur over 17 districts of Jammu and Kashmir-Anantnag,Bandipora,Baramulla,Budgam,Doda,Ganderbal,Kishtwar,Kulgam,Kupwara,Poonch,Pulwama,Rajouri,Ramban,Reasi";

const alert = (id: string, headline: string, office: string, sent: string, link = "") => ({
  identifier: id,
  headline,
  category: "Met",
  issuer: `controlroom@ndma.gov.in (${office})`,
  link,
  sent,
});
const SNAP = {
  generated_at: "2026-11-18T12:05:00.000Z",
  count: 5,
  alerts: [
    alert("1", AKVAN, "IMD Visakhapatnam", "2026-11-18T16:47:00+05:30", "https://sachet.ndma.gov.in/cap/1"),
    alert("2", AVALANCHE, "DGRE Chandigarh", "2026-11-13T21:32:00+05:30"),
    alert("3", BENGALI, "IMD Kolkata", "2026-11-11T20:57:00+05:30"),
    alert("4", TELUGU, "Andhra Pradesh SDMA", "2026-11-18T17:23:00+05:30"),
    alert("5", LONG, "IMD Srinagar", "2026-11-17T09:40:00+05:30"),
  ],
} as unknown as WarningsSnapshot;

test("warningType: avalanche is tested first, so DGRE's 'danger level' is not a flood", () => {
  assert.equal(warningType(AVALANCHE), "avalanche");
  assert.equal(warningType("River Brahmaputra flowing above danger level at Dhubri."), "flood");
});

test("warningType: Bengali and Telugu headlines are sorted by hazard, not left under Other", () => {
  assert.equal(warningType(BENGALI), "storm");
  assert.notEqual(warningType(TELUGU), "other");
  // Odia (IMD Bhubaneswar): lightning with moderate rain
  assert.equal(
    warningType("ଭାରତ ପାଣିପାଗ ବିଭାଗର ସୂଚନା ଅନୁଯାୟୀ, ଆପଣଙ୍କ ଅଞ୍ଚଳରେ ବଜ୍ରପାତ ସହିତ ମଧ୍ୟମ ଧରଣର ବର୍ଷା ହେବାର ସମ୍ଭାବନା ଅଛି ।"),
    "storm",
  );
  // a sea-wave alert with no hazard word stays under Other, as its English equivalent does
  assert.equal(warningType("నవంబర్13సా.4.00 నుంచి సముద్రంలో 3-6.2 మీటర్ల ఎత్తులో భారీఅలలు వచ్చే అవకాశం ఉంది."), "other");
});

test("cycloneIn (the one source, as on /warnings): IMD's category and the storm's name, never the category alone", () => {
  assert.equal(cycloneIn(AKVAN)?.title, "Severe Cyclonic Storm Akvan");
  assert.equal(
    cycloneIn("Very Severe Cyclonic Storm 'Montha' moved north")?.title,
    "Very Severe Cyclonic Storm Montha",
  );
  assert.equal(cycloneIn("Cyclone warning for the coast")?.title, undefined);
  assert.equal(cycloneIn(AVALANCHE)?.title, undefined);
});

test("/warnings: the signage shell, the warning wash at high, the time it is from", () => {
  const html = renderWarningsPage(SNAP);
  assert.match(html, /<body class="mg" data-tint="Warning" data-level="high">/);
  assert.match(html, /<h1 class="t-title">Active warnings<\/h1>/);
  assert.match(html, /The latest 5 official NDMA \/ IMD alerts across India\./);
  assert.match(html, /<span class="k">As of<\/span><span class="v">17:35 IST · 18 Nov · via SACHET<\/span>/);
  assert.equal((html.match(/<style>/g) ?? []).length, 1, "only the shell's stylesheet");
  assert.match(html, /aria-current="page"[^>]*>Warnings|href="\/warnings" aria-current="page"/);
});

test("/warnings: no warnings is the live empty line and no wash", () => {
  const html = renderWarningsPage({ ...SNAP, alerts: [] } as WarningsSnapshot);
  assert.match(html, /<body class="mg">/);
  assert.match(html, /No active national alerts right now\./);
  assert.doesNotMatch(html, /class="fold"/);
  const none = renderWarningsPage(null);
  assert.match(none, /No active national alerts right now\./);
});

test("/warnings: a storm is pinned under IMD's category and name, and leaves its office's list", () => {
  const html = renderWarningsPage(SNAP);
  assert.match(html, /<h2 class="t-h2[^"]*"[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Severe Cyclonic Storm Akvan<\/h2>/);
  assert.doesNotMatch(html, /<h2 class="wgrp">IMD Visakhapatnam/);
  assert.doesNotMatch(html, />Severe cyclone/i);
});

test("/warnings: filters for each kind and office, with counts, in a fold; rows carry what they read", () => {
  const html = renderWarningsPage(SNAP);
  assert.match(html, /<details class="fold" id="wfilter"><summary>Filter warnings<span class="n">5<\/span>/);
  assert.match(html, /name="type" value="avalanche" checked><span>Avalanche<\/span><span class="c">1</);
  assert.match(html, /name="issuer" value="IMD Kolkata" checked><span>IMD Kolkata<\/span><span class="c">1</);
  assert.match(html, /<li class="wrow" data-type="avalanche" data-issuer="DGRE Chandigarh">/);
  assert.match(html, /<input type="search" id="wq"/);
});

test("/warnings: headlines keep their script and load its font; the CAP link is named in context", () => {
  const html = renderWarningsPage(SNAP);
  assert.match(html, /<p class="head" lang="te">/);
  assert.match(html, /<p class="head" lang="bn">/);
  assert.match(html, /font-family:'Anek Telugu'/);
  assert.match(html, /font-family:'Anek Bangla'/);
  assert.match(
    html,
    /<a href="https:\/\/sachet\.ndma\.gov\.in\/cap\/1" rel="noopener" aria-label="Original alert \(CAP\): IMD Visakhapatnam, 16:47 IST · 18 Nov">CAP<\/a>/,
  );
});

test("/warnings: groups newest first, the office with the newest alert first", () => {
  const html = renderWarningsPage(SNAP);
  const groups = [...html.matchAll(/<h2 class="wgrp">([^<]+)<span class="n">(\d+)<\/span><\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(groups, ["Andhra Pradesh SDMA", "IMD Srinagar", "DGRE Chandigarh", "IMD Kolkata"]);
});

test("/warnings (kn): the heading and the empty line are localised, links carry /kn", () => {
  const html = renderWarningsPage(null, "kn");
  assert.match(html, /ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು/);
  assert.doesNotMatch(html, /No active national alerts/);
  assert.match(html, /<p class="back"><a href="\/kn">/);
});

test("/display: title and intro beside a live preview of the chosen place and persona", () => {
  const html = renderDisplayBuilder("elderly");
  assert.match(html, /<body class="mg">/);
  assert.match(html, /<h1 class="t-title">Put mugilu on a screen\.<\/h1>/);
  assert.match(
    html,
    /<div class="lane l57">[\s\S]*class="pvframe"[\s\S]*<iframe[^>]+src="\/c\/bengaluru\?kiosk&amp;as=elderly"/,
  );
  assert.match(html, /<iframe[^>]+tabindex="-1"/);
  assert.equal((html.match(/<style>/g) ?? []).length, 1, "only the shell's stylesheet");
});

test("/display: step 1 searches any place (via /go, as a display) and offers 12 cities", () => {
  const html = renderDisplayBuilder("elderly");
  assert.match(html, /<form class="search"[^>]*action="\/go"/);
  assert.match(html, /<input type="hidden" name="kiosk" value="1"><input type="hidden" name="as" value="elderly">/);
  assert.match(html, /role="combobox"/);
  assert.equal((html.match(/<a href="\/c\/[a-z]+\?kiosk&amp;as=elderly" data-slug=/g) ?? []).length, 12);
  assert.match(html, /<button type="button" class="btn" id="dhere" hidden>/);
  assert.match(html, /A display can show a city, a neighbourhood or an exact point\./);
});

test("/display: step 2 is one Segmented for the six live personas; step 3 opens the display", () => {
  const html = renderDisplayBuilder("elderly");
  for (const p of ["Everyone", "Asthma &amp; lungs", "Older adults", "Children", "Outdoor workers", "Heart condition"])
    assert.match(html, new RegExp(`>${p}</label>`), p);
  assert.match(html, /<input type="radio" name="as" value="elderly" checked>/);
  assert.match(html, /<a class="btn primary" id="dopen" href="\/c\/bengaluru\?kiosk&amp;as=elderly">/);
  assert.match(html, /<code id="dlink">\/c\/bengaluru\?kiosk&amp;as=elderly<\/code>/);
});

test("/display: How it runs as four steps, and the URL note", () => {
  const html = renderDisplayBuilder();
  assert.equal((html.match(/<ol class="howto[^"]*">/g) ?? []).length, 1);
  assert.match(html, /Fully Kiosk/);
  assert.match(html, /The display link is just <code>\/c\/\{place\}\?kiosk<\/code>/);
});

test("/display (kn): tiles, the search and the button carry the prefix and localise", () => {
  const html = renderDisplayBuilder("everyone", "kn");
  assert.match(html, /<a href="\/kn\/c\/[a-z]+\?kiosk" data-slug=/);
  assert.match(html, /action="\/kn\/go"/);
  assert.match(html, /ಪ್ರದರ್ಶನವನ್ನು ತೆರೆಯಿರಿ/);
});

test("404: the live copy, a place search and the way back", () => {
  const html = renderNotFound();
  assert.match(html, /<section class="nf"[^>]*>/);
  assert.match(html, /<h1 class="t-title">Not here\.<\/h1>/);
  assert.match(html, /give it a coordinate like <a href="\/c\/12\.97,77\.59">\/c\/12\.97,77\.59<\/a>/);
  assert.match(html, /<form class="search"[^>]*action="\/go"/);
  assert.match(html, /<label for="nq">Look up a place in India<\/label>/);
  assert.match(html, /placeholder="A place in India, or lat,lon"/);
  assert.match(html, /← back to mugilu/);
});

test("the install sheet shows only when opened (it is not the board specimen)", () => {
  assert.match(STANDARD_CSS, /\.mg dialog\.isheet:not\(\[open\]\)\{display:none\}/);
  assert.match(STANDARD_CSS, /\.mg dialog\.isheet\[open\]\{position:fixed;/);
});

test("404 (kn): localised, the example link prefixed", () => {
  const html = renderNotFound("kn");
  assert.match(html, /<html lang="kn">/);
  assert.match(html, /ಈ ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ/);
  assert.match(html, /\/kn\/c\/12\.97,77\.59/);
});
