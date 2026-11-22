// Language scaffolding for mugilu (en + hi + kn; more via [[localisation-method-sarvam]]).
//
// The KEY is the English source string: t("Popular:", lang). An unwired or
// untranslated string falls back to English automatically, so pages can be
// localised incrementally. hi and kn follow the words IMD, NDMA and KSNDMC use in
// their own bulletins (no native reviewer yet). To add a language L: extend Lang/LANGS/LANG_NAME
// and fill TR[...][L]. Brand terms (mugilu, SACHET, NDMA, IMD, QR) stay in Latin.

import { HAZARDS, HAZARDS_SHORT, SITE_DESC } from "./hazards";
import { esc } from "./html";

// The hazard lists (hazards.ts) in hi and kn, so every localised string that names them says the same list.
const HAZARDS_TR = {
  hi: "वायु, गर्मी, ठंड, बारिश, हवा, कोहरा, धूल, धुआं, UV और आधिकारिक चेतावनियाँ",
  kn: "ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಮಳೆ, ಗಾಳಿ, ಮಂಜು, ಧೂಳು, ಹೊಗೆ, UV ಮತ್ತು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು",
};
const HAZARDS_SHORT_TR = {
  hi: "वायु, गर्मी, ठंड, कोहरा और चेतावनियाँ",
  kn: "ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಮಂಜು ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳು",
};

export type Lang = "en" | "hi" | "kn";
export const LANGS: readonly Lang[] = ["en", "hi", "kn"] as const;
export const LANG_NAME: Record<Lang, string> = {
  en: "English",
  hi: "\u0939\u093f\u0902\u0926\u0940",
  kn: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1",
};

/** The language a piece of quoted text is written in, from its script ("en" for Latin;
 *  "" when it has no letters). Official warnings are quoted as issued, in any of these. */
export function scriptLang(s: string): string {
  if (/[\u0C00-\u0C7F]/.test(s)) return "te";
  if (/[\u0980-\u09FF]/.test(s)) return "bn";
  if (/[\u0B00-\u0B7F]/.test(s)) return "or";
  if (/[\u0C80-\u0CFF]/.test(s)) return "kn";
  if (/[\u0900-\u097F]/.test(s)) return "hi";
  return /[A-Za-z]/.test(s) ? "en" : "";
}

/** ` lang="xx"` when quoted text is in another language than the page, so a screen reader
 *  reads it in the right voice; "" when it is the page's own. */
export function langAttr(s: string, page: Lang): string {
  const l = scriptLang(s);
  return l && l !== page ? ` lang="${l}"` : "";
}

/** Quoted text, escaped, in a span marked with its language only when it differs from the page's. */
export function quoted(s: string, page: Lang): string {
  const a = langAttr(s, page);
  return a ? `<span${a}>${esc(s)}</span>` : esc(s);
}

// Path prefix. English stays unprefixed so its URLs remain the clean canonical.
export function lp(path: string, lang: Lang): string {
  if (lang === "en") return path;
  return "/" + lang + (path === "/" ? "" : path);
}

// Insert the language prefix into a full canonical URL (hreflang / switcher / og:url).
export function langUrl(canonical: string, lang: Lang): string {
  const u = new URL(canonical);
  const base = u.pathname === "/" ? "/" : u.pathname.replace(/\/$/, "");
  const p = lp(base, lang);
  return u.origin + (p === "/" ? "" : p) + u.search;
}

// en -> { hi, kn }. Generated from the native-reviewed sheets; edit there and regenerate.
export const TR: Record<string, Partial<Record<Exclude<Lang, "en">, string>>> = {
  // ── Signage redesign: new English strings (supporting-docs/redesign copy ledger).
  // hi/kn from the 2026-11-19 language pass (Bhashini drafts, reviewed terms, IMD usage).
  "Skip to content": { hi: "मुख्य सामग्री पर जाएँ", kn: "ಮುಖ್ಯ ವಿಷಯಕ್ಕೆ ಹೋಗಿ" },
  Language: { hi: "भाषा", kn: "ಭಾಷೆ" },
  Site: { hi: "साइट", kn: "ಸೈಟ್" },
  Theme: { hi: "थीम", kn: "ಥೀಮ್" },
  Light: { hi: "हल्की", kn: "ಲೈಟ್" },
  Dark: { hi: "गहरी", kn: "ಡಾರ್ಕ್" },
  System: { hi: "सिस्टम", kn: "ಸಿಸ್ಟಂ" },
  "Under an official warning now": { hi: "अभी आधिकारिक चेतावनी के अंतर्गत", kn: "ಈಗ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಯಡಿ" },
  // IMD's cyclone categories (cycloneTitle): IMD's Hindi bulletin terms; Kannada ಚಂಡಮಾರುತ as IMD Bengaluru / KSNDMC write it.
  "Cyclonic Storm": { hi: "चक्रवाती तूफान", kn: "ಚಂಡಮಾರುತ" },
  "Severe Cyclonic Storm": { hi: "गंभीर चक्रवाती तूफान", kn: "ತೀವ್ರ ಚಂಡಮಾರುತ" },
  "Very Severe Cyclonic Storm": { hi: "अति गंभीर चक्रवाती तूफान", kn: "ಅತಿ ತೀವ್ರ ಚಂಡಮಾರುತ" },
  "Extremely Severe Cyclonic Storm": { hi: "अत्यंत गंभीर चक्रवाती तूफान", kn: "ಅತ್ಯಂತ ತೀವ್ರ ಚಂಡಮಾರುತ" },
  "Super Cyclonic Storm": { hi: "सुपर चक्रवाती तूफान", kn: "ಸೂಪರ್ ಚಂಡಮಾರುತ" },
  // the kiosk's title and description, the JTWC credit on /terms
  // /warnings: its schema.org Dataset.
  "Active official warnings in India": {
    hi: "भारत में लागू आधिकारिक चेतावनियाँ",
    kn: "ಭಾರತದಲ್ಲಿ ಜಾರಿಯಲ್ಲಿರುವ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು",
  },
  // /methodology: the map section.
  "The map": { hi: "मानचित्र", kn: "ನಕ್ಷೆ" },
  "The map of India on the home page uses the same four levels. When official warnings are in force, it opens on them: each warned area takes its level from the severity IMD or NDMA gives in the alert. Where warnings overlap, the higher level is on top. Otherwise it opens on what is worst.":
    {
      hi: "होम पेज पर भारत का मानचित्र यही चार स्तर इस्तेमाल करता है। जब आधिकारिक चेतावनियाँ लागू हों, तो मानचित्र उन्हीं पर खुलता है: चेतावनी वाला हर इलाका अपना स्तर उस गंभीरता से लेता है जो IMD या NDMA चेतावनी में देते हैं। जहाँ चेतावनियाँ एक-दूसरे पर पड़ती हैं, वहाँ ऊँचा स्तर ऊपर दिखता है। वरना मानचित्र सबसे बुरे हाल पर खुलता है।",
      kn: "ಮುಖಪುಟದಲ್ಲಿರುವ ಭಾರತದ ನಕ್ಷೆ ಇದೇ ನಾಲ್ಕು ಮಟ್ಟಗಳನ್ನು ಬಳಸುತ್ತದೆ. ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು ಜಾರಿಯಲ್ಲಿದ್ದಾಗ ನಕ್ಷೆ ಅವುಗಳ ಮೇಲೆ ತೆರೆಯುತ್ತದೆ: ಎಚ್ಚರಿಕೆಯಿರುವ ಪ್ರತಿ ಪ್ರದೇಶವು IMD ಅಥವಾ NDMA ಎಚ್ಚರಿಕೆಯಲ್ಲಿ ನೀಡುವ ತೀವ್ರತೆಯಿಂದ ತನ್ನ ಮಟ್ಟವನ್ನು ಪಡೆಯುತ್ತದೆ. ಎಚ್ಚರಿಕೆಗಳು ಒಂದರ ಮೇಲೊಂದು ಬಿದ್ದಲ್ಲಿ, ಹೆಚ್ಚಿನ ಮಟ್ಟ ಮೇಲೆ ಕಾಣುತ್ತದೆ. ಇಲ್ಲದಿದ್ದರೆ ನಕ್ಷೆ ಅತಿ ಕೆಟ್ಟದ್ದರ ಮೇಲೆ ತೆರೆಯುತ್ತದೆ.",
    },
  // CAP severity words, as the alert gives them (Severe and Moderate are the level words).
  Extreme: { hi: "अत्यधिक", kn: "ಅತಿ ತೀವ್ರ" },
  Minor: { hi: "मामूली", kn: "ಸಣ್ಣ" },
  "Severity in the alert": { hi: "चेतावनी में गंभीरता", kn: "ಎಚ್ಚರಿಕೆಯಲ್ಲಿನ ತೀವ್ರತೆ" },
  "Level on the map": { hi: "मानचित्र पर स्तर", kn: "ನಕ್ಷೆಯಲ್ಲಿನ ಮಟ್ಟ" },
  "Any other": { hi: "कोई और", kn: "ಬೇರೆ ಯಾವುದೇ" },
  // The place page's schema.org Dataset (its name and description).
  "Sky conditions at {place}": { hi: "{place}: आसमान का हाल", kn: "{place}: ಆಕಾಶದ ಸ್ಥಿತಿ" },
  [`The ${HAZARDS} at {place}, India, right now.`]: {
    hi: `{place}, भारत में अभी ${HAZARDS_TR.hi}।`,
    kn: `{place}, ಭಾರತದಲ್ಲಿ ಈಗಿನ ${HAZARDS_TR.kn}.`,
  },
  "{place} on a screen": { hi: "{place} स्क्रीन पर", kn: "{place} ಸ್ಕ್ರೀನ್ ಮೇಲೆ" },
  "{place}: a live wall-display of the whole sky over this spot, self-refreshing.": {
    hi: "{place}: इस जगह के ऊपर के पूरे आसमान का लाइव वॉल डिस्प्ले, जो अपने आप ताज़ा होता है।",
    kn: "{place}: ಈ ಸ್ಥಳದ ಮೇಲಿನ ಇಡೀ ಆಕಾಶದ ಲೈವ್ ಗೋಡೆ ಸ್ಕ್ರೀನ್, ತಾನಾಗಿಯೇ ರಿಫ್ರೆಶ್ ಆಗುತ್ತದೆ.",
  },
  "{jtwc} (US Navy and Air Force).": {
    hi: "{jtwc} (अमेरिकी नौसेना और वायु सेना)।",
    kn: "{jtwc} (ಅಮೆರಿಕ ನೌಕಾಪಡೆ ಮತ್ತು ವಾಯುಪಡೆ).",
  },
  // Fix round 1: strings that reached hi/kn pages without a key.
  "MCP server for AI assistants": { hi: "AI सहायकों के लिए MCP सर्वर", kn: "AI ಸಹಾಯಕರಿಗಾಗಿ MCP ಸರ್ವರ್" },
  "Connect Claude, Cursor or any MCP client to mugilu: live {hazards} for any place in India. No key, read only.": {
    hi: "Claude, Cursor या किसी भी MCP क्लाइंट को mugilu से जोड़ें: भारत में किसी भी जगह के लिए {hazards} की लाइव जानकारी। कोई कुंजी नहीं, केवल पढ़ने के लिए।",
    kn: "Claude, Cursor ಅಥವಾ ಯಾವುದೇ MCP ಕ್ಲೈಂಟ್ ಅನ್ನು mugilu ಗೆ ಸಂಪರ್ಕಿಸಿ: ಭಾರತದ ಯಾವುದೇ ಸ್ಥಳದ {hazards} ಕುರಿತ ಲೈವ್ ಮಾಹಿತಿ. ಯಾವುದೇ ಕೀ ಬೇಕಿಲ್ಲ, ಓದಲು ಮಾತ್ರ.",
  },
  "Active NDMA / IMD warnings across India right now, mirrored from the SACHET feed. Available as HTML, JSON and Markdown.":
    {
      hi: "अभी पूरे भारत में सक्रिय NDMA / IMD चेतावनियाँ, SACHET फ़ीड से ली गईं। HTML, JSON और Markdown में उपलब्ध।",
      kn: "ಈಗ ಭಾರತದಾದ್ಯಂತ ಸಕ್ರಿಯವಾಗಿರುವ NDMA / IMD ಎಚ್ಚರಿಕೆಗಳು, SACHET ಫೀಡ್‌ನಿಂದ ಪಡೆದವು. HTML, JSON ಮತ್ತು Markdown ರೂಪದಲ್ಲಿ ಲಭ್ಯ.",
    },
  // /warnings in the searched words, its one-line summary, and IMD's colour code.
  "Weather warnings in India today: IMD and NDMA alerts by state": {
    hi: "भारत में आज मौसम की चेतावनी: राज्यवार IMD और NDMA अलर्ट",
    kn: "ಭಾರತದಲ್ಲಿ ಇಂದಿನ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆಗಳು: ರಾಜ್ಯವಾರು IMD ಮತ್ತು NDMA ಅಲರ್ಟ್",
  },
  "Official weather warnings across India now": {
    hi: "भारत में अभी आधिकारिक मौसम चेतावनियाँ",
    kn: "ಭಾರತದಲ್ಲಿ ಈಗಿನ ಅಧಿಕೃತ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆಗಳು",
  },
  "The warnings in force now cover 1 place in 1 state.": {
    hi: "अभी लागू चेतावनियाँ 1 राज्य की 1 जगह पर हैं।",
    kn: "ಈಗ ಜಾರಿಯಲ್ಲಿರುವ ಎಚ್ಚರಿಕೆಗಳು 1 ರಾಜ್ಯದ 1 ಸ್ಥಳಕ್ಕೆ ಅನ್ವಯಿಸುತ್ತವೆ.",
  },
  "The warnings in force now cover {p} places in 1 state.": {
    hi: "अभी लागू चेतावनियाँ 1 राज्य की {p} जगहों पर हैं।",
    kn: "ಈಗ ಜಾರಿಯಲ್ಲಿರುವ ಎಚ್ಚರಿಕೆಗಳು 1 ರಾಜ್ಯದ {p} ಸ್ಥಳಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತವೆ.",
  },
  "The warnings in force now cover {p} places in {s} states.": {
    hi: "अभी लागू चेतावनियाँ {s} राज्यों की {p} जगहों पर हैं।",
    kn: "ಈಗ ಜಾರಿಯಲ್ಲಿರುವ ಎಚ್ಚರಿಕೆಗಳು {s} ರಾಜ್ಯಗಳ {p} ಸ್ಥಳಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತವೆ.",
  },
  "Most common type: {kind}.": { hi: "सबसे आम प्रकार: {kind}।", kn: "ಹೆಚ್ಚಾಗಿ ಕಂಡ ಪ್ರಕಾರ: {kind}." },
  "Places under a warning now, by state": {
    hi: "अभी चेतावनी वाली जगहें, राज्यवार",
    kn: "ಈಗ ಎಚ್ಚರಿಕೆಯಲ್ಲಿರುವ ಸ್ಥಳಗಳು, ರಾಜ್ಯವಾರು",
  },
  "Yellow, orange and red: what they mean": {
    hi: "येलो, ऑरेंज और रेड अलर्ट: इनका मतलब",
    kn: "ಯೆಲ್ಲೋ, ಆರೆಂಜ್ ಮತ್ತು ರೆಡ್ ಅಲರ್ಟ್: ಇವುಗಳ ಅರ್ಥ",
  },
  Green: { hi: "हरा (ग्रीन)", kn: "ಹಸಿರು (ಗ್ರೀನ್)" },
  Yellow: { hi: "पीला (येलो)", kn: "ಹಳದಿ (ಯೆಲ್ಲೋ)" },
  Orange: { hi: "नारंगी (ऑरेंज)", kn: "ಕಿತ್ತಳೆ (ಆರೆಂಜ್)" },
  Red: { hi: "लाल (रेड)", kn: "ಕೆಂಪು (ರೆಡ್)" },
  "No warning. No action is needed.": {
    hi: "कोई चेतावनी नहीं। कुछ करने की ज़रूरत नहीं।",
    kn: "ಯಾವುದೇ ಎಚ್ಚರಿಕೆ ಇಲ್ಲ. ಯಾವುದೇ ಕ್ರಮ ಬೇಕಿಲ್ಲ.",
  },
  "Be updated. The weather can turn bad. Watch for updates.": {
    hi: "अपडेट रहें। मौसम खराब हो सकता है। नई जानकारी देखते रहें।",
    kn: "ಮಾಹಿತಿ ಪಡೆಯುತ್ತಿರಿ. ಹವಾಮಾನ ಕೆಡಬಹುದು. ಹೊಸ ಮಾಹಿತಿಯನ್ನು ಗಮನಿಸಿ.",
  },
  "Be prepared. Bad weather is expected. Be ready to act.": {
    hi: "तैयार रहें। खराब मौसम की संभावना है। कदम उठाने को तैयार रहें।",
    kn: "ಸಿದ್ಧರಾಗಿರಿ. ಕೆಟ್ಟ ಹವಾಮಾನ ನಿರೀಕ್ಷಿತ. ಕ್ರಮಕ್ಕೆ ಸಿದ್ಧರಾಗಿರಿ.",
  },
  "Take action. Dangerous weather is expected. Follow official advice.": {
    hi: "कार्रवाई करें। खतरनाक मौसम की संभावना है। आधिकारिक सलाह मानें।",
    kn: "ಕ್ರಮ ಕೈಗೊಳ್ಳಿ. ಅಪಾಯಕಾರಿ ಹವಾಮಾನ ನಿರೀಕ್ಷಿತ. ಅಧಿಕೃತ ಸಲಹೆಯನ್ನು ಪಾಲಿಸಿ.",
  },
  'IMD says a red warning does not mean a "red alert". It means "take action".': {
    hi: 'IMD के अनुसार रेड चेतावनी का मतलब "रेड अलर्ट" नहीं है। इसका मतलब है "कार्रवाई करें"।',
    kn: 'IMD ಪ್ರಕಾರ ರೆಡ್ ಎಚ್ಚರಿಕೆ ಎಂದರೆ "ರೆಡ್ ಅಲರ್ಟ್" ಅಲ್ಲ. ಅದರ ಅರ್ಥ "ಕ್ರಮ ಕೈಗೊಳ್ಳಿ".',
  },
  "A colour is for one area and one time. Open a place to see the warnings over it and their colour.": {
    hi: "हर रंग एक क्षेत्र और एक समय के लिए होता है। किसी जगह की चेतावनियाँ और उनका रंग देखने के लिए वह जगह खोलें।",
    kn: "ಪ್ರತಿ ಬಣ್ಣ ಒಂದು ಪ್ರದೇಶ ಮತ್ತು ಒಂದು ಸಮಯಕ್ಕೆ. ಒಂದು ಸ್ಥಳದ ಎಚ್ಚರಿಕೆಗಳು ಮತ್ತು ಅವುಗಳ ಬಣ್ಣ ನೋಡಲು ಆ ಸ್ಥಳವನ್ನು ತೆರೆಯಿರಿ.",
  },
  "Where the warnings come from": { hi: "चेतावनियाँ कहाँ से आती हैं", kn: "ಎಚ್ಚರಿಕೆಗಳು ಎಲ್ಲಿಂದ ಬರುತ್ತವೆ" },
  "IMD, other national agencies and the state disaster management authorities issue these warnings.": {
    hi: "ये चेतावनियाँ IMD, अन्य राष्ट्रीय एजेंसियाँ और राज्य आपदा प्रबंधन प्राधिकरण जारी करते हैं।",
    kn: "ಈ ಎಚ್ಚರಿಕೆಗಳನ್ನು IMD, ಇತರ ರಾಷ್ಟ್ರೀಯ ಸಂಸ್ಥೆಗಳು ಮತ್ತು ರಾಜ್ಯ ವಿಪತ್ತು ನಿರ್ವಹಣಾ ಪ್ರಾಧಿಕಾರಗಳು ನೀಡುತ್ತವೆ.",
  },
  "NDMA publishes them on SACHET, in the Common Alerting Protocol (CAP).": {
    hi: "NDMA इन्हें SACHET पर कॉमन अलर्टिंग प्रोटोकॉल (CAP) में प्रकाशित करता है।",
    kn: "NDMA ಇವುಗಳನ್ನು SACHET ನಲ್ಲಿ ಕಾಮನ್ ಅಲರ್ಟಿಂಗ್ ಪ್ರೋಟೋಕಾಲ್ (CAP) ರೂಪದಲ್ಲಿ ಪ್ರಕಟಿಸುತ್ತದೆ.",
  },
  "Turn any wall display or kiosk into a live, self-refreshing read of India's sky. Pick a place, open it on the screen, full-screen it. It updates itself.":
    {
      hi: "किसी भी दीवार की स्क्रीन या कियोस्क को भारत के आसमान की लाइव जानकारी में बदलें, जो अपने आप ताज़ा होती रहती है। कोई जगह चुनें, उसे स्क्रीन पर खोलें और पूरी स्क्रीन पर फैलाएँ। यह खुद अपडेट होती है।",
      kn: "ಯಾವುದೇ ಗೋಡೆಯ ಸ್ಕ್ರೀನ್ ಅಥವಾ ಕಿಯೋಸ್ಕ್ ಅನ್ನು ಭಾರತದ ಆಕಾಶದ ಲೈವ್ ಮಾಹಿತಿಯಾಗಿ ಬದಲಿಸಿ, ಅದು ತಾನಾಗಿಯೇ ರಿಫ್ರೆಶ್ ಆಗುತ್ತದೆ. ಒಂದು ಸ್ಥಳವನ್ನು ಆರಿಸಿ, ಅದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ತೆರೆಯಿರಿ, ಪೂರ್ಣ ಸ್ಕ್ರೀನ್ ಮಾಡಿ. ಅದು ತಾನಾಗಿಯೇ ನವೀಕರಿಸಿಕೊಳ್ಳುತ್ತದೆ.",
    },
  Readings: { hi: "आँकड़े", kn: "ಮಾಹಿತಿ" },
  JSON: { hi: "JSON", kn: "JSON" },
  Markdown: { hi: "Markdown", kn: "Markdown" },
  PNG: { hi: "PNG", kn: "PNG" },
  Embed: { hi: "एम्बेड", kn: "ಎಂಬೆಡ್" },
  "Prominent pollutant: {pollutant}": { hi: "प्रमुख प्रदूषक: {pollutant}", kn: "ಪ್ರಮುಖ ಮಾಲಿನ್ಯಕಾರಕ: {pollutant}" },
  "Ambient · {persona}": { hi: "Ambient · {persona}", kn: "Ambient · {persona}" },
  "Each square, about 100 km across, has the colour of what is worst in it, where that is high or severe. Air includes smoke and dust.":
    {
      hi: "हर वर्ग (लगभग 100 km चौड़ा) का रंग वहाँ की सबसे बुरी चीज़ का है, जहाँ वह अधिक या गंभीर हो। वायु में धुआं और धूल भी शामिल हैं।",
      kn: "ಪ್ರತಿ ಚೌಕಕ್ಕೆ (ಸುಮಾರು 100 km) ಅಲ್ಲಿನ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದರ ಬಣ್ಣವಿದೆ, ಅದು ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರವಾಗಿದ್ದಲ್ಲಿ. ವಾಯು ಗುಣಮಟ್ಟದಲ್ಲಿ ಹೊಗೆ ಮತ್ತು ಧೂಳು ಸೇರಿವೆ.",
    },
  "The display link is just {link}, so you can bookmark or script it. Add {as} (or asthma, child, outdoor, heart) to weight the read for a clinic, school or worksite.":
    {
      hi: "डिस्प्ले का लिंक बस {link} है, इसलिए आप इसे बुकमार्क कर सकते हैं या स्क्रिप्ट में इस्तेमाल कर सकते हैं। किसी क्लिनिक, स्कूल या कार्यस्थल के हिसाब से रीडिंग के लिए {as} (या asthma, child, outdoor, heart) जोड़ें।",
      kn: "ಪ್ರದರ್ಶನದ ಲಿಂಕ್ ಕೇವಲ {link}, ಹಾಗಾಗಿ ನೀವು ಅದನ್ನು ಬುಕ್‌ಮಾರ್ಕ್ ಮಾಡಬಹುದು ಅಥವಾ ಸ್ಕ್ರಿಪ್ಟ್‌ನಲ್ಲಿ ಬಳಸಬಹುದು. ಕ್ಲಿನಿಕ್, ಶಾಲೆ ಅಥವಾ ಕೆಲಸದ ಸ್ಥಳಕ್ಕೆ ತಕ್ಕಂತೆ ಓದುವಿಕೆಗಾಗಿ {as} (ಅಥವಾ asthma, child, outdoor, heart) ಸೇರಿಸಿ.",
    },
  // The Terms privacy box labels.
  Accounts: { hi: "खाते", kn: "ಖಾತೆಗಳು" },
  "Usage counts": { hi: "उपयोग की गिनती", kn: "ಬಳಕೆಯ ಎಣಿಕೆ" },
  Analytics: { hi: "विश्लेषण", kn: "ವಿಶ್ಲೇಷಣೆ" },
  "Saved places": { hi: "सहेजी गई जगहें", kn: "ಉಳಿಸಿದ ಸ್ಥಳಗಳು" },
  Alerts: { hi: "अलर्ट", kn: "ಅಲರ್ಟ್‌ಗಳು" },
  // /warnings, /display, 404, and the search combobox
  "As of": { hi: "स्थिति", kn: "ಸ್ಥಿತಿ" },
  Avalanche: { hi: "हिमस्खलन", kn: "ಹಿಮಕುಸಿತ" },
  Preview: { hi: "पूर्वावलोकन", kn: "ಮುನ್ನೋಟ" },
  "{n} places": { hi: "{n} जगहें", kn: "{n} ಸ್ಥಳಗಳು" },
  "No place in India matches that. Try another spelling, or a lat,lon.": {
    hi: "भारत में ऐसी कोई जगह नहीं मिली। कोई और वर्तनी आज़माएँ, या अक्षांश, देशांतर दें।",
    kn: "ಭಾರತದಲ್ಲಿ ಇದಕ್ಕೆ ಹೊಂದುವ ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ. ಬೇರೆ ಕಾಗುಣಿತ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಅಕ್ಷಾಂಶ, ರೇಖಾಂಶ ನೀಡಿ.",
  },
  "Original alert (CAP): {issuer}, {time}": {
    hi: "मूल चेतावनी (CAP): {issuer}, {time}",
    kn: "ಮೂಲ ಎಚ್ಚರಿಕೆ (CAP): {issuer}, {time}",
  },
  // home, /places and the IndiaMap (stamps, summaries, descriptions, the not-ready state)
  "Map layer": { hi: "मानचित्र की परत", kn: "ನಕ್ಷೆಯ ಪದರ" },
  "Squares, heat and rain": { hi: "वर्ग, गर्मी और बारिश", kn: "ಚೌಕಗಳು, ಬಿಸಿಲು ಮತ್ತು ಮಳೆ" },
  "Air station dots": { hi: "वायु केंद्रों के बिंदु", kn: "ವಾಯು ಕೇಂದ್ರಗಳ ಚುಕ್ಕೆಗಳು" },
  "The air dots are about an hour newer than the squares.": {
    hi: "वायु के बिंदु वर्गों से लगभग एक घंटा नए हैं।",
    kn: "ವಾಯು ಚುಕ್ಕೆಗಳು ಚೌಕಗಳಿಗಿಂತ ಸುಮಾರು ಒಂದು ಗಂಟೆ ಹೊಸವು.",
  },
  "The air dots are about X hours newer than the squares.": {
    hi: "वायु के बिंदु वर्गों से लगभग X घंटे नए हैं।",
    kn: "ವಾಯು ಚುಕ್ಕೆಗಳು ಚೌಕಗಳಿಗಿಂತ ಸುಮಾರು X ಗಂಟೆ ಹೊಸವು.",
  },
  "The squares are about an hour newer than the air dots.": {
    hi: "वर्ग वायु के बिंदुओं से लगभग एक घंटा नए हैं।",
    kn: "ಚೌಕಗಳು ವಾಯು ಚುಕ್ಕೆಗಳಿಗಿಂತ ಸುಮಾರು ಒಂದು ಗಂಟೆ ಹೊಸವು.",
  },
  "The squares are about X hours newer than the air dots.": {
    hi: "वर्ग वायु के बिंदुओं से लगभग X घंटे नए हैं।",
    kn: "ಚೌಕಗಳು ವಾಯು ಚುಕ್ಕೆಗಳಿಗಿಂತ ಸುಮಾರು X ಗಂಟೆ ಹೊಸವು.",
  },
  "Each square, about 100 km across, has the colour of what is worst in it, where that is high or severe. Air includes smoke and dust. Select a square, or pick a place from the list below.":
    {
      hi: "हर वर्ग (लगभग 100 km चौड़ा) का रंग वहाँ की सबसे बुरी चीज़ का है, जहाँ वह अधिक या गंभीर हो। वायु में धुआं और धूल भी शामिल हैं। कोई वर्ग चुनें, या नीचे की सूची से कोई जगह चुनें।",
      kn: "ಪ್ರತಿ ಚೌಕಕ್ಕೆ (ಸುಮಾರು 100 km) ಅಲ್ಲಿನ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದರ ಬಣ್ಣವಿದೆ, ಅದು ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರವಾಗಿದ್ದಲ್ಲಿ. ವಾಯು ಗುಣಮಟ್ಟದಲ್ಲಿ ಹೊಗೆ ಮತ್ತು ಧೂಳು ಸೇರಿವೆ. ಒಂದು ಚೌಕವನ್ನು ಆಯ್ಕೆಮಾಡಿ, ಅಥವಾ ಕೆಳಗಿನ ಪಟ್ಟಿಯಿಂದ ಒಂದು ಸ್ಥಳವನ್ನು ಆರಿಸಿ.",
    },
  "Map of India. Each dot is an air station, coloured by its reading.": {
    hi: "भारत का मानचित्र। हर बिंदु एक वायु केंद्र है, जिसका रंग उसके आँकड़ों के अनुसार है।",
    kn: "ಭಾರತದ ನಕ್ಷೆ. ಪ್ರತಿ ಚುಕ್ಕೆ ಒಂದು ವಾಯು ಕೇಂದ್ರ; ಅದರ ಬಣ್ಣ ಅದರ ಮಾಪನವನ್ನು ತೋರಿಸುತ್ತದೆ.",
  },
  // The map's official warnings layer (IMD/NDMA usage: लागू, ಜಾರಿಯಲ್ಲಿ for "in force").
  "Map of India. Each coloured area is under an official warning now.": {
    hi: "भारत का मानचित्र। हर रंगीन क्षेत्र पर अभी आधिकारिक चेतावनी लागू है।",
    kn: "ಭಾರತದ ನಕ್ಷೆ. ಪ್ರತಿ ಬಣ್ಣದ ಪ್ರದೇಶದಲ್ಲಿ ಈಗ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಜಾರಿಯಲ್ಲಿದೆ.",
  },
  "Areas under an official warning from NDMA or IMD, by the level it gives. Where warnings overlap, the higher level is on top. Select an area to see all warnings.":
    {
      hi: "NDMA या IMD की आधिकारिक चेतावनी वाले क्षेत्र, चेतावनी में दिए स्तर के अनुसार। जहाँ चेतावनियाँ एक-दूसरे पर पड़ती हैं, वहाँ ऊँचा स्तर ऊपर दिखता है। सभी चेतावनियाँ देखने के लिए कोई क्षेत्र चुनें।",
      kn: "NDMA ಅಥವಾ IMD ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ನೀಡಿರುವ ಪ್ರದೇಶಗಳು, ಎಚ್ಚರಿಕೆಯಲ್ಲಿ ನೀಡಿದ ಮಟ್ಟದ ಪ್ರಕಾರ. ಎಚ್ಚರಿಕೆಗಳು ಒಂದರ ಮೇಲೊಂದು ಬಂದಲ್ಲಿ, ಹೆಚ್ಚಿನ ಮಟ್ಟ ಮೇಲೆ ಕಾಣುತ್ತದೆ. ಎಲ್ಲಾ ಎಚ್ಚರಿಕೆಗಳನ್ನು ನೋಡಲು ಒಂದು ಪ್ರದೇಶವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    },
  "1 official warning is in force.": {
    hi: "1 आधिकारिक चेतावनी लागू है।",
    kn: "1 ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಜಾರಿಯಲ್ಲಿದೆ.",
  },
  "X official warnings are in force.": {
    hi: "X आधिकारिक चेतावनियाँ लागू हैं।",
    kn: "X ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು ಜಾರಿಯಲ್ಲಿವೆ.",
  },
  "No official warnings are on the map now.": {
    hi: "अभी मानचित्र पर कोई आधिकारिक चेतावनी नहीं है।",
    kn: "ಈಗ ನಕ್ಷೆಯಲ್ಲಿ ಯಾವುದೇ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಇಲ್ಲ.",
  },
  "Map of India. Each square is coloured by its heat level.": {
    hi: "भारत का मानचित्र। हर वर्ग का रंग वहाँ की गर्मी के स्तर को दिखाता है।",
    kn: "ಭಾರತದ ನಕ್ಷೆ. ಪ್ರತಿ ಚೌಕದ ಬಣ್ಣ ಅಲ್ಲಿನ ಬಿಸಿಲಿನ ಮಟ್ಟವನ್ನು ತೋರಿಸುತ್ತದೆ.",
  },
  "Map of India. Each square is coloured by the rain forecast for the next 24 hours.": {
    hi: "भारत का मानचित्र। हर वर्ग का रंग अगले 24 घंटों के बारिश के पूर्वानुमान को दिखाता है।",
    kn: "ಭಾರತದ ನಕ್ಷೆ. ಪ್ರತಿ ಚೌಕದ ಬಣ್ಣ ಮುಂದಿನ 24 ಗಂಟೆಗಳ ಮಳೆಯ ಮುನ್ಸೂಚನೆಯನ್ನು ತೋರಿಸುತ್ತದೆ.",
  },
  "1 square": { hi: "1 वर्ग में", kn: "1 ಚೌಕದಲ್ಲಿ" },
  "X squares": { hi: "X वर्गों में", kn: "X ಚೌಕಗಳಲ್ಲಿ" },
  and: { hi: "और", kn: "ಮತ್ತು" },
  "Air is high or severe in X.": { hi: "X वायु प्रदूषण अधिक या गंभीर है।", kn: "X ವಾಯು ಮಾಲಿನ್ಯ ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರವಾಗಿದೆ." },
  "Heat is high or severe in X.": { hi: "X गर्मी अधिक या गंभीर है।", kn: "X ಬಿಸಿಲು ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರವಾಗಿದೆ." },
  "Cold is high or severe in X.": { hi: "X ठंड अधिक या गंभीर है।", kn: "X ಚಳಿ ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರವಾಗಿದೆ." },
  "Nothing is high or severe anywhere right now.": {
    hi: "अभी कहीं भी कुछ भी अधिक या गंभीर नहीं है।",
    kn: "ಈಗ ಎಲ್ಲಿಯೂ ಯಾವುದೂ ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರವಾಗಿಲ್ಲ.",
  },
  "X air stations:": { hi: "X वायु केंद्र:", kn: "X ವಾಯು ಕೇಂದ್ರಗಳು:" },
  "Heat is severe in X.": { hi: "X गर्मी गंभीर है।", kn: "X ಬಿಸಿಲು ತೀವ್ರವಾಗಿದೆ." },
  "Heat is high in X.": { hi: "X गर्मी अधिक है।", kn: "X ಬಿಸಿಲು ಹೆಚ್ಚಾಗಿದೆ." },
  "Heat is moderate in X.": { hi: "X गर्मी मध्यम है।", kn: "X ಬಿಸಿಲು ಮಧ್ಯಮವಾಗಿದೆ." },
  "Everywhere else it is low.": { hi: "बाकी सब जगह यह कम है।", kn: "ಉಳಿದೆಲ್ಲೆಡೆ ಕಡಿಮೆ ಇದೆ." },
  "Heat is low everywhere.": { hi: "हर जगह गर्मी कम है।", kn: "ಎಲ್ಲೆಡೆ ಬಿಸಿಲು ಕಡಿಮೆ ಇದೆ." },
  "Heavy rain is forecast in X in the next 24 hours.": {
    hi: "अगले 24 घंटों में X भारी बारिश का पूर्वानुमान है।",
    kn: "ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ X ಭಾರೀ ಮಳೆಯ ಮುನ್ಸೂಚನೆ ಇದೆ.",
  },
  "X is in the Bay of Bengal.": { hi: "X बंगाल की खाड़ी में है।", kn: "X ಬಂಗಾಳ ಕೊಲ್ಲಿಯಲ್ಲಿದೆ." },
  "X is in the Arabian Sea.": { hi: "X अरब सागर में है।", kn: "X ಅರಬ್ಬೀ ಸಮುದ್ರದಲ್ಲಿದೆ." },
  "The map is not ready yet.": { hi: "मानचित्र अभी तैयार नहीं है।", kn: "ನಕ್ಷೆ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ." },
  "It appears once the first readings are in. Look up a place to see its sky now.": {
    hi: "पहले आँकड़े आते ही यह दिखेगा। किसी जगह का अभी का आसमान देखने के लिए उसे खोजें।",
    kn: "ಮೊದಲ ಮಾಹಿತಿ ಬಂದ ಕೂಡಲೇ ಇದು ಕಾಣಿಸುತ್ತದೆ. ಒಂದು ಸ್ಥಳದ ಈಗಿನ ಆಕಾಶ ನೋಡಲು ಅದನ್ನು ಹುಡುಕಿ.",
  },
  "Favourite X": { hi: "X को पसंदीदा बनाएँ", kn: "X ಅನ್ನು ಮೆಚ್ಚಿನದಾಗಿಸಿ" },
  "Rename X": { hi: "X का नाम बदलें", kn: "X ಹೆಸರು ಬದಲಿಸಿ" },
  "Remove X": { hi: "X हटाएँ", kn: "X ತೆಗೆದುಹಾಕಿ" },
  States: { hi: "राज्य", kn: "ರಾಜ್ಯಗಳು" },
  "Each dot is a place on mugilu. Select a state to see its places.": {
    hi: "हर बिंदु mugilu पर एक जगह है। किसी राज्य की जगहें देखने के लिए उसे चुनें।",
    kn: "ಪ್ರತಿ ಚುಕ್ಕೆ mugilu ನಲ್ಲಿನ ಒಂದು ಸ್ಥಳ. ಒಂದು ರಾಜ್ಯದ ಸ್ಥಳಗಳನ್ನು ನೋಡಲು ಅದನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
  },
  "Map of India with every place on mugilu. Select a state to see its places.": {
    hi: "mugilu की हर जगह के साथ भारत का मानचित्र। किसी राज्य की जगहें देखने के लिए उसे चुनें।",
    kn: "mugilu ನ ಪ್ರತಿಯೊಂದು ಸ್ಥಳವಿರುವ ಭಾರತದ ನಕ್ಷೆ. ಒಂದು ರಾಜ್ಯದ ಸ್ಥಳಗಳನ್ನು ನೋಡಲು ಅದನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
  },
  "Place names: OpenStreetMap contributors (ODbL), GeoNames (CC-BY 4.0).": {
    hi: "स्थानों के नाम: OpenStreetMap योगदानकर्ता (ODbL), GeoNames (CC-BY 4.0)।",
    kn: "ಸ್ಥಳಗಳ ಹೆಸರುಗಳು: OpenStreetMap ಕೊಡುಗೆದಾರರು (ODbL), GeoNames (CC-BY 4.0).",
  },
  "Admin boundaries: LGD, via bharatlas.": {
    hi: "प्रशासनिक सीमाएँ: LGD, bharatlas के माध्यम से।",
    kn: "ಆಡಳಿತಾತ್ಮಕ ಗಡಿಗಳು: LGD, bharatlas ಮೂಲಕ.",
  },
  // /methodology prose (kn): hand-composed from the reviewed KANNADA_GLOSSARY + existing
  // UI strings (no Sarvam pass), proper nouns/acronyms kept Latin. Pending native
  // sign-off (supporting-docs/METHODOLOGY_KANNADA_REVIEW.md). Open calls flagged there:
  // "Ambient" feature name, "wet-bulb"=ತೇವ-ಬಲ್ಬ್, "read"=ಓದುವಿಕೆ. {score}/{terms} are link slots.
  "How the Ambient read works": {
    hi: "Ambient रीडिंग कैसे काम करती है",
    kn: "Ambient ಓದುವಿಕೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
  },
  "mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. It's a glass box: the thresholds below are public and come from CPCB, IMD, WHO, NASA, the Australian BoM and the AQLI. Informational only, never medical or safety advice.":
    {
      hi: "mugilu अभी आकाश आपके साथ जो सबसे बुरा कर रहा है, उसे नाम देता है, आप कौन हैं उसके अनुसार। यह एक पारदर्शी व्यवस्था है: नीचे दी गई सीमाएँ सार्वजनिक हैं और CPCB, IMD, WHO, NASA, Australian BoM और AQLI से आती हैं। केवल जानकारी के लिए, कभी भी चिकित्सा या सुरक्षा सलाह नहीं।",
      kn: "ಆಕಾಶವು ಈಗ ನಿಮಗೆ ಮಾಡುತ್ತಿರುವ ಅತ್ಯಂತ ಕೆಟ್ಟ ಒಂದೇ ವಿಷಯವನ್ನು mugilu ಹೆಸರಿಸುತ್ತದೆ, ನೀವು ಯಾರು ಎಂಬುದರ ಆಧಾರದ ಮೇಲೆ. ಇದು ಒಂದು ಪಾರದರ್ಶಕ ವ್ಯವಸ್ಥೆ: ಕೆಳಗಿನ ಮಿತಿಗಳು ಸಾರ್ವಜನಿಕವಾಗಿವೆ ಮತ್ತು CPCB, IMD, WHO, NASA, Australian BoM ಮತ್ತು AQLIಯಿಂದ ಬಂದಿವೆ. ಕೇವಲ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ಎಂದಿಗೂ ವೈದ್ಯಕೀಯ ಅಥವಾ ಸುರಕ್ಷತಾ ಸಲಹೆಯಲ್ಲ.",
    },
  "One read, never an average": {
    hi: "एक ही रीडिंग, कभी औसत नहीं",
    kn: "ಒಂದೇ ಓದುವಿಕೆ, ಎಂದಿಗೂ ಸರಾಸರಿ ಅಲ್ಲ",
  },
  // Methodology (2026-10): bands as the data names them, the order of risk, the persona
  // sentence and today against normal. Built from the reviewed text; new sentences are
  // drafts pending native review.
  'Each hazard is scored 0 to 3 (low, moderate, high, severe). We surface the worst one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.':
    {
      hi: 'प्रत्येक खतरे को 0 से 3 तक अंक दिए जाते हैं (कम, मध्यम, अधिक, गंभीर)। हम सबसे बुरे को सरल शब्दों में नाम देकर दिखाते हैं ("गंभीर धुआं", "अधिक गर्मी"), क्या करना है इस पर एक वाक्य के साथ। बाकी आँकड़े जोखिम के क्रम में आते हैं। औसत निकालने से जो मायने रखता है वह छिप जाएगा, इसलिए हम कभी औसत नहीं निकालते।',
      kn: 'ಪ್ರತಿಯೊಂದು ಅಪಾಯಕ್ಕೂ 0 ರಿಂದ 3 ರವರೆಗೆ ಅಂಕ ನೀಡಲಾಗುತ್ತದೆ (ಕಡಿಮೆ · ಮಧ್ಯಮ · ಹೆಚ್ಚು · ತೀವ್ರ). ನಾವು ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದನ್ನು ಸರಳ ಪದಗಳಲ್ಲಿ ಹೆಸರಿಸಿ ತೋರಿಸುತ್ತೇವೆ ("ತೀವ್ರ ಹೊಗೆ", "ಹೆಚ್ಚು ಬಿಸಿಲು"), ಏನು ಮಾಡಬೇಕು ಎಂಬುದರ ಬಗ್ಗೆ ಒಂದೇ ವಾಕ್ಯದೊಂದಿಗೆ. ಉಳಿದ ಮಾಹಿತಿಯು ಅಪಾಯದ ಕ್ರಮದಲ್ಲಿ ಬರುತ್ತದೆ. ಸರಾಸರಿ ಮಾಡಿದರೆ ಮುಖ್ಯವಾದ ವಿಷಯ ಮರೆಯಾಗುತ್ತದೆ, ಆದ್ದರಿಂದ ನಾವು ಎಂದಿಗೂ ಸರಾಸರಿ ಮಾಡುವುದಿಲ್ಲ.',
    },
  "For who you are": {
    hi: "आप कौन हैं, उसके अनुसार",
    kn: "ನೀವು ಯಾರೆಂಬುದಕ್ಕೆ ತಕ್ಕಂತೆ",
  },
  'Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). The read then says how that group should take it ("The air is moderate. For asthma & lungs, treat it as high."), and the readings that matter to that group are tagged "for you". When your trigger isn\'t the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle you choose: never inferred, never stored.':
    {
      hi: 'एक संवेदनशीलता चुनें (अस्थमा, बुजुर्ग, बच्चे, बाहर काम करने वाले, हृदय) और वह समूह जिन खतरों को अधिक तीव्रता से महसूस करता है उन्हें एक स्तर ऊपर कर दिया जाता है (इसलिए अस्थमा वाले को मध्यम वायु "अधिक" दिखती है)। फिर रीडिंग बताती है कि उस समूह को इसे कैसे लेना चाहिए ("वायु गुणवत्ता मध्यम है। अस्थमा और फेफड़े के लिए इसे अधिक मानें।"), और उस समूह के लिए अहम आँकड़ों पर "आपके लिए" लिखा होता है। जब आपकी समस्या मुख्य बात नहीं है पर फिर भी बढ़ी हुई है, तो एक दूसरी पंक्ति उसे सामने लाती है ("ध्यान दें: वायु भी अधिक स्तर पर है")। यह चुनाव आप स्वयं करते हैं: हम न इसका अनुमान लगाते हैं, न इसे सहेजते हैं।',
      kn: 'ಒಂದು ದುರ್ಬಲತೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ (ಆಸ್ತಮಾ, ವೃದ್ಧರು, ಮಕ್ಕಳು, ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು, ಹೃದಯ) ಮತ್ತು ಆ ಗುಂಪು ಹೆಚ್ಚು ತೀವ್ರವಾಗಿ ಅನುಭವಿಸುವ ಅಪಾಯಗಳನ್ನು ಒಂದು ಹಂತ ಮೇಲಕ್ಕೆ ಏರಿಸಲಾಗುತ್ತದೆ (ಆದ್ದರಿಂದ ಆಸ್ತಮಾ ಇರುವವರು ಮಧ್ಯಮ ವಾಯು ಗುಣಮಟ್ಟವನ್ನು "ಹೆಚ್ಚು" ಎಂದು ನೋಡುತ್ತಾರೆ). ನಂತರ ಓದುವಿಕೆ ಆ ಗುಂಪು ಅದನ್ನು ಹೇಗೆ ಪರಿಗಣಿಸಬೇಕು ಎಂದು ಹೇಳುತ್ತದೆ ("ವಾಯು ಗುಣಮಟ್ಟ ಮಧ್ಯಮವಾಗಿದೆ. ಆಸ್ತಮಾ ಮತ್ತು ಶ್ವಾಸಕೋಶ: ಇದನ್ನು ಹೆಚ್ಚು ಎಂದು ಪರಿಗಣಿಸಿ."), ಮತ್ತು ಆ ಗುಂಪಿಗೆ ಮುಖ್ಯವಾದ ಮಾಹಿತಿಗೆ "ನಿಮಗಾಗಿ" ಎಂಬ ಗುರುತು ಇರುತ್ತದೆ. ನಿಮ್ಮ ಸಮಸ್ಯೆ ಮುಖ್ಯಾಂಶವಲ್ಲದಿದ್ದರೂ ಇನ್ನೂ ಹೆಚ್ಚಿದ್ದರೆ, ಎರಡನೇ ಸಾಲು ಅದನ್ನು ತೋರಿಸುತ್ತದೆ ("ಇದನ್ನೂ ಗಮನಿಸಿ, ವಾಯು ಮಾಲಿನ್ಯ ಮಟ್ಟ ಹೆಚ್ಚು"). ಈ ಆಯ್ಕೆ ನೀವೇ ಮಾಡುವ ಒಂದು ಟಾಗಲ್: ಎಂದಿಗೂ ಊಹಿಸುವುದಿಲ್ಲ, ಎಂದಿಗೂ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ.',
    },
  "The thresholds": {
    hi: "सीमाएँ",
    kn: "ಮಿತಿಗಳು",
  },
  Hazard: {
    hi: "खतरा",
    kn: "ಅಪಾಯ",
  },
  "Air (AQI)": {
    hi: "वायु (AQI)",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ (AQI)",
  },
  "Heat (feels-like)": {
    hi: "गर्मी (महसूस)",
    kn: "ಬಿಸಿಲು (ಅನಿಸುವ)",
  },
  "Heat (wet-bulb)": {
    hi: "गर्मी (वेट-बल्ब)",
    kn: "ಬಿಸಿಲು (ವೆಟ್ ಬಲ್ಬ್)",
  },
  "Heat (WBGT)": {
    hi: "गर्मी (WBGT)",
    kn: "ಬಿಸಿಲು (WBGT)",
  },
  "Cold (feels-like)": {
    hi: "ठंड (महसूस)",
    kn: "ಚಳಿ (ಅನಿಸುವ)",
  },
  "Wind (gusts, km/h)": {
    hi: "हवा (झोंके, km/h)",
    kn: "ಗಾಳಿ (ರಭಸ, km/h)",
  },
  "Fog (visibility, m)": {
    hi: "कोहरा (दृश्यता, m)",
    kn: "ಮಂಜು (ಗೋಚರತೆ, m)",
  },
  "Smoke (fires <100 km)": {
    hi: "धुआं (100 km के भीतर आग)",
    kn: "ಹೊಗೆ (100 km ಒಳಗಿನ ಬೆಂಕಿ)",
  },
  "UV (index)": {
    hi: "UV (सूचकांक)",
    kn: "UV (ಸೂಚ್ಯಂಕ)",
  },
  "Dust (µg/m³)": {
    hi: "धूल (µg/m³)",
    kn: "ಧೂಳು (µg/m³)",
  },
  "Heat takes the worst of feels-like, wet-bulb and WBGT. The persona toggle then bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind), WHO (UV) and NASA FIRMS (smoke); the full logic is the open {score}, and every layer's source and licence is on {terms}.":
    {
      hi: "गर्मी, महसूस-तापमान, वेट-बल्ब और WBGT में से सबसे बुरा लेती है। फिर प्रोफ़ाइल टॉगल एक संवेदनशील खतरे को एक स्तर ऊपर कर देता है। ये सीमाएँ CPCB (वायु), IMD और Australian BoM (गर्मी / ठंड / हवा), WHO (UV) और NASA FIRMS (धुआं) से आती हैं; पूरा तर्क खुला {score} है, और हर परत का स्रोत और लाइसेंस {terms} पृष्ठ पर है।",
      kn: "ಬಿಸಿಲು ಎಂಬುದು ಅನಿಸುವ ತಾಪಮಾನ, ವೆಟ್ ಬಲ್ಬ್ ಮತ್ತು WBGT ಇವುಗಳಲ್ಲಿ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ. ನಂತರ ಪರ್ಸೋನಾ ಟಾಗಲ್ ಆ ಗುಂಪಿಗೆ ಹೆಚ್ಚು ತಟ್ಟುವ ಅಪಾಯವನ್ನು ಒಂದು ಹಂತ ಮೇಲಕ್ಕೆ ಏರಿಸುತ್ತದೆ. ಈ ಮಟ್ಟಗಳು CPCB (ವಾಯು ಗುಣಮಟ್ಟ), IMD ಮತ್ತು Australian BoM (ಬಿಸಿಲು / ಚಳಿ / ಗಾಳಿ), WHO (UV) ಮತ್ತು NASA FIRMS (ಹೊಗೆ) ಇವುಗಳಿಂದ ಬರುತ್ತವೆ; ಸಂಪೂರ್ಣ ತರ್ಕವು ಮುಕ್ತ {score} ಆಗಿದೆ, ಮತ್ತು ಪ್ರತಿ ಪದರದ ಮೂಲ ಮತ್ತು ಪರವಾನಗಿ {terms} ಪುಟದಲ್ಲಿದೆ.",
    },
  "terms & attribution": {
    hi: "शर्तें और श्रेय",
    kn: "ಷರತ್ತುಗಳು ಮತ್ತು ಮನ್ನಣೆ",
  },
  "Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.":
    {
      hi: "केवल जानकारी के लिए, चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए नहीं। आधिकारिक चेतावनियों के लिए, NDMA और IMD से परामर्श करें।",
      kn: "ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, NDMA ಮತ್ತು IMDಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    },
  // /terms prose (kn): hand-composed from the reviewed glossary + existing UI/About/method
  // strings (no Sarvam), proper nouns/acronyms/source names Latin, source-detail lines left
  // English (like /about's list). Pending native sign-off (METHODOLOGY/TERMS review sheet).
  // "Air" reuses the existing entry. {repo}/{um}/{bl}/{md} are link slots.
  "Terms &amp; attribution": {
    hi: "शर्तें और श्रेय",
    kn: "ಷರತ್ತುಗಳು ಮತ್ತು ಮನ್ನಣೆ",
  },
  "mugilu stitches together others' open data for any point in India. The stitch and the code are ours; the data is theirs, and stays under their terms.":
    {
      hi: "mugilu भारत में किसी भी बिंदु के लिए दूसरों के खुले डेटा को एक साथ लाता है। यह असेंबली और कोड हमारा है; डेटा उनका है और उनके नियमों के तहत रहता है।",
      kn: "mugilu ಭಾರತದ ಯಾವುದೇ ಬಿಂದುವಿಗೆ ಇತರರ ಮುಕ್ತ ದತ್ತಾಂಶವನ್ನು ಒಟ್ಟುಗೂಡಿಸುತ್ತದೆ. ಈ ಜೋಡಣೆ ಮತ್ತು ಕೋಡ್ ನಮ್ಮದು; ದತ್ತಾಂಶ ಅವರದ್ದು, ಮತ್ತು ಅವರ ಷರತ್ತುಗಳ ಅಡಿಯಲ್ಲಿ ಉಳಿಯುತ್ತದೆ.",
    },
  "No warranty": {
    hi: "कोई वारंटी नहीं",
    kn: "ಯಾವುದೇ ಖಾತರಿ ಇಲ್ಲ",
  },
  "Informational and educational only, not for medical, emergency, or safety-critical decisions. Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult NDMA and IMD directly.":
    {
      hi: "केवल जानकारी और शिक्षा के लिए, न कि चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए। आँकड़े मापे गए और अनुमानित मूल्यों का मिश्रण हैं और गलत, पुराने या अनुपलब्ध हो सकते हैं। सटीकता या उपलब्धता की कोई गारंटी नहीं है। आधिकारिक खतरे की चेतावनियों के लिए, NDMA और IMD से सीधे परामर्श करें।",
      kn: "ಮಾಹಿತಿ ಮತ್ತು ಶಿಕ್ಷಣಕ್ಕಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಮಾಹಿತಿಯು ಅಳೆದ ಮತ್ತು ಅಂದಾಜು ಮಾಡಿದ ಮೌಲ್ಯಗಳ ಮಿಶ್ರಣವಾಗಿದ್ದು, ತಪ್ಪಾಗಿರಬಹುದು, ಹಳೆಯದಾಗಿರಬಹುದು ಅಥವಾ ಇಲ್ಲದಿರಬಹುದು. ನಿಖರತೆ ಅಥವಾ ಲಭ್ಯತೆಯ ಯಾವುದೇ ಖಾತರಿ ಇಲ್ಲ. ಅಧಿಕೃತ ಅಪಾಯದ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, NDMA ಮತ್ತು IMDಯನ್ನು ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ.",
    },
  Licence: {
    hi: "लाइसेंस",
    kn: "ಪರವಾನಗಿ",
  },
  "The mugilu code is MIT (see the {repo}). The data is not relicensed: each upstream source keeps its own licence and attribution. mugilu is non-commercial, for individuals, and is not affiliated with any data provider.":
    {
      hi: "mugilu कोड MIT है ({repo} देखें)। डेटा को पुनः-लाइसेंस नहीं दिया गया है: प्रत्येक स्रोत अपना लाइसेंस और श्रेय बनाए रखता है। mugilu गैर-वाणिज्यिक है, व्यक्तियों के लिए, और किसी भी डेटा प्रदाता से संबद्ध नहीं है।",
      kn: "mugilu ಕೋಡ್ MIT ಆಗಿದೆ ({repo} ನೋಡಿ). ದತ್ತಾಂಶವನ್ನು ಮರು-ಪರವಾನಗಿ ನೀಡಲಾಗಿಲ್ಲ: ಪ್ರತಿಯೊಂದು ಮೂಲವೂ ತನ್ನದೇ ಆದ ಪರವಾನಗಿ ಮತ್ತು ಮನ್ನಣೆಯನ್ನು ಉಳಿಸಿಕೊಳ್ಳುತ್ತದೆ. mugilu ವಾಣಿಜ್ಯೇತರವಾಗಿದ್ದು, ವ್ಯಕ್ತಿಗಳಿಗಾಗಿ, ಮತ್ತು ಯಾವುದೇ ದತ್ತಾಂಶ ಪೂರೈಕೆದಾರರೊಂದಿಗೆ ಸಂಬಂಧ ಹೊಂದಿಲ್ಲ.",
    },
  repository: {
    hi: "रिपॉजिटरी",
    kn: "ರೆಪೊಸಿಟರಿ",
  },
  "Sources &amp; credit": {
    hi: "स्रोत और श्रेय",
    kn: "ಮೂಲಗಳು ಮತ್ತು ಮನ್ನಣೆ",
  },
  "Modelled air, heat, rain, UV, dust, wind": {
    hi: "अनुमानित वायु गुणवत्ता, गर्मी, बारिश, UV, धूल, हवा",
    kn: "ಅಂದಾಜು ವಾಯು ಗುಣಮಟ್ಟ, ಬಿಸಿಲು, ಮಳೆ, UV, ಧೂಳು, ಗಾಳಿ",
  },
  "Official warnings": {
    hi: "आधिकारिक चेतावनियाँ",
    kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು",
  },
  "Fire / crop-burn smoke": {
    hi: "आग / फसल-दहन का धुआं",
    kn: "ಬೆಂಕಿ / ಬೆಳೆ-ದಹನ ಹೊಗೆ",
  },
  "Geography &amp; place names": {
    hi: "भूगोल और स्थान के नाम",
    kn: "ಭೌಗೋಳಿಕ ಮಾಹಿತಿ ಮತ್ತು ಸ್ಥಳ ಹೆಸರುಗಳು",
  },
  "Health impact": {
    hi: "स्वास्थ्य प्रभाव",
    kn: "ಆರೋಗ್ಯ ಪರಿಣಾಮ",
  },
  "Each reading carries its own attribution line inline, so credit travels with the data wherever it goes.": {
    hi: "प्रत्येक जानकारी की अपनी श्रेय पंक्ति इनलाइन होती है, इसलिए श्रेय डेटा के साथ जहाँ भी जाता है वहाँ जाता है।",
    kn: "ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯೂ ತನ್ನದೇ ಆದ ಮನ್ನಣೆ ಸಾಲನ್ನು ಒಳಗೊಂಡಿರುತ್ತದೆ, ಆದ್ದರಿಂದ ದತ್ತಾಂಶ ಎಲ್ಲಿ ಹೋದರೂ ಮನ್ನಣೆ ಅದರೊಂದಿಗೆ ಸಾಗುತ್ತದೆ.",
  },
  Privacy: {
    hi: "गोपनीयता",
    kn: "ಗೌಪ್ಯತೆ",
  },
  "No accounts, no sign-up, no ad networks. Usage counts are first-party and aggregate (rounded coordinates, no IP, no per-person data). For visitor numbers and page performance, mugilu uses Cloudflare Web Analytics, which is cookieless, collects no personal data, and does no cross-site tracking or fingerprinting. Your saved places live only in your own browser.":
    {
      hi: "कोई खाता नहीं, कोई साइन-अप नहीं, कोई विज्ञापन नेटवर्क नहीं। उपयोग की गिनती हमारी अपनी है और केवल कुल संख्या में रखी जाती है (निर्देशांक पूर्णांकित, IP पता नहीं, प्रति-व्यक्ति डेटा नहीं)। आगंतुकों की संख्या और पृष्ठ प्रदर्शन के लिए, mugilu Cloudflare Web Analytics का उपयोग करता है, जो कुकी-रहित है, कोई व्यक्तिगत डेटा एकत्र नहीं करता, और कोई क्रॉस-साइट ट्रैकिंग या फिंगरप्रिंटिंग नहीं करता। आपके सहेजे हुए स्थान केवल आपके अपने ब्राउज़र में रहते हैं।",
      kn: "ಯಾವುದೇ ಖಾತೆಗಳಿಲ್ಲ, ನೋಂದಣಿ ಇಲ್ಲ, ಜಾಹೀರಾತು ಜಾಲಗಳಿಲ್ಲ. ಬಳಕೆಯ ಎಣಿಕೆಗಳು ಪ್ರಥಮ-ಪಕ್ಷದವು ಮತ್ತು ಒಟ್ಟಾರೆಯಾಗಿವೆ (ದುಂಡಾದ ನಿರ್ದೇಶಾಂಕಗಳು, IP ಇಲ್ಲ, ವ್ಯಕ್ತಿವಾರು ದತ್ತಾಂಶ ಇಲ್ಲ). ಭೇಟಿ ಸಂಖ್ಯೆಗಳು ಮತ್ತು ಪುಟದ ಕಾರ್ಯಕ್ಷಮತೆಗಾಗಿ, mugilu Cloudflare Web Analytics ಅನ್ನು ಬಳಸುತ್ತದೆ, ಇದು ಕುಕೀರಹಿತವಾಗಿದ್ದು, ಯಾವುದೇ ವೈಯಕ್ತಿಕ ದತ್ತಾಂಶವನ್ನು ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ ಮತ್ತು ಯಾವುದೇ ಅಡ್ಡ-ಸೈಟ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಅಥವಾ ಫಿಂಗರ್‌ಪ್ರಿಂಟಿಂಗ್ ಮಾಡುವುದಿಲ್ಲ. ನಿಮ್ಮ ಉಳಿಸಿದ ಸ್ಥಳಗಳು ನಿಮ್ಮ ಸ್ವಂತ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಮಾತ್ರ ಇರುತ್ತವೆ.",
    },
  "A digital commons by {um}, alongside {bl} and {md}.": {
    hi: "{um} द्वारा एक डिजिटल कॉमन्स, {bl} और {md} के साथ।",
    kn: "{um} ರಿಂದ ಒಂದು ಡಿಜಿಟಲ್ ಕಾಮನ್ಸ್, {bl} ಮತ್ತು {md} ಜೊತೆಗೆ.",
  },
  // Source/build list DETAIL lines (/terms sources, /about "Build on it"): localised too,
  // with {slots} for inline links. Source names, acronyms, licence codes and format/path
  // tokens (JSON/Markdown/OpenAPI/MCP//mcp//display/llms.txt) stay Latin.
  "back to mugilu": {
    hi: "mugilu पर वापस",
    kn: "mugilu ಗೆ ಹಿಂತಿರುಗಿ",
  },
  "CPCB (Govt. of India), Airnet (CSTEP), Aurassure, and Google AirView+, via the {oaq} broker.": {
    hi: "CPCB (भारत सरकार), Airnet (CSTEP), Aurassure, और Google AirView+, {oaq} ब्रोकर के माध्यम से।",
    kn: "CPCB (ಭಾರತ ಸರ್ಕಾರ), Airnet (CSTEP), Aurassure, ಮತ್ತು Google AirView+, {oaq} ಬ್ರೋಕರ್ ಮೂಲಕ.",
  },
  // /terms heat-normals credit (Bhashini draft, hand-fixed: names kept Latin). Native review pending.
  "Heat compared with normal": { hi: "सामान्य से तुलना में गर्मी", kn: "ಸಾಮಾನ್ಯಕ್ಕೆ ಹೋಲಿಸಿದರೆ ಬಿಸಿಲು" },
  "1991-2020 normals from {era5} reanalysis (Copernicus Climate Change Service), via Open-Meteo.": {
    hi: "1991-2020 के सामान्य तापमान, Open-Meteo के माध्यम से {era5} पुनः विश्लेषण (Copernicus Climate Change Service) से।",
    kn: "1991-2020ರ ಸಾಮಾನ್ಯ ತಾಪಮಾನಗಳು, Open-Meteo ಮೂಲಕ {era5} ಮರುವಿಶ್ಲೇಷಣೆಯಿಂದ (Copernicus Climate Change Service).",
  },
  "{ometeo}, licensed CC-BY 4.0.": {
    hi: "{ometeo}, CC-BY 4.0 के तहत लाइसेंस प्राप्त।",
    kn: "{ometeo}, CC-BY 4.0 ಅಡಿಯಲ್ಲಿ ಪರವಾನಗಿ ಪಡೆದಿದೆ.",
  },
  "NDMA / IMD via SACHET.": {
    hi: "SACHET के माध्यम से NDMA / IMD।",
    kn: "SACHET ಮೂಲಕ NDMA / IMD.",
  },
  "place search from {osm} contributors (ODbL) and {geonames} (CC-BY 4.0); admin boundaries from {bharatlas}.": {
    hi: "{osm} योगदानकर्ताओं (ODbL) और {geonames} (CC-BY 4.0) से स्थान खोज; {bharatlas} से प्रशासनिक सीमाएँ।",
    kn: "{osm} ಕೊಡುಗೆದಾರರು (ODbL) ಮತ್ತು {geonames} (CC-BY 4.0) ನಿಂದ ಸ್ಥಳ ಹುಡುಕಾಟ; {bharatlas} ನಿಂದ ಆಡಳಿತ ಗಡಿಗಳು.",
  },
  "years of life lost uses the {aqli} methodology (U Chicago EPIC).": {
    hi: "जीवन के खोए वर्षों की गणना {aqli} पद्धति से होती है (U Chicago EPIC)।",
    kn: "ಕಳೆದುಕೊಳ್ಳುವ ಆಯುಷ್ಯದ ವರ್ಷಗಳು {aqli} ವಿಧಾನವನ್ನು ಬಳಸುತ್ತವೆ (U Chicago EPIC).",
  },
  "connect Claude, Cursor or any MCP client to {mcp}; setup and the tools are on that page. Listed in {llms}.": {
    hi: "Claude, Cursor या किसी भी MCP क्लाइंट को {mcp} से जोड़ें; सेटअप और टूल उसी पेज पर हैं। {llms} में सूचीबद्ध।",
    kn: "Claude, Cursor ಅಥವಾ ಯಾವುದೇ MCP ಕ್ಲೈಂಟ್ ಅನ್ನು {mcp} ಗೆ ಸಂಪರ್ಕಿಸಿ; ಸೆಟಪ್ ಮತ್ತು ಸಾಧನಗಳು ಆ ಪುಟದಲ್ಲಿವೆ. {llms} ನಲ್ಲಿ ಪಟ್ಟಿಮಾಡಲಾಗಿದೆ.",
  },
  "a documented {openapi}, and every reading as {json} or {md}.": {
    hi: "एक प्रलेखित {openapi}, और प्रत्येक जानकारी {json} या {md} के रूप में।",
    kn: "ದಾಖಲಿತ {openapi}, ಮತ್ತು ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯೂ {json} ಅಥವಾ {md} ಆಗಿ.",
  },
  "a live card in one line of HTML ({embed}), or a {png}.": {
    hi: "HTML की एक पंक्ति में एक लाइव कार्ड ({embed}), या एक {png}।",
    kn: "HTML ನ ಒಂದೇ ಸಾಲಿನಲ್ಲಿ ಒಂದು ಲೈವ್ ಕಾರ್ಡ್ ({embed}), ಅಥವಾ ಒಂದು {png}.",
  },
  "a self-refreshing wall display or kiosk for a clinic, school or lobby, set up at {display}.": {
    hi: "क्लिनिक, स्कूल या लॉबी के लिए एक स्वयं-रिफ्रेश होने वाला वॉल डिस्प्ले या कियोस्क, {display} पर सेट करें।",
    kn: "ಚಿಕಿತ್ಸಾಲಯ, ಶಾಲೆ ಅಥವಾ ಲಾಬಿಗೆ ಸ್ವಯಂ-ರಿಫ್ರೆಶ್ ಆಗುವ ಗೋಡೆ ಡಿಸ್ಪ್ಲೇ ಅಥವಾ ಕಿಯೋಸ್ಕ್; ಇದನ್ನು {display} ನಲ್ಲಿ ಹೊಂದಿಸಿ.",
  },
  "OpenAPI spec": {
    hi: "OpenAPI स्पेक",
    kn: "OpenAPI ಸ್ಪೆಕ್",
  },
  "snapshot image": {
    hi: "स्नैपशॉट छवि",
    kn: "ಸ್ನ್ಯಾಪ್‌ಶಾಟ್ ಚಿತ್ರ",
  },
  // Accessibility labels (aria-label, screen-reader only) — localise too.
  "Who is this for": {
    hi: "यह किसके लिए है",
    kn: "ಇದು ಯಾರಿಗಾಗಿ",
  },
  "Look up a place in India": {
    hi: "भारत में कोई स्थान खोजें",
    kn: "ಭಾರತದಲ್ಲಿ ಒಂದು ಸ್ಥಳವನ್ನು ಹುಡುಕಿ",
  },
  // SEO/AEO: page <title> + <meta description> (and og/twitter, which reuse them).
  // Localised so regional SERP shows the hi/kn snippet, not English.
  // The hazard lists come from hazards.ts (HAZARDS, HAZARDS_SHORT), so these keys are built from it.
  [`mugilu: ${HAZARDS_SHORT} anywhere in India`]: {
    hi: `mugilu: भारत में कहीं भी ${HAZARDS_SHORT_TR.hi}`,
    kn: `mugilu: ಭಾರತದಲ್ಲಿ ಎಲ್ಲಿಯಾದರೂ ${HAZARDS_SHORT_TR.kn}`,
  },
  [SITE_DESC]: {
    hi: `mugilu: भारत का खुला आकाश। किसी भी बिंदु पर ${HAZARDS_TR.hi}, और आपके लिए सबसे बुरा खतरा, साफ़ शब्दों में।`,
    kn: `mugilu: ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ. ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲಿನ ${HAZARDS_TR.kn}, ನಿಮಗಾಗಿ ಹೆಸರಿಸಲಾದ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯ.`,
  },
  "About mugilu: the open sky of India": {
    hi: "mugilu के बारे में: भारत का खुला आकाश",
    kn: "mugilu ಬಗ್ಗೆ: ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ",
  },
  [`mugilu shows the ${HAZARDS} over any point in India right now, and names the single worst hazard for you. About the project, its open data sources, and how to build on it.`]:
    {
      hi: `mugilu अभी भारत में किसी भी बिंदु पर ${HAZARDS_TR.hi} दिखाता है, और आपके लिए सबसे बुरे खतरे को नाम देता है। परियोजना, इसके खुले डेटा स्रोतों, और इस पर कैसे निर्माण करें, इसके बारे में।`,
      kn: "mugilu ಈಗ ಭಾರತದ ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲಿನ ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಮಳೆ, ಗಾಳಿ, ಮಂಜು, ಧೂಳು, ಹೊಗೆ, UV ಮತ್ತು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳನ್ನು ತೋರಿಸುತ್ತದೆ, ಮತ್ತು ನಿಮಗೆ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯವನ್ನು ಹೆಸರಿಸುತ್ತದೆ. ಯೋಜನೆ, ಅದರ ಮುಕ್ತ ದತ್ತಾಂಶ ಮೂಲಗಳು ಮತ್ತು ಅದರ ಮೇಲೆ ಹೇಗೆ ನಿರ್ಮಿಸುವುದು ಎಂಬುದರ ಬಗ್ಗೆ.",
    },
  "How mugilu works: the Ambient read explained": {
    hi: "mugilu कैसे काम करता है: Ambient रीडिंग की व्याख्या",
    kn: "mugilu ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ: Ambient ಓದುವಿಕೆಯ ವಿವರಣೆ",
  },
  "How mugilu's Ambient read is computed: the public, auditable thresholds for air, heat, cold, wind, fog, smoke, UV and dust, and how the persona weighting works.":
    {
      hi: "mugilu की Ambient रीडिंग की गणना कैसे होती है: वायु, गर्मी, ठंड, हवा, कोहरा, धुआं, UV और धूल के लिए सार्वजनिक, जाँचने-योग्य सीमाएँ, और प्रोफ़ाइल भार कैसे काम करता है।",
      kn: "mugilu ನ Ambient ಓದುವಿಕೆಯನ್ನು ಹೇಗೆ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ: ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಗಾಳಿ, ಮಂಜು, ಹೊಗೆ, UV ಮತ್ತು ಧೂಳಿಗೆ ಸಾರ್ವಜನಿಕ, ಪರಿಶೀಲಿಸಬಹುದಾದ ಮಿತಿಗಳು, ಮತ್ತು ನೀವು ಆರಿಸುವ ಗುಂಪಿಗೆ ತಕ್ಕಂತೆ ಅಪಾಯದ ಹಂತ ಹೇಗೆ ಬದಲಾಗುತ್ತದೆ.",
    },
  "mugilu: terms, sources and attribution": {
    hi: "mugilu: शर्तें, स्रोत और श्रेय",
    kn: "mugilu: ಷರತ್ತುಗಳು, ಮೂಲಗಳು ಮತ್ತು ಮನ್ನಣೆ",
  },
  "mugilu's sources, licences and attribution: open data from CPCB, Open-Meteo, NDMA/IMD and NASA FIRMS, each keeping its own terms. Informational only, not for safety-critical use.":
    {
      hi: "mugilu के स्रोत, लाइसेंस और श्रेय: CPCB, Open-Meteo, NDMA/IMD और NASA FIRMS से खुला डेटा, प्रत्येक अपने नियम बनाए रखता है। केवल जानकारी के लिए, सुरक्षा-महत्वपूर्ण उपयोग के लिए नहीं।",
      kn: "mugilu ನ ಮೂಲಗಳು, ಪರವಾನಗಿಗಳು ಮತ್ತು ಮನ್ನಣೆ: CPCB, Open-Meteo, NDMA/IMD ಮತ್ತು NASA FIRMSನಿಂದ ಮುಕ್ತ ದತ್ತಾಂಶ, ಪ್ರತಿಯೊಂದೂ ತನ್ನದೇ ನಿಯಮಗಳನ್ನು ಉಳಿಸಿಕೊಳ್ಳುತ್ತದೆ. ಕೇವಲ ಮಾಹಿತಿಗಾಗಿ, ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ಬಳಕೆಗೆ ಅಲ್ಲ.",
    },
  "A place in India, or lat,lon": {
    hi: "भारत में एक स्थान, या अक्षांश, देशांतर",
    kn: "ಭಾರತದಲ್ಲಿ ಒಂದು ಸ್ಥಳ, ಅಥವಾ ಅಕ್ಷಾಂಶ, ರೇಖಾಂಶ",
  },
  // /c conditions <title> descriptor (place name is prepended, stays verbatim).
  // place-page title and description, in the words people search ("Delhi AQI today")
  "{place} AQI today: {aqi} {band}": { hi: "{place} AQI आज: {aqi} {band}", kn: "{place} AQI ಇಂದು: {aqi} {band}" },
  [`${HAZARDS_SHORT} now`]: {
    hi: `${HAZARDS_SHORT_TR.hi} अभी`,
    kn: `${HAZARDS_SHORT_TR.kn} ಈಗ`,
  },
  "{place} AQI {aqi} ({band}) right now, from the {station} station {km} km away.": {
    hi: "{place} AQI अभी {aqi} ({band}) है, {km} km दूर {station} स्टेशन से।",
    kn: "{place} AQI ಈಗ {aqi} ({band}), {km} km ದೂರದ {station} ನಿಲ್ದಾಣದಿಂದ.",
  },
  "air quality station": { hi: "वायु गुणवत्ता स्टेशन", kn: "ವಾಯು ಗುಣಮಟ್ಟ ನಿಲ್ದಾಣ" },
  "{station} ({city}) AQI {aqi} ({band}) right now, measured by {provider}.": {
    hi: "{station} ({city}) AQI अभी {aqi} ({band}) है, {provider} द्वारा मापा गया।",
    kn: "{station} ({city}) AQI ಈಗ {aqi} ({band}), {provider} ಅಳೆದದ್ದು.",
  },
  "Measured by {provider}.": { hi: "{provider} द्वारा मापा गया।", kn: "{provider} ಅಳೆದದ್ದು." },
  "No recent reading from this station. Last reading: X": {
    hi: "इस स्टेशन से हाल का कोई आँकड़ा नहीं। आखिरी आँकड़ा: X",
    kn: "ಈ ನಿಲ್ದಾಣದಿಂದ ಇತ್ತೀಚಿನ ಮಾಹಿತಿ ಇಲ್ಲ. ಕೊನೆಯ ಮಾಹಿತಿ: X",
  },
  "The full sky here: heat, rain, warnings and what to do": {
    hi: "यहाँ का पूरा हाल: गर्मी, बारिश, चेतावनियाँ और क्या करें",
    kn: "ಇಲ್ಲಿನ ಪೂರ್ಣ ಆಕಾಶ: ಬಿಸಿಲು, ಮಳೆ, ಎಚ್ಚರಿಕೆಗಳು ಮತ್ತು ಏನು ಮಾಡಬೇಕು",
  },
  // GRAP (Delhi-NCR): the range Delhi's AQI is in, never the stage in force (grap.ts)
  "Delhi's AQI averages {aqi} across {n} CPCB stations now, in the Stage {stage} range ({range}). The stage in force is set by CAQM.":
    {
      hi: "अभी {n} CPCB स्टेशनों पर Delhi का औसत AQI {aqi} है, जो Stage {stage} की सीमा ({range}) में है। लागू स्टेज CAQM तय करता है।",
      kn: "ಈಗ {n} CPCB ನಿಲ್ದಾಣಗಳಲ್ಲಿ Delhi ಸರಾಸರಿ AQI {aqi}, ಇದು Stage {stage} ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ({range}) ಇದೆ. ಜಾರಿಯಲ್ಲಿರುವ ಹಂತವನ್ನು CAQM ನಿರ್ಧರಿಸುತ್ತದೆ.",
    },
  "Delhi's AQI averages {aqi} across {n} CPCB stations now, below the Stage I range (201-300). The stage in force is set by CAQM.":
    {
      hi: "अभी {n} CPCB स्टेशनों पर Delhi का औसत AQI {aqi} है, जो Stage I की सीमा (201-300) से नीचे है। लागू स्टेज CAQM तय करता है।",
      kn: "ಈಗ {n} CPCB ನಿಲ್ದಾಣಗಳಲ್ಲಿ Delhi ಸರಾಸರಿ AQI {aqi}, ಇದು Stage I ವ್ಯಾಪ್ತಿಗಿಂತ (201-300) ಕಡಿಮೆ. ಜಾರಿಯಲ್ಲಿರುವ ಹಂತವನ್ನು CAQM ನಿರ್ಧರಿಸುತ್ತದೆ.",
    },
  "above 450": { hi: "450 से ऊपर", kn: "450 ಕ್ಕಿಂತ ಹೆಚ್ಚು" },
  // /warnings filters (wide screens)
  "Filter warnings": { hi: "चेतावनियाँ छाँटें", kn: "ಎಚ್ಚರಿಕೆಗಳನ್ನು ಆರಿಸಿ" },
  "Find a place or district": { hi: "कोई जगह या ज़िला खोजें", kn: "ಸ್ಥಳ ಅಥವಾ ಜಿಲ್ಲೆಯನ್ನು ಹುಡುಕಿ" },
  Type: { hi: "प्रकार", kn: "ಬಗೆ" },
  "Issued by": { hi: "जारी करने वाला", kn: "ನೀಡಿದವರು" },
  "Thunderstorm, lightning": { hi: "आंधी-तूफान, बिजली", kn: "ಗುಡುಗು, ಸಿಡಿಲು" },
  "Flood, river level": { hi: "बाढ़, नदी का स्तर", kn: "ಪ್ರವಾಹ, ನದಿ ಮಟ್ಟ" },
  "Rain, snow": { hi: "बारिश, बर्फ़", kn: "ಮಳೆ, ಹಿಮ" },
  "Wind, cyclone": { hi: "हवा, चक्रवात", kn: "ಗಾಳಿ, ಚಂಡಮಾರುತ" },
  "Cold, frost": { hi: "ठंड, पाला", kn: "ಚಳಿ, ಹಿಮಗಟ್ಟುವಿಕೆ" },
  Fog: { hi: "कोहरा", kn: "ಮಂಜು" },
  Other: { hi: "अन्य", kn: "ಇತರೆ" },
  "Find a place": { hi: "कोई जगह खोजें", kn: "ಸ್ಥಳವನ್ನು ಹುಡುಕಿ" },
  "Each bar is the pollutant on CPCB's 0-500 AQI scale, in its band's colour.": {
    hi: "हर पट्टी उस प्रदूषक को CPCB के 0-500 AQI पैमाने पर, उसकी श्रेणी के रंग में दिखाती है।",
    kn: "ಪ್ರತಿ ಪಟ್ಟಿಯೂ ಆ ಮಾಲಿನ್ಯಕಾರಕವನ್ನು CPCB ಯ 0-500 AQI ಮಾಪಕದಲ್ಲಿ, ಅದರ ವರ್ಗದ ಬಣ್ಣದಲ್ಲಿ ತೋರಿಸುತ್ತದೆ.",
  },
  Station: { hi: "स्टेशन", kn: "ನಿಲ್ದಾಣ" },
  Distance: { hi: "दूरी", kn: "ದೂರ" },
  "On this page": { hi: "इस पेज पर", kn: "ಈ ಪುಟದಲ್ಲಿ" },
  // putting a place on a screen (/c and /display)
  "Put this on a screen": { hi: "इसे स्क्रीन पर लगाएँ", kn: "ಇದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಹಾಕಿ" },
  "A city, area or address": { hi: "कोई शहर, इलाका या पता", kn: "ನಗರ, ಪ್ರದೇಶ ಅಥವಾ ವಿಳಾಸ" },
  "A display can show a city, a neighbourhood or an exact point. Search for it above, or use where this screen stands.":
    {
      hi: "स्क्रीन किसी शहर, इलाके या एक सटीक जगह का हाल दिखा सकती है। ऊपर खोजें, या वही जगह इस्तेमाल करें जहाँ यह स्क्रीन लगी है।",
      kn: "ಸ್ಕ್ರೀನ್ ಒಂದು ನಗರ, ಪ್ರದೇಶ ಅಥವಾ ನಿಖರವಾದ ಸ್ಥಳವನ್ನು ತೋರಿಸಬಹುದು. ಮೇಲೆ ಹುಡುಕಿ, ಅಥವಾ ಈ ಸ್ಕ್ರೀನ್ ಇರುವ ಸ್ಥಳವನ್ನೇ ಬಳಸಿ.",
    },
  "Use this screen's location": { hi: "इस स्क्रीन की जगह इस्तेमाल करें", kn: "ಈ ಸ್ಕ್ರೀನ್ ಇರುವ ಸ್ಥಳವನ್ನು ಬಳಸಿ" },
  // the header nav on the wide pages
  Places: { hi: "स्थान", kn: "ಸ್ಥಳಗಳು" },
  Warnings: { hi: "चेतावनियाँ", kn: "ಎಚ್ಚರಿಕೆಗಳು" },
  "How it works": { hi: "यह कैसे काम करता है", kn: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ" },
  About: { hi: "परिचय", kn: "ಪರಿಚಯ" },
  Main: { hi: "मुख्य", kn: "ಮುಖ್ಯ" },
  "Air stations near here": { hi: "पास के वायु गुणवत्ता स्टेशन", kn: "ಹತ್ತಿರದ ವಾಯು ಗುಣಮಟ್ಟ ನಿಲ್ದಾಣಗಳು" },
  "{place} AQI {aqi} ({band}) right now, modelled.": {
    hi: "{place} AQI अभी {aqi} ({band}) है, मॉडल का अनुमान।",
    kn: "{place} AQI ಈಗ {aqi} ({band}), ಮಾದರಿಯ ಅಂದಾಜು.",
  },
  // /c conditions <meta description> framing (place name is prepended, stays verbatim).
  [`The ${HAZARDS} over this spot, with the single worst hazard named for you.`]: {
    hi: `इस स्थान पर ${HAZARDS_TR.hi}, साथ में आपके लिए सबसे बुरा खतरा, साफ़ शब्दों में।`,
    kn: `ಈ ಸ್ಥಳದ ಮೇಲಿನ ${HAZARDS_TR.kn}, ನಿಮಗಾಗಿ ಹೆಸರಿಸಲಾದ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯದೊಂದಿಗೆ.`,
  },
  "A serious warning is active. Do what the officials tell you.": {
    hi: "एक गंभीर चेतावनी सक्रिय है। आधिकारिक मार्गदर्शन का पालन करें।",
    kn: "ಗಂಭೀರ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯವಾಗಿದೆ. ಅಧಿಕೃತ ಮಾರ್ಗದರ್ಶನವನ್ನು ಅನುಸರಿಸಿ.",
  },
  "A whole-sky view for people, and shared infrastructure for anyone building on top of it.": {
    hi: "लोगों के लिए पूरे आकाश का दृश्य, और इसके ऊपर निर्माण करने वाले किसी भी व्यक्ति के लिए साझा बुनियादी ढांचा।",
    kn: "ಜನರಿಗೆ ಸಂಪೂರ್ಣ ಆಕಾಶದ ನೋಟ, ಮತ್ತು ಅದರ ಮೇಲೆ ನಿರ್ಮಿಸುವ ಯಾರಿಗಾದರೂ ಹಂಚಿಕೆಯ ಮೂಲಸೌಕರ್ಯ.",
  },
  "Active warnings": {
    hi: "सक्रिय चेतावनियाँ",
    kn: "ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು",
  },
  "Add ?ref=your-app to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.":
    {
      hi: "अपने ऐप (संचयी, डोमेन-स्तर) की पहचान करने के लिए किसी भी API या एम्बेड URL में ?ref=your-app जोड़ें। यह सब निःशुल्क है और इसमें किसी कुंजी की आवश्यकता नहीं है।",
      kn: "ನಿಮ್ಮ ಆ್ಯಪ್ ಅನ್ನು ಗುರುತಿಸಲು ಯಾವುದೇ API ಅಥವಾ ಎಂಬೆಡ್ URLಗೆ ?ref=your-app ಸೇರಿಸಿ (ಒಟ್ಟು ಎಣಿಕೆ ಮಾತ್ರ, ಡೊಮೇನ್ ಮಟ್ಟದಲ್ಲಿ). ಇದೆಲ್ಲವೂ ಉಚಿತ, ಯಾವುದೇ ಕೀ ಬೇಕಿಲ್ಲ.",
    },
  Air: {
    hi: "वायु",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ",
  },
  "Air from CPCB, Airnet (CSTEP), Aurassure and Google AirView+ via the Open Air Quality (OAQ) broker; weather, heat, UV and dust from Open-Meteo, and the 1991-2020 heat normals from ERA5 reanalysis (Copernicus) via Open-Meteo; official warnings from NDMA and IMD via SACHET; fire smoke from NASA FIRMS; cyclone tracks from JTWC; place search from OpenStreetMap and GeoNames, and boundaries from bharatlas; years of life lost from the AQLI method. Each source keeps its own licence, and mugilu credits all of them.":
    {
      hi: "वायु गुणवत्ता डेटा CPCB, Airnet (CSTEP), Aurassure और Google AirView+ से Open Air Quality (OAQ) ब्रोकर के माध्यम से आता है; मौसम, गर्मी, UV और धूल का डेटा Open-Meteo से आता है, और आज की गर्मी की तुलना के लिए 1991-2020 के सामान्य तापमान Open-Meteo के माध्यम से ERA5 पुनः विश्लेषण (Copernicus) से आते हैं; आधिकारिक चेतावनियाँ NDMA और IMD से SACHET के माध्यम से आती हैं; आग के धुएं का डेटा NASA FIRMS से आता है; चक्रवात के मार्ग JTWC से आते हैं; स्थान खोज OpenStreetMap और GeoNames से, और सीमाएँ bharatlas से आती हैं; जीवन के खोए वर्ष AQLI विधि से आते हैं। प्रत्येक स्रोत का अपना लाइसेंस होता है, और mugilu उन सभी को श्रेय देता है।",
      kn: "ವಾಯು ಗುಣಮಟ್ಟದ ದತ್ತಾಂಶ CPCB, Airnet (CSTEP), Aurassure ಮತ್ತು Google AirView+‌ನಿಂದ Open Air Quality (OAQ) ಬ್ರೋಕರ್ ಮೂಲಕ ಬರುತ್ತದೆ; ಹವಾಮಾನ, ಬಿಸಿಲು, UV ಮತ್ತು ಧೂಳಿನ ದತ್ತಾಂಶ Open-Meteoಯಿಂದ ಬರುತ್ತದೆ, ಮತ್ತು ಇಂದಿನ ಬಿಸಿಲನ್ನು ಹೋಲಿಸಲು ಬಳಸುವ 1991-2020ರ ಸಾಮಾನ್ಯ ತಾಪಮಾನಗಳು Open-Meteo ಮೂಲಕ ERA5 ಮರುವಿಶ್ಲೇಷಣೆಯಿಂದ (Copernicus) ಬರುತ್ತವೆ; ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು NDMA ಮತ್ತು IMDಯಿಂದ SACHET ಮೂಲಕ ಬರುತ್ತವೆ; ಬೆಂಕಿಯ ಹೊಗೆಯ ದತ್ತಾಂಶ NASA FIRMSನಿಂದ ಬರುತ್ತದೆ; ಚಂಡಮಾರುತದ ಮಾರ್ಗಗಳು JTWCಯಿಂದ ಬರುತ್ತವೆ; ಸ್ಥಳ ಹುಡುಕಾಟ OpenStreetMap ಮತ್ತು GeoNamesನಿಂದ, ಗಡಿಗಳು bharatlasನಿಂದ ಬರುತ್ತವೆ; ಕಳೆದುಕೊಳ್ಳುವ ಆಯುಷ್ಯದ ವರ್ಷಗಳು AQLI ವಿಧಾನದಿಂದ ಬರುತ್ತವೆ. ಪ್ರತಿಯೊಂದು ಮೂಲವೂ ತನ್ನದೇ ಆದ ಪರವಾನಗಿಯನ್ನು ಹೊಂದಿರುತ್ತದೆ ಮತ್ತು mugilu ಅವರೆಲ್ಲರಿಗೂ ಮನ್ನಣೆ ನೀಡುತ್ತದೆ.",
    },
  "The air is dangerous. Stay indoors if possible.": {
    hi: "वायु गुणवत्ता खतरनाक है। संभव हो तो घर के अंदर रहें।",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ ಅಪಾಯಕಾರಿಯಾಗಿದೆ. ಸಾಧ್ಯವಾದಷ್ಟು ಒಳಾಂಗಣದಲ್ಲಿ ಇರಿ.",
  },
  "The air is poor. If you are sensitive, do less outdoors.": {
    hi: "वायु गुणवत्ता खराब है। अगर आप संवेदनशील हैं, तो बाहर की गतिविधि कम करें।",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ ಕೆಟ್ಟದಾಗಿದೆ. ನೀವು ಸೂಕ್ಷ್ಮರಾಗಿದ್ದರೆ, ಹೊರಗೆ ಕಡಿಮೆ ಚಟುವಟಿಕೆ ಮಾಡಿ.",
  },
  "The air is moderate. Most people can be outdoors as usual.": {
    hi: "वायु गुणवत्ता मध्यम है। अधिकांश लोग हमेशा की तरह बाहर रह सकते हैं।",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ ಮಧ್ಯಮವಾಗಿದೆ. ಹೆಚ್ಚಿನ ಜನರು ಎಂದಿನಂತೆ ಹೊರಗೆ ಇರಬಹುದು.",
  },
  "Air refreshes hourly, the national heat, rain, UV and dust grid every few hours, and official warnings hourly. Every reading is timestamped with how long ago it was measured.":
    {
      hi: "वायु का डेटा हर घंटे, गर्मी, बारिश, UV और धूल का राष्ट्रीय ग्रिड हर कुछ घंटों में, और आधिकारिक चेतावनियाँ हर घंटे अपडेट होती हैं। हर आँकड़े पर लिखा होता है कि उसे कितनी देर पहले मापा गया था।",
      kn: "ವಾಯು-ಗುಣಮಟ್ಟದ ದತ್ತಾಂಶ ಪ್ರತಿ ಗಂಟೆಗೆ ನವೀಕರಿಸಲಾಗುತ್ತದೆ, ರಾಷ್ಟ್ರೀಯ ಬಿಸಿಲು, ಮಳೆ, UV ಮತ್ತು ಧೂಳಿನ ಗ್ರಿಡ್ ಪ್ರತಿ ಕೆಲವು ಗಂಟೆಗಳಿಗೊಮ್ಮೆ ಮತ್ತು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು ಪ್ರತಿ ಗಂಟೆಗೆ. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯ ತುಣುಕಿಗೂ ಅದನ್ನು ಅಳೆಯಲಾದ ಸಮಯದೊಂದಿಗೆ ಸಮಯಮುದ್ರೆ ಮಾಡಲಾಗಿರುತ್ತದೆ.",
    },
  "All clear": {
    hi: "सब कुछ ठीक है",
    kn: "ಎಲ್ಲವೂ ಸರಿ",
  },
  "An official advisory is active.": {
    hi: "एक आधिकारिक परामर्श सक्रिय है।",
    kn: "ಅಧಿಕೃತ ಸಲಹೆ ಜಾರಿಯಲ್ಲಿದೆ.",
  },
  "An official warning is active. Be alert.": {
    hi: "एक आधिकारिक चेतावनी सक्रिय है। सतर्क रहें।",
    kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯವಾಗಿದೆ. ಎಚ್ಚರವಾಗಿರಿ.",
  },
  "Any place in India": {
    hi: "भारत में कहीं भी",
    kn: "ಭಾರತದಲ್ಲಿ ಎಲ್ಲಿಯಾದರೂ",
  },
  "Asthma & lungs": {
    hi: "अस्थमा और फेफड़े",
    kn: "ಆಸ್ತಮಾ ಮತ್ತು ಶ್ವಾಸಕೋಶ",
  },
  "Build on it": {
    hi: "इस पर निर्माण करें",
    kn: "ಅದರ ಮೇಲೆ ನಿರ್ಮಿಸಿ",
  },
  "Built by urbanmorph, led by Sathya Sankaran.": {
    hi: "urbanmorph द्वारा निर्मित, Sathya Sankaran के नेतृत्व में।",
    kn: "ಇದನ್ನು ನಿರ್ಮಿಸಿದ್ದು urbanmorph, Sathya Sankaran ನೇತೃತ್ವದಲ್ಲಿ.",
  },
  Children: {
    hi: "बच्चे",
    kn: "ಮಕ್ಕಳು",
  },
  "It is very cold. Cover your body and spend less time outside.": {
    hi: "बहुत ठंड है। शरीर को ढककर रखें और बाहर कम समय बिताएँ।",
    kn: "ತುಂಬಾ ಚಳಿ ಇದೆ. ಮೈ ಮುಚ್ಚಿಕೊಳ್ಳಿ, ಹೊರಗೆ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  "Common questions": {
    hi: "सामान्य प्रश्न",
    kn: "ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳು",
  },
  "Conditions are good now.": {
    hi: "अभी परिस्थितियाँ अच्छी हैं।",
    kn: "ಈಗ ಪರಿಸ್ಥಿತಿಗಳು ಉತ್ತಮವಾಗಿವೆ.",
  },
  'No place found for "X". Type the name of a city or a place.': {
    hi: '"X" नाम का कोई स्थान नहीं मिला। किसी शहर या स्थान का नाम लिखें।',
    kn: '"X" ಎಂಬ ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ. ಒಂದು ನಗರ ಅಥವಾ ಸ್ಥಳದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ.',
  },
  "The wind can cause damage. Stay indoors, away from trees and hoardings.": {
    hi: "हवा से नुकसान हो सकता है। घर के अंदर रहें, पेड़ों और होर्डिंग से दूर रहें।",
    kn: "ಗಾಳಿಯಿಂದ ಹಾನಿಯಾಗಬಹುದು. ಒಳಾಂಗಣದಲ್ಲಿ ಇರಿ, ಮರಗಳು ಮತ್ತು ಜಾಹೀರಾತು ಫಲಕಗಳಿಂದ ದೂರವಿರಿ.",
  },
  "The cold is dangerous. Stay warm indoors if possible.": {
    hi: "ठंड खतरनाक है। संभव हो तो घर के अंदर रहें और खुद को गर्म रखें।",
    kn: "ಚಳಿ ಅಪಾಯಕಾರಿಯಾಗಿದೆ. ಸಾಧ್ಯವಾದಷ್ಟು ಒಳಾಂಗಣದಲ್ಲಿ ಬೆಚ್ಚಗಿರಿ.",
  },
  "There is dense fog. Drive slowly with low beams. Give yourself more time.": {
    hi: "घना कोहरा है। गाड़ी धीरे चलाएँ और हेडलाइट लो बीम पर रखें। ज़्यादा समय लेकर निकलें।",
    kn: "ದಟ್ಟ ಮಂಜು ಇದೆ. ಹೆಡ್‌ಲೈಟ್ ಅನ್ನು ಲೋ ಬೀಮ್‌ನಲ್ಲಿಟ್ಟು ನಿಧಾನವಾಗಿ ವಾಹನ ಚಲಾಯಿಸಿ. ಪ್ರಯಾಣಕ್ಕೆ ಹೆಚ್ಚು ಸಮಯ ಇಟ್ಟುಕೊಳ್ಳಿ.",
  },
  Display: {
    hi: "डिस्प्ले",
    kn: "ಪ್ರದರ್ಶನ",
  },
  Dust: {
    hi: "धूल",
    kn: "ಧೂಳು",
  },
  Dustiest: {
    hi: "सबसे धूल भरा स्थान",
    kn: "ಅತ್ಯಂತ ಧೂಳುಭರಿತ",
  },
  "There is a lot of dust. If you are sensitive, cover your nose and mouth.": {
    hi: "बहुत धूल है। अगर आप संवेदनशील हैं, तो नाक और मुँह ढक लें।",
    kn: "ಗಾಳಿಯಲ್ಲಿ ತುಂಬಾ ಧೂಳು ಇದೆ. ನೀವು ಸೂಕ್ಷ್ಮರಾಗಿದ್ದರೆ, ಮೂಗು ಮತ್ತು ಬಾಯಿಯನ್ನು ಮುಚ್ಚಿಕೊಳ್ಳಿ.",
  },
  "Embed it": {
    hi: "इसे एम्बेड करें",
    kn: "ಅದನ್ನು ಅಳವಡಿಸಿ",
  },
  Everyone: {
    hi: "सभी",
    kn: "ಎಲ್ಲರೂ",
  },
  "The sun is extreme. Cover your skin. Stay out of the sun at midday.": {
    hi: "धूप बेहद तेज़ है। त्वचा ढकें। दोपहर में धूप में न निकलें।",
    kn: "ಸೂರ್ಯನ ಬೆಳಕು ವಿಪರೀತ ಪ್ರಖರವಾಗಿದೆ. ನಿಮ್ಮ ಚರ್ಮವನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ. ಮಧ್ಯಾಹ್ನ ಬಿಸಿಲಿನಿಂದ ದೂರವಿರಿ.",
  },
  Satisfactory: {
    hi: "संतोषजनक",
    kn: "ತೃಪ್ತಿಕರ",
  },
  "There are fires near here. If you are sensitive, watch the air.": {
    hi: "पास में आग लगी हुई है। अगर आप संवेदनशील हैं, तो वायु गुणवत्ता पर नज़र रखें।",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ಬೆಂಕಿ ಹೊತ್ತಿಕೊಂಡಿದೆ. ಸೂಕ್ಷ್ಮ ವ್ಯಕ್ತಿಗಳು ವಾಯು ಗುಣಮಟ್ಟವನ್ನು ಗಮನಿಸಬೇಕು.",
  },
  "For AI agents": {
    hi: "AI एजेंट्स के लिए",
    kn: "AI ಏಜೆಂಟ್‌ಗಳಿಗೆ",
  },
  "For an always-on unattended screen, point a kiosk-browser app at the same link so it auto-starts.": {
    hi: "हमेशा चालू रहने वाली, बिना निगरानी वाली स्क्रीन के लिए, किसी कियोस्क-ब्राउज़र ऐप को उसी लिंक पर सेट करें ताकि यह अपने आप शुरू हो जाए।",
    kn: "ಸದಾ-ಆನ್, ಯಾರೂ ನೋಡಿಕೊಳ್ಳದ ಸ್ಕ್ರೀನ್‌ಗೆ, ಅದೇ ಕೊಂಡಿಗೆ ಕಿಯೋಸ್ಕ್-ಬ್ರೌಸರ್ ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ಹೊಂದಿಸಿ, ಆಗ ಅದು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.",
  },
  "For developers": {
    hi: "डेवलपर्स के लिए",
    kn: "ಡೆವಲಪರ್‌ಗಳಿಗೆ",
  },
  "For people": {
    hi: "लोगों के लिए",
    kn: "ಜನರಿಗಾಗಿ",
  },
  "For years, people across India have made the sky legible one piece at a time: a map of one city's air, a thread about a heatwave, a chart of last year's monsoon. Brilliant work, but scattered, and easy to lose by the next season.":
    {
      hi: "कई वर्षों से भारत भर के लोग एक-एक करके आसमान को समझने लायक बना रहे हैं: एक शहर की वायु गुणवत्ता का मानचित्र, लू पर एक थ्रेड, पिछले साल के मानसून का एक चार्ट। शानदार काम, लेकिन बिखरा हुआ, और अगले मौसम तक आसानी से खो जाने वाला।",
      kn: "ಹಲವು ವರ್ಷಗಳಿಂದ, ಭಾರತದಾದ್ಯಂತ ಜನರು ಆಕಾಶವನ್ನು ಒಂದು ಸಮಯದಲ್ಲಿ ಒಂದು ತುಣುಕಾಗಿ ಓದಬಲ್ಲಂತೆ ಮಾಡುತ್ತಿದ್ದಾರೆ: ಒಂದು ನಗರದ ವಾಯು ಗುಣಮಟ್ಟದ ನಕ್ಷೆ, ಬಿಸಿಲಿನ ಅಲೆಗಳ ಬಗ್ಗೆ ಒಂದು ಲೇಖನ, ಕಳೆದ ವರ್ಷದ ಮಳೆಯ ನಕ್ಷೆ. ಅತ್ಯುತ್ತಮ ಕೆಲಸ, ಆದರೆ ಮುಂದಿನ ಋತುವಿನಲ್ಲಿ ಹರಡಿ ಹೋಗಿ, ಸುಲಭವಾಗಿ ಕಳೆದುಹೋಗುತ್ತದೆ.",
    },
  Go: {
    hi: "जाएं",
    kn: "ಹೋಗಿ",
  },
  Good: {
    hi: "अच्छा",
    kn: "ಉತ್ತಮ",
  },
  "Heart condition": {
    hi: "हृदय रोग",
    kn: "ಹೃದಯರೋಗ",
  },
  Heat: {
    hi: "गर्मी",
    kn: "ಬಿಸಿಲು",
  },
  "The heat is high. Do less, drink water and stay in the shade.": {
    hi: "गर्मी अधिक है। कम मेहनत करें, पानी पिएँ और छाया में रहें।",
    kn: "ಬಿಸಿಲು ಹೆಚ್ಚಾಗಿದೆ. ಶ್ರಮದಾಯಕ ಕೆಲಸ ಕಡಿಮೆ ಮಾಡಿ, ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ, ನೆರಳಿನಲ್ಲಿರಿ.",
  },
  "There is a lot of burning near here. Keep windows closed. Spend less time outdoors.": {
    hi: "आस-पास कई जगह आग जल रही है। खिड़कियाँ बंद रखें और बाहर कम समय बिताएँ।",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ಹಲವು ಕಡೆ ಬೆಂಕಿ ಉರಿಯುತ್ತಿದೆ. ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿಡಿ. ಹೊರಗೆ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  "There is heavy dust. Spend less time outdoors.": {
    hi: "बहुत ज़्यादा धूल है। बाहर कम समय बिताएँ।",
    kn: "ಗಾಳಿಯಲ್ಲಿ ಭಾರೀ ಧೂಳು ತುಂಬಿದೆ. ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  High: {
    hi: "अधिक",
    kn: "ಹೆಚ್ಚು",
  },
  Hottest: {
    hi: "सबसे गर्म स्थान",
    kn: "ಅತ್ಯಂತ ಬಿಸಿಲು",
  },
  "How current are the readings?": {
    hi: "आँकड़े कितने ताज़ा हैं?",
    kn: "ಮಾಹಿತಿ ಎಷ್ಟು ಇತ್ತೀಚಿನದು?",
  },
  "How it runs": {
    hi: "इसका संचालन कैसे होता है",
    kn: "ಅದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ",
  },
  "Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD.":
    {
      hi: "केवल जानकारी के लिए, चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए नहीं। आधिकारिक खतरे की चेतावनियों के लिए NDMA / IMD से परामर्श करें।",
      kn: "ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಅಧಿಕೃತ ಅಪಾಯದ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ NDMA / IMDಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    },
  "There are large fires near here. The air can be dangerous. Stay indoors.": {
    hi: "आस-पास बड़ी आग लगी है। वायु गुणवत्ता खतरनाक हो सकती है। घर के अंदर रहें।",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ತೀವ್ರವಾದ ಬೆಂಕಿ ಕಾಣಿಸಿಕೊಂಡಿದೆ. ವಾಯು ಗುಣಮಟ್ಟ ಅಪಾಯಕಾರಿಯಾಗಿರಬಹುದು. ಒಳಾಂಗಣದಲ್ಲಿರಿ.",
  },
  "Is it safe to go outside right now?": {
    hi: "क्या अभी बाहर जाना सुरक्षित है?",
    kn: "ಹೊರಗೆ ಹೋಗುವುದು ಈಗ ಸುರಕ್ಷಿತವೇ?",
  },
  "Is mugilu free?": {
    hi: "क्या mugilu निःशुल्क है?",
    kn: "mugilu ಉಚಿತವೇ?",
  },
  "It is cold outside. Wear layers of clothes.": {
    hi: "बाहर ठंड है। कपड़ों की कई परतें पहनें।",
    kn: "ಹೊರಗೆ ಚಳಿ ಇದೆ. ಬೆಚ್ಚಗಿನ ಬಟ್ಟೆಗಳ ಪದರಗಳನ್ನು ಧರಿಸಿ.",
  },
  "It is very hot. Keep water with you.": {
    hi: "बहुत गर्मी है। पानी अपने पास रखें।",
    kn: "ತುಂಬಾ ಬಿಸಿಲು ಇದೆ. ನೀರನ್ನು ಜೊತೆಯಲ್ಲಿ ಇಟ್ಟುಕೊಳ್ಳಿ.",
  },

  "It is windy. Tie down or bring in loose items.": {
    hi: "काफ़ी हवा चल रही है। खुला पड़ा सामान बाँध दें या अंदर रख लें।",
    kn: "ಗಾಳಿ ಜೋರಾಗಿದೆ. ಸಡಿಲವಾದ ವಸ್ತುಗಳನ್ನು ಕಟ್ಟಿಡಿ ಅಥವಾ ಒಳಗೆ ತನ್ನಿ.",
  },
  "Leave it. It refreshes on its own, keeps the screen awake, and if the network blips it holds the last reading and recovers.":
    {
      hi: "छोड़ दीजिए। यह अपने आप रिफ्रेश होता है, स्क्रीन को चालू रखता है, और यदि नेटवर्क कुछ देर के लिए बंद हो जाए तो आखिरी आँकड़े दिखाता रहता है और फिर से जुड़ जाता है।",
      kn: "ಅದನ್ನು ಹಾಗೆಯೇ ಬಿಡಿ. ಇದು ತನ್ನಷ್ಟಕ್ಕೆ ತಾನೇ ರಿಫ್ರೆಶ್ ಆಗುತ್ತದೆ, ಸ್ಕ್ರೀನ್ ಅನ್ನು ಆನ್ ಆಗಿಯೇ ಇಡುತ್ತದೆ ಮತ್ತು ನೆಟ್ವರ್ಕ್ ಸ್ವಲ್ಪ ಸಮಯದವರೆಗೆ ಸ್ಥಗಿತಗೊಂಡರೆ ಅದು ಕೊನೆಯ ಮಾಹಿತಿಯನ್ನು ತೋರಿಸಿ ಮತ್ತೆ ಸಂಪರ್ಕಗೊಳ್ಳುತ್ತದೆ.",
    },
  "Look up another place": {
    hi: "कोई और जगह देखें",
    kn: "ಬೇರೆ ಸ್ಥಳವನ್ನು ಹುಡುಕಿ",
  },
  Low: {
    hi: "कम",
    kn: "ಕಡಿಮೆ",
  },
  Moderate: {
    hi: "मध्यम",
    kn: "ಮಧ್ಯಮ",
  },
  "No active national alerts right now.": {
    hi: "अभी कोई सक्रिय राष्ट्रीय चेतावनी नहीं है।",
    kn: "ಪ್ರಸ್ತುತ ಯಾವುದೇ ಸಕ್ರಿಯ ರಾಷ್ಟ್ರೀಯ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ.",
  },
  "Not here.": {
    hi: "यह पृष्ठ नहीं मिला।",
    kn: "ಈ ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ.",
  },
  "Older adults": {
    hi: "बुजुर्ग",
    kn: "ವೃದ್ಧರು",
  },
  "Open display": {
    hi: "डिस्प्ले खोलें",
    kn: "ಪ್ರದರ್ಶನವನ್ನು ತೆರೆಯಿರಿ",
  },
  "Open the display link in the screen's browser: a smart TV, a cheap streaming stick, or an old tablet in a stand.": {
    hi: "स्क्रीन के ब्राउज़र में डिस्प्ले लिंक खोलें: स्मार्ट टीवी, सस्ती स्ट्रीमिंग स्टिक, या स्टैंड में लगा पुराना टैबलेट।",
    kn: "ಸ್ಕ್ರೀನ್‌ನ ವೆಬ್ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಪ್ರದರ್ಶನ ಕೊಂಡಿಯನ್ನು ತೆರೆಯಿರಿ: ಸ್ಮಾರ್ಟ್ ಟಿವಿ, ಅಗ್ಗದ ಸ್ಟ್ರೀಮಿಂಗ್ ಸ್ಟಿಕ್ ಅಥವಾ ಸ್ಟ್ಯಾಂಡ್‌ನಲ್ಲಿರುವ ಹಳೆಯ ಟ್ಯಾಬ್ಲೆಟ್.",
  },
  "Outdoor workers": {
    hi: "बाहर काम करने वाले",
    kn: "ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು",
  },
  "Visibility is low in some areas. Drive carefully.": {
    hi: "कुछ इलाकों में दृश्यता कम है। गाड़ी सावधानी से चलाएँ।",
    kn: "ಕೆಲವು ಕಡೆ ಗೋಚರತೆ ಕಡಿಮೆ ಇದೆ. ಎಚ್ಚರಿಕೆಯಿಂದ ವಾಹನ ಚಲಾಯಿಸಿ.",
  },
  "Pick a place": {
    hi: "कोई जगह चुनें",
    kn: "ಒಂದು ಸ್ಥಳವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ",
  },
  Poor: {
    hi: "खराब",
    kn: "ಕೆಟ್ಟ",
  },
  "Popular:": {
    hi: "लोकप्रिय:",
    kn: "ಜನಪ್ರಿಯ ಸ್ಥಳಗಳು:",
  },
  "Press full-screen (F11 with a keyboard, or the browser's full-screen control).": {
    hi: "फुल-स्क्रीन दबाएं (कीबोर्ड पर F11, या ब्राउज़र का फुल-स्क्रीन नियंत्रण)।",
    kn: "ಫುಲ್-ಸ್ಕ್ರೀನ್ ಮೋಡ್ (ಕೀಬೋರ್ಡ್‌ನಲ್ಲಿ F11, ಅಥವಾ ಬ್ರೌಸರ್‌ನ ಫುಲ್-ಸ್ಕ್ರೀನ್ ನಿಯಂತ್ರಣ) ಒತ್ತಿ.",
  },
  "Put it on a screen": {
    hi: "इसे स्क्रीन पर लगाएं",
    kn: "ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಹಾಕಿ",
  },
  "Put mugilu on a screen.": {
    hi: "mugilu को स्क्रीन पर लगाएं।",
    kn: "mugilu ಅನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಹಾಕಿ.",
  },
  Rain: {
    hi: "बारिश",
    kn: "ಮಳೆ",
  },
  // The home map of India and its cyclone card (indiamap.ts). Drafts: native review pending.
  "What's worst": {
    hi: "सबसे बुरा क्या है",
    kn: "ಅತಿ ಕೆಟ್ಟದ್ದು",
  },
  "Map of India. Each square is coloured by what is worst in it now.": {
    hi: "भारत का मानचित्र। हर वर्ग का रंग बताता है कि अभी वहाँ सबसे बुरा क्या है।",
    kn: "ಭಾರತದ ನಕ್ಷೆ. ಪ್ರತಿ ಚೌಕದ ಬಣ್ಣವು ಈಗ ಅಲ್ಲಿ ಯಾವುದು ಅತ್ಯಂತ ಕೆಟ್ಟದು ಎಂದು ತೋರಿಸುತ್ತದೆ.",
  },
  "Each square, about 100 km across, has the colour of what is worst in it, where that is high or severe. Air includes smoke and dust. Select a square to see that place.":
    {
      hi: "हर वर्ग (लगभग 100 km चौड़ा) का रंग वहाँ की सबसे बुरी चीज़ का है, जहाँ वह अधिक या गंभीर हो। वायु में धुआं और धूल भी शामिल हैं। उस जगह को देखने के लिए वर्ग चुनें।",
      kn: "ಪ್ರತಿ ಚೌಕಕ್ಕೆ (ಸುಮಾರು 100 km) ಅಲ್ಲಿನ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದರ ಬಣ್ಣವಿದೆ, ಅದು ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರವಾಗಿದ್ದಲ್ಲಿ. ವಾಯು ಗುಣಮಟ್ಟದಲ್ಲಿ ಹೊಗೆ ಮತ್ತು ಧೂಳು ಸೇರಿವೆ. ಆ ಸ್ಥಳವನ್ನು ನೋಡಲು ಚೌಕವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    },
  "Small: high. Full: severe.": {
    hi: "छोटा: अधिक। पूरा: गंभीर।",
    kn: "ಚಿಕ್ಕದು: ಹೆಚ್ಚು. ಪೂರ್ಣ: ತೀವ್ರ.",
  },
  Cold: {
    hi: "ठंड",
    kn: "ಚಳಿ",
  },
  Heavy: {
    hi: "भारी",
    kn: "ಭಾರೀ",
  },
  "Very heavy": {
    hi: "बहुत भारी",
    kn: "ಅತಿ ಭಾರೀ",
  },
  "Extremely heavy": {
    hi: "अत्यंत भारी",
    kn: "ಅತ್ಯಂತ ಭಾರೀ",
  },
  "See the rain": {
    hi: "बारिश देखें",
    kn: "ಮಳೆ ನೋಡಿ",
  },
  "No heavy rain is forecast in the next 24 hours.": {
    hi: "अगले 24 घंटों में भारी बारिश का पूर्वानुमान नहीं है।",
    kn: "ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಭಾರೀ ಮಳೆಯ ಮುನ್ಸೂಚನೆ ಇಲ್ಲ.",
  },
  "Rain forecast for the next 24 hours, from a weather model. Models often underestimate the rain a cyclone brings.": {
    hi: "अगले 24 घंटों की बारिश का पूर्वानुमान, एक मौसम मॉडल से। मॉडल अक्सर चक्रवात की बारिश को कम आँकते हैं।",
    kn: "ಮುಂದಿನ 24 ಗಂಟೆಗಳ ಮಳೆಯ ಮುನ್ಸೂಚನೆ, ಹವಾಮಾನ ಮಾದರಿಯಿಂದ. ಮಾದರಿಗಳು ಚಂಡಮಾರುತ ತರುವ ಮಳೆಯನ್ನು ಹೆಚ್ಚಾಗಿ ಕಡಿಮೆ ಅಂದಾಜಿಸುತ್ತವೆ.",
  },
  "Each dot is an air station, with the colour of its reading.": {
    hi: "हर बिंदु एक वायु केंद्र है, जिसका रंग उसके आँकड़ों के अनुसार है।",
    kn: "ಪ್ರತಿ ಚುಕ್ಕೆ ಒಂದು ವಾಯು ಕೇಂದ್ರ; ಅದರ ಬಣ್ಣ ಅದರ ಮಾಪನವನ್ನು ತೋರಿಸುತ್ತದೆ.",
  },
  "Heat is modelled for each district.": {
    hi: "गर्मी हर ज़िले के लिए मॉडल से आँकी गई है।",
    kn: "ಬಿಸಿಲನ್ನು ಪ್ರತಿ ಜಿಲ್ಲೆಗೆ ಹವಾಮಾನ ಮಾದರಿಯಿಂದ ಅಂದಾಜಿಸಲಾಗಿದೆ.",
  },
  "Official warnings are not on this map. Look up a place to see them.": {
    hi: "आधिकारिक चेतावनियाँ इस मानचित्र पर नहीं हैं। उन्हें देखने के लिए कोई जगह खोजें।",
    kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು ಈ ನಕ್ಷೆಯಲ್ಲಿ ಇಲ್ಲ. ಅವನ್ನು ನೋಡಲು ಒಂದು ಸ್ಥಳವನ್ನು ಹುಡುಕಿ.",
  },
  "A cyclone can form in the Bay of Bengal.": {
    hi: "बंगाल की खाड़ी में चक्रवात बन सकता है।",
    kn: "ಬಂಗಾಳ ಕೊಲ್ಲಿಯಲ್ಲಿ ಚಂಡಮಾರುತ ರೂಪುಗೊಳ್ಳಬಹುದು.",
  },
  "A cyclone can form in the Arabian Sea.": {
    hi: "अरब सागर में चक्रवात बन सकता है।",
    kn: "ಅರಬ್ಬೀ ಸಮುದ್ರದಲ್ಲಿ ಚಂಡಮಾರುತ ರೂಪುಗೊಳ್ಳಬಹುದು.",
  },
  "A cyclone is in the Bay of Bengal.": {
    hi: "बंगाल की खाड़ी में एक चक्रवात है।",
    kn: "ಬಂಗಾಳ ಕೊಲ್ಲಿಯಲ್ಲಿ ಒಂದು ಚಂಡಮಾರುತವಿದೆ.",
  },
  "A cyclone is in the Arabian Sea.": {
    hi: "अरब सागर में एक चक्रवात है।",
    kn: "ಅರಬ್ಬೀ ಸಮುದ್ರದಲ್ಲಿ ಒಂದು ಚಂಡಮಾರುತವಿದೆ.",
  },
  "Cyclone X is in the Bay of Bengal.": {
    hi: "चक्रवात X बंगाल की खाड़ी में है।",
    kn: "X ಚಂಡಮಾರುತ ಬಂಗಾಳ ಕೊಲ್ಲಿಯಲ್ಲಿದೆ.",
  },
  "Cyclone X is in the Arabian Sea.": {
    hi: "चक्रवात X अरब सागर में है।",
    kn: "X ಚಂಡಮಾರುತ ಅರಬ್ಬೀ ಸಮುದ್ರದಲ್ಲಿದೆ.",
  },
  "It moves north.": {
    hi: "यह उत्तर की ओर बढ़ रहा है।",
    kn: "ಇದು ಉತ್ತರದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "It moves north-east.": {
    hi: "यह उत्तर-पूर्व की ओर बढ़ रहा है।",
    kn: "ಇದು ಈಶಾನ್ಯದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "It moves east.": {
    hi: "यह पूर्व की ओर बढ़ रहा है।",
    kn: "ಇದು ಪೂರ್ವದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "It moves south-east.": {
    hi: "यह दक्षिण-पूर्व की ओर बढ़ रहा है।",
    kn: "ಇದು ಆಗ್ನೇಯದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "It moves south.": {
    hi: "यह दक्षिण की ओर बढ़ रहा है।",
    kn: "ಇದು ದಕ್ಷಿಣದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "It moves south-west.": {
    hi: "यह दक्षिण-पश्चिम की ओर बढ़ रहा है।",
    kn: "ಇದು ನೈಋತ್ಯದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "It moves west.": {
    hi: "यह पश्चिम की ओर बढ़ रहा है।",
    kn: "ಇದು ಪಶ್ಚಿಮದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "It moves north-west.": {
    hi: "यह उत्तर-पश्चिम की ओर बढ़ रहा है।",
    kn: "ಇದು ವಾಯವ್ಯದ ಕಡೆಗೆ ಚಲಿಸುತ್ತಿದೆ.",
  },
  "Track: JTWC (US Navy). For official warnings, follow IMD.": {
    hi: "मार्ग: JTWC (अमेरिकी नौसेना)। आधिकारिक चेतावनियों के लिए IMD देखें।",
    kn: "ಮಾರ್ಗ: JTWC (ಅಮೆರಿಕ ನೌಕಾಪಡೆ). ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳಿಗೆ IMD ಅನ್ನು ಅನುಸರಿಸಿ.",
  },
  "Cyclone tracks": {
    hi: "चक्रवात के मार्ग",
    kn: "ಚಂಡಮಾರುತದ ಮಾರ್ಗಗಳು",
  },
  "India now": {
    hi: "अभी पूरे भारत में",
    kn: "ಈಗ ಭಾರತದಾದ್ಯಂತ",
  },
  "Sathya Sankaran wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.":
    {
      hi: "Sathya Sankaran हर बार शुरुआत से ही शुरू करना बंद करना चाहते थे: पूरे आकाश को एक दृष्टिकोण में लाना, भारत में किसी भी बिंदु पर हर खतरे को एक साथ लाना, और फिर इसे बुनियादी ढांचे के रूप में देना, ताकि अगले मानचित्र, कहानी या चेतावनी को कुछ भी नहीं से शुरू करना न पड़े।",
      kn: "Sathya Sankaran ಪ್ರತಿ ಬಾರಿಯೂ ಮೊದಲಿನಿಂದ ಪ್ರಾರಂಭಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಲು ಬಯಸಿದ್ದರು: ಭಾರತದ ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲೆ ಪ್ರತಿಯೊಂದು ಅಪಾಯವನ್ನು ಒಂದೇ ನೋಟದಲ್ಲಿ ಒಟ್ಟುಗೂಡಿಸಿ, ನಂತರ ಅದನ್ನು ಮೂಲಸೌಕರ್ಯವಾಗಿ ಹಸ್ತಾಂತರಿಸುವುದು, ಆದ್ದರಿಂದ ಮುಂದಿನ ನಕ್ಷೆ, ಕಥೆ ಅಥವಾ ಎಚ್ಚರಿಕೆಯು ಏನೂ ಇಲ್ಲದಿರುವಲ್ಲಿಂದ ಪ್ರಾರಂಭಿಸಬೇಕಾಗಿಲ್ಲ.",
    },
  Severe: {
    hi: "गंभीर",
    kn: "ತೀವ್ರ",
  },
  Smoke: {
    hi: "धुआं",
    kn: "ಹೊಗೆ",
  },
  "There is some dust in the air.": {
    hi: "वायु में कुछ धूल है।",
    kn: "ಗಾಳಿಯಲ್ಲಿ ಸ್ವಲ್ಪ ಧೂಳು ಇದೆ.",
  },
  "Source on GitHub, drop a star if it's useful": {
    hi: "GitHub पर सोर्स कोड, उपयोगी लगे तो एक स्टार दें।",
    kn: "GitHub‌ನಲ್ಲಿರುವ ಮೂಲ ಸಂಕೇತ, ಅದು ಉಪಯುಕ್ತವಾಗಿದ್ದರೆ ಸ್ಟಾರ್ ಸೇರಿಸಿ.",
  },
  Sources: {
    hi: "स्रोत",
    kn: "ಮೂಲಗಳು",
  },
  "The sun is strong. Use a hat or sunscreen.": {
    hi: "धूप तेज़ है। टोपी पहनें या सनस्क्रीन लगाएँ।",
    kn: "ಸೂರ್ಯನ ಬೆಳಕು ಪ್ರಖರವಾಗಿದೆ. ಟೋಪಿ ಅಥವಾ ಸನ್‌ಸ್ಕ್ರೀನ್ ಬಳಸಿ.",
  },
  "The wind is strong. Be careful outdoors. Expect dust in the air.": {
    hi: "तेज हवाएँ चल रही हैं। बाहर सावधान रहें। धूल उड़ने की संभावना है।",
    kn: "ಬಲವಾದ ಗಾಳಿ ಬೀಸುತ್ತಿದೆ. ಹೊರಗೆ ಜಾಗರೂಕರಾಗಿರಿ. ಗಾಳಿಯಲ್ಲಿ ಧೂಳು ಇರಬಹುದು.",
  },
  Sun: {
    hi: "धूप",
    kn: "ಸೂರ್ಯನ ಬೆಳಕು",
  },
  "Be careful outdoors.": {
    hi: "बाहर सावधान रहें।",
    kn: "ಹೊರಗೆ ಜಾಗರೂಕರಾಗಿರಿ.",
  },
  "That is mugilu.": {
    hi: "यही है mugilu।",
    kn: "ಅದೇ mugilu.",
  },
  "That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate.": {
    hi: "यह पृष्ठ mugilu पर नहीं है। इसके बजाय कोई जगह खोजें, या कोई निर्देशांक दें।",
    kn: "ಆ ಪುಟ mugilu ನಲ್ಲಿ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ. ಬದಲಿಗೆ, ಒಂದು ಸ್ಥಳವನ್ನು ಹುಡುಕಿ ಅಥವಾ ನಿರ್ದೇಶಾಂಕವನ್ನು ನೀಡಿ.",
  },
  "The open sky of India, one coordinate at a time.": {
    hi: "भारत का खुला आकाश, एक बार में एक निर्देशांक।",
    kn: "ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ, ನಿರ್ದೇಶಾಂಕ ಒಂದೊಂದಾಗಿ.",
  },
  "The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is non-commercial, for good, the third in a small set of public tools alongside bharatlas and mdshare.":
    {
      hi: "आपके ऊपर का आकाश सबका साझा है। इसके बारे में जानने के लिए न पैसे लगने चाहिए, न यह किसी के ऐप में बंद रहना चाहिए। mugilu गैर-वाणिज्यिक है, जनहित के लिए है, और bharatlas और mdshare के साथ सार्वजनिक उपकरणों के एक छोटे समूह में तीसरा है।",
      kn: "ನಿಮ್ಮ ಮೇಲಿರುವ ಆಕಾಶ ಎಲ್ಲರ ಸಾಮಾನ್ಯ ಸಂಪತ್ತು. ಅದರ ಬಗ್ಗೆ ತಿಳಿಯಲು ಹಣ ಖರ್ಚಾಗಬಾರದು, ಅಥವಾ ಅದು ಯಾರದೋ ಆ್ಯಪ್‌ನೊಳಗೆ ಬಂಧಿಯಾಗಿರಬಾರದು. mugilu ವಾಣಿಜ್ಯೇತರ, ಸಾರ್ವಜನಿಕ ಹಿತಕ್ಕಾಗಿ ಇರುವುದು, bharatlas ಮತ್ತು mdshare ಜೊತೆಗಿನ ಸಾರ್ವಜನಿಕ ಸಾಧನಗಳ ಸಣ್ಣ ಸಮೂಹದಲ್ಲಿ ಮೂರನೆಯದು.",
    },
  "The sun is very strong. Spend less time in the sun at midday.": {
    hi: "धूप बहुत तेज़ है। दोपहर में धूप में कम समय बिताएँ।",
    kn: "ಸೂರ್ಯನ ಬೆಳಕು ತುಂಬಾ ಪ್ರಖರವಾಗಿದೆ. ಮಧ್ಯಾಹ್ನ ಬಿಸಿಲಿನಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  "Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.":
    {
      hi: "किसी भी डिस्प्ले को आकाश की लाइव, स्व-अपडेटिंग रीडिंग में बदलें। कोई जगह चुनें, उसे स्क्रीन पर खोलें, फुल-स्क्रीन दबाएं। यह खुद को रिफ्रेश करता है और एक कोने का QR कोड राहगीरों को उनके फोन पर उसी जगह पर भेजता है।",
      kn: "ಯಾವುದೇ ಡಿಸ್ಪ್ಲೇಯನ್ನು ಆಕಾಶದ ಲೈವ್, ಸ್ವಯಂ-ಅಪ್‌ಡೇಟ್ ಆಗುವ ಓದುವಿಕೆಯಾಗಿ ಪರಿವರ್ತಿಸಿ. ಒಂದು ಸ್ಥಳವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ, ಅದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ತೆರೆಯಿರಿ, ಫುಲ್-ಸ್ಕ್ರೀನ್ ಒತ್ತಿರಿ. ಇದು ತನ್ನನ್ನು ತಾನು ರಿಫ್ರೆಶ್ ಮಾಡಿಕೊಳ್ಳುತ್ತದೆ, ಮತ್ತು ಮೂಲೆಯಲ್ಲಿರುವ QR ಕೋಡ್ ದಾರಿಹೋಕರನ್ನು ಅವರ ಫೋನಿನಲ್ಲಿ ಅದೇ ಸ್ಥಳಕ್ಕೆ ಕರೆದೊಯ್ಯುತ್ತದೆ.",
    },
  "Type a place. See what the sky is doing to you right now: air, heat (and how survivable it really is), rain, sun and dust, alongside any official warning over that spot. Then one plain line, the single worst thing for you, whether you have asthma, work outdoors, or are minding a child or an older parent. No sign-up, no jargon.":
    {
      hi: "स्थान लिख दीजिए। देखिए कि आसमान इस समय आपके साथ क्या कर रहा है: वायु गुणवत्ता, गर्मी (और यह वास्तव में कितनी सहने योग्य है), बारिश, धूप और धूल, साथ ही उस स्थान के बारे में कोई आधिकारिक चेतावनी। फिर एक सरल पंक्ति, जो आपके लिए सबसे खराब है, चाहे आपको अस्थमा हो, बाहर काम करते हों या किसी बच्चे या बुजुर्ग माता-पिता की देखभाल कर रहे हों। कोई साइन-अप नहीं, और कोई तकनीकी शब्दावली नहीं।",
      kn: "ಸ್ಥಳ ಟೈಪ್ ಮಾಡಿ. ಆಕಾಶವು ಈಗ ನಿಮಗೆ ಏನು ಮಾಡುತ್ತಿದೆ ಎಂಬುದನ್ನು ನೋಡಿ: ವಾಯು ಗುಣಮಟ್ಟ, ಬಿಸಿಲು (ಮತ್ತು ಅದನ್ನು ನಿಜವಾಗಿ ಎಷ್ಟು ತಡೆದುಕೊಳ್ಳಬಹುದು), ಮಳೆ, ಸೂರ್ಯನ ಬೆಳಕು ಮತ್ತು ಧೂಳು, ಜೊತೆಗೆ ಆ ಸ್ಥಳದ ಮೇಲಿನ ಯಾವುದೇ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ. ನಂತರ ಒಂದು ಸರಳ ಸಾಲು: ನಿಮಗೆ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದು ಯಾವುದು, ನಿಮಗೆ ಆಸ್ತಮಾ ಇರಲಿ, ನೀವು ಹೊರಾಂಗಣದಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿರಲಿ, ಅಥವಾ ಮಗುವನ್ನು ಇಲ್ಲವೇ ಹಿರಿಯ ಪೋಷಕರನ್ನು ನೋಡಿಕೊಳ್ಳುತ್ತಿರಲಿ. ನೋಂದಣಿ ಅಗತ್ಯವಿಲ್ಲ, ಕಷ್ಟದ ತಾಂತ್ರಿಕ ಪದಗಳಿಲ್ಲ.",
    },
  "Type the name of a place in India, in any language": {
    hi: "भारत में किसी भी स्थान का नाम, किसी भी भाषा में लिखें",
    kn: "ಭಾರತದಲ್ಲಿರುವ ಯಾವುದೇ ಸ್ಥಳದ ಹೆಸರನ್ನು, ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ, ಬರೆಯಿರಿ.",
  },
  "UV index": {
    hi: "UV सूचकांक",
    kn: "UV ಸೂಚ್ಯಂಕ",
  },
  "Use my location": {
    hi: "मेरे स्थान का प्रयोग करें",
    kn: "ನನ್ನ ಸ್ಥಳವನ್ನು ಬಳಸಿ",
  },
  "There is very dense fog. Do not drive if possible.": {
    hi: "बहुत घना कोहरा है। संभव हो तो गाड़ी न चलाएँ।",
    kn: "ತುಂಬಾ ದಟ್ಟ ಮಂಜು ಇದೆ. ಸಾಧ್ಯವಾದರೆ ವಾಹನ ಚಲಾಯಿಸದಿರಿ.",
  },
  "Very Poor": {
    hi: "बहुत खराब",
    kn: "ತುಂಬಾ ಕೆಟ್ಟ",
  },
  Visibility: {
    hi: "दृश्यता",
    kn: "ಗೋಚರತೆ",
  },
  "Weight it for who is nearby": {
    hi: "आस-पास कौन है, उसके हिसाब से चुनें",
    kn: "ಹತ್ತಿರ ಇರುವವರಿಗೆ ತಕ್ಕಂತೆ ಓದುವಿಕೆಯನ್ನು ಹೊಂದಿಸಿ",
  },
  "Wet-bulb is the temperature a wet thermometer settles at: it folds heat and humidity into the one number that decides whether your body can still cool itself. Above about 32°C wet-bulb, even resting in shade turns dangerous. Ordinary feels-like numbers hide this, so mugilu surfaces it.":
    {
      hi: "वेट-बल्ब वह तापमान है जिस पर एक गीला थर्मामीटर ठहरता है: यह गर्मी और आर्द्रता को एक ही संख्या में जोड़ता है, जो तय करती है कि आपका शरीर अब भी खुद को ठंडा कर पा रहा है या नहीं। लगभग 32°C वेट-बल्ब से ऊपर, छाया में आराम करना भी खतरनाक हो जाता है। सामान्य महसूस-तापमान के आँकड़े इसे छिपा देते हैं, इसलिए mugilu इसे दिखाता है।",
      kn: "ವೆಟ್ ಬಲ್ಬ್ ಎಂದರೆ ಒದ್ದೆಯಾದ ಥರ್ಮಾಮೀಟರ್ ತೋರಿಸುವ ತಾಪಮಾನ: ಇದು ತಾಪಮಾನ ಮತ್ತು ಆರ್ದ್ರತೆಯನ್ನು ಒಂದೇ ಸಂಖ್ಯೆಯಲ್ಲಿ ಸೇರಿಸುತ್ತದೆ, ಮತ್ತು ನಿಮ್ಮ ದೇಹ ಇನ್ನೂ ತನ್ನನ್ನು ತಂಪಾಗಿಸಿಕೊಳ್ಳಬಲ್ಲದೇ ಎಂಬುದನ್ನು ಈ ಸಂಖ್ಯೆಯೇ ನಿರ್ಧರಿಸುತ್ತದೆ. ವೆಟ್ ಬಲ್ಬ್ ಸುಮಾರು 32°C ದಾಟಿದರೆ, ನೆರಳಿನಲ್ಲಿ ವಿಶ್ರಾಂತಿ ಪಡೆಯುವುದೂ ಅಪಾಯಕಾರಿಯಾಗುತ್ತದೆ. ಸಾಮಾನ್ಯ 'ಅನಿಸುವ ತಾಪಮಾನ' ಸಂಖ್ಯೆಗಳು ಇದನ್ನು ಮರೆಮಾಡುತ್ತವೆ, ಆದ್ದರಿಂದ mugilu ಇದನ್ನು ತೋರಿಸುತ್ತದೆ.",
    },
  "What is wet-bulb temperature, and why does mugilu show it?": {
    hi: "वेट-बल्ब तापमान क्या है और mugilu इसे क्यों दिखाता है?",
    kn: "ವೆಟ್ ಬಲ್ಬ್ ತಾಪಮಾನ ಎಂದರೇನು, ಮತ್ತು mugilu ಅದನ್ನು ಏಕೆ ತೋರಿಸುತ್ತದೆ?",
  },
  "What is it like outside now?": {
    hi: "बाहर अभी कैसा है?",
    kn: "ಈಗ ಹೊರಗೆ ಹೇಗಿದೆ?",
  },
  "Where does mugilu's data come from?": {
    hi: "mugilu का डेटा कहाँ से आता है?",
    kn: "mugilu ಬಳಸುವ ದತ್ತಾಂಶ ಎಲ್ಲಿಂದ ಬರುತ್ತದೆ?",
  },
  "Where it comes from": {
    hi: "यह कहाँ से आता है",
    kn: "ಇದು ಎಲ್ಲಿಂದ ಬರುತ್ತದೆ",
  },
  "Why it's free": {
    hi: "यह निःशुल्क क्यों है",
    kn: "ಇದು ಏಕೆ ಉಚಿತ",
  },
  "Why mugilu": {
    hi: "mugilu क्यों",
    kn: "mugilu ಏಕೆ",
  },
  Wind: {
    hi: "हवा",
    kn: "ಗಾಳಿ",
  },
  "Worst air": {
    hi: "सबसे खराब वायु गुणवत्ता",
    kn: "ಅತ್ಯಂತ ಕೆಟ್ಟ ವಾಯು ಗುಣಮಟ್ಟ",
  },
  "X days ago": {
    hi: "X दिन पहले",
    kn: "X ದಿನಗಳ ಹಿಂದೆ",
  },
  "X hours ago": {
    hi: "X घंटे पहले",
    kn: "X ಗಂಟೆಗಳ ಹಿಂದೆ",
  },
  "X min ago": {
    hi: "X मिनट पहले",
    kn: "X ನಿಮಿಷಗಳ ಹಿಂದೆ",
  },
  "Yes. It is free, open source (MIT) and non-commercial, with no sign-up. Every reading is also available as JSON, Markdown, an embeddable card, an OpenAPI spec, and an MCP server for AI agents.":
    {
      hi: "हाँ। यह निःशुल्क, ओपन सोर्स (MIT) और गैर-वाणिज्यिक है, और साइन-अप की ज़रूरत नहीं है। हर जानकारी JSON, Markdown, एम्बेड करने लायक कार्ड, OpenAPI स्पेक और AI एजेंटों के लिए MCP सर्वर के रूप में भी उपलब्ध है।",
      kn: "ಹೌದು. ಇದು ಉಚಿತ, ಮುಕ್ತ ಮೂಲ (MIT) ಮತ್ತು ವಾಣಿಜ್ಯೇತರವಾಗಿದ್ದು, ಯಾವುದೇ ನೋಂದಣಿಯಿಲ್ಲ. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯು JSON, Markdown, ಎಂಬೆಡ್ ಮಾಡಬಹುದಾದ ಕಾರ್ಡ್, OpenAPI ಸ್ಪೆಕ್ ಮತ್ತು AI ಏಜೆಂಟ್‌ಗಳಿಗಾಗಿ MCP ಸರ್ವರ್ ಆಗಿ ಲಭ್ಯವಿದೆ.",
    },
  "Your places": {
    hi: "आपकी जगहें",
    kn: "ನಿಮ್ಮ ಸ್ಥಳಗಳು",
  },
  "a digital commons": {
    hi: "डिजिटल कॉमन्स",
    kn: "ಡಿಜಿಟಲ್ ಕಾಮನ್ಸ್",
  },
  about: {
    hi: "परिचय",
    kn: "ಪರಿಚಯ",
  },
  air: {
    hi: "वायु प्रदूषण",
    kn: "ವಾಯು ಮಾಲಿನ್ಯ",
  },
  alert: {
    hi: "चेतावनी",
    kn: "ಎಚ್ಚರಿಕೆ",
  },
  breezy: {
    hi: "हल्की हवा",
    kn: "ಹಗುರ ಗಾಳಿ",
  },
  "MCP server": {
    hi: "MCP सर्वर",
    kn: "MCP ಸರ್ವರ್",
  },
  "build on it": {
    hi: "इस पर कुछ बनाएँ",
    kn: "ಇದನ್ನು ಬಳಸಿ ನಿರ್ಮಿಸಿ",
  },
  calm: {
    hi: "शांत",
    kn: "ಶಾಂತ",
  },
  caution: {
    hi: "सावधानी",
    kn: "ಜಾಗರೂಕತೆ",
  },
  "chance of rain": {
    hi: "बारिश की संभावना",
    kn: "ಮಳೆ ಸಾಧ್ಯತೆ",
  },
  clear: {
    hi: "स्पष्ट",
    kn: "ಸ್ಪಷ್ಟ",
  },
  code: {
    hi: "स्रोत कोड",
    kn: "ಸೋರ್ಸ್ ಕೋಡ್",
  },
  cold: {
    hi: "ठंड",
    kn: "ಚಳಿ",
  },
  dangerous: {
    hi: "खतरनाक",
    kn: "ಅಪಾಯಕಾರಿ",
  },
  "dangerous cold": {
    hi: "खतरनाक ठंड",
    kn: "ಅಪಾಯಕಾರಿ ಚಳಿ",
  },
  "dangerous humid heat": {
    hi: "खतरनाक उमस भरी गर्मी",
    kn: "ಅಪಾಯಕಾರಿ ಆರ್ದ್ರತೆ ಮತ್ತು ಬಿಸಿಲು",
  },
  "dense fog": {
    hi: "बहुत घना कोहरा",
    kn: "ತುಂಬಾ ದಟ್ಟ ಮಂಜು",
  },
  dust: {
    hi: "धूल",
    kn: "ಧೂಳು",
  },
  extreme: {
    hi: "अत्यधिक",
    kn: "ವಿಪರೀತ",
  },
  "extreme heat": {
    hi: "अत्यंत भीषण गर्मी",
    kn: "ವಿಪರೀತ ಬಿಸಿಲು",
  },
  feels: {
    hi: "महसूस",
    kn: "ಅನಿಸುತ್ತದೆ",
  },
  "feels like": {
    hi: "महसूस",
    kn: "ಅನಿಸುತ್ತದೆ",
  },
  fog: {
    hi: "कोहरा",
    kn: "ಮಂಜು",
  },
  gale: {
    hi: "तूफ़ानी हवा",
    kn: "ತುಂಬಾ ಜೋರು ಗಾಳಿ",
  },
  gusts: {
    hi: "झोंके",
    kn: "ಗಾಳಿಯ ರಭಸ",
  },
  hazy: {
    hi: "धुंधला",
    kn: "ಮಬ್ಬು",
  },
  heat: {
    hi: "गर्मी",
    kn: "ಬಿಸಿಲು",
  },
  high: {
    hi: "अधिक",
    kn: "ಹೆಚ್ಚು",
  },
  "high dust": {
    hi: "अधिक धूल",
    kn: "ಹೆಚ್ಚು ಧೂಳು",
  },
  "how it works": {
    hi: "यह कैसे काम करता है",
    kn: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
  },
  "just now": {
    hi: "अभी-अभी",
    kn: "ಈಗಷ್ಟೇ",
  },
  "light dust": {
    hi: "हल्की धूल",
    kn: "ಸ್ವಲ್ಪ ಧೂಳು",
  },
  low: {
    hi: "कम",
    kn: "ಕಡಿಮೆ",
  },
  measured: {
    hi: "मापा गया",
    kn: "ಸಂವೇದಕದಿಂದ ಅಳೆಯಲಾದ",
  },
  misty: {
    hi: "हल्का कोहरा",
    kn: "ತೆಳು ಮಂಜು",
  },
  modelled: {
    hi: "अनुमानित",
    kn: "ಅಂದಾಜು",
  },
  moderate: {
    hi: "मध्यम",
    kn: "ಮಧ್ಯಮ",
  },
  "moderate dust": {
    hi: "मध्यम धूल",
    kn: "ಮಧ್ಯಮ ಧೂಳು",
  },
  "mugilu is meant to be built on, not just looked at. Every reading is also open, machine-readable data, so you can put the whole sky behind your own map, story, dashboard or alert, and spend your time on the part that matters: the telling, and the action.":
    {
      hi: "mugilu सिर्फ़ देखने के लिए नहीं, इस पर आगे कुछ बनाने के लिए है। हर जानकारी खुले, मशीन से पढ़े जा सकने वाले डेटा के रूप में भी मिलती है, ताकि आप पूरे आसमान को अपने नक्शे, कहानी, डैशबोर्ड या अलर्ट के पीछे लगा सकें, और अपना समय उस हिस्से पर लगाएँ जो मायने रखता है: बात लोगों तक पहुँचाना, और कदम उठाना।",
      kn: "mugilu ಅನ್ನು ಕೇವಲ ನೋಡುವುದಕ್ಕಲ್ಲ, ಅದರ ಆಧಾರದ ಮೇಲೆ ಹೊಸದನ್ನು ಕಟ್ಟುವುದಕ್ಕಾಗಿ ಮಾಡಲಾಗಿದೆ. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯೂ ಮುಕ್ತವಾದ, ಯಂತ್ರ-ಓದಬಲ್ಲ ದತ್ತಾಂಶವಾಗಿದೆ, ಆದ್ದರಿಂದ ನೀವು ನಿಮ್ಮ ಸ್ವಂತ ನಕ್ಷೆ, ಕಥೆ, ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಅಥವಾ ಎಚ್ಚರಿಕೆಯ ಹಿಂದೆ ಇಡೀ ಆಕಾಶವನ್ನು ಇರಿಸಬಹುದು, ಮತ್ತು ನಿಮ್ಮ ಸಮಯವನ್ನು ಮುಖ್ಯವಾದ ಭಾಗದ ಮೇಲೆ ಕಳೆಯಬಹುದು: ಹೇಳುವುದು, ಮತ್ತು ಕ್ರಮ ಕೈಗೊಳ್ಳುವುದು.",
    },
  "mugilu is the Kannada word for the open sky.": {
    hi: "mugilu खुले आकाश के लिए कन्नड़ शब्द है।",
    kn: "mugilu ಎಂಬುದು ಮುಕ್ತ ಆಕಾಶಕ್ಕೆ ಇರುವ ಕನ್ನಡ ಪದ (ಮುಗಿಲು).",
  },
  "mugilu mirrors the SACHET feed and keeps an archive of every alert.": {
    hi: "mugilu SACHET फ़ीड को ज्यों-का-त्यों दिखाता है और हर चेतावनी का रिकॉर्ड रखता है।",
    kn: "mugilu SACHET ಫೀಡ್‌ನ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಯಥಾವತ್ತಾಗಿ ತೋರಿಸುತ್ತದೆ ಮತ್ತು ಪ್ರತಿಯೊಂದು ಎಚ್ಚರಿಕೆಯ ಆರ್ಕೈವ್ ಇಟ್ಟುಕೊಳ್ಳುತ್ತದೆ.",
  },
  "mugilu names the single worst hazard over your exact location and says plainly what to do, weighted for who you are: asthma, older adults, children, outdoor workers, or a heart condition. It is informational, not medical or safety advice; for official warnings, consult NDMA and IMD.":
    {
      hi: "mugilu आपकी सटीक जगह पर सबसे बुरे खतरे का नाम बताता है और साफ़ शब्दों में बताता है कि क्या करें, इस हिसाब से कि आप कौन हैं: अस्थमा वाले लोग, बुजुर्ग, बच्चे, बाहर काम करने वाले, या हृदय रोग वाले लोग। यह केवल जानकारी है, चिकित्सा या सुरक्षा सलाह नहीं; आधिकारिक चेतावनियों के लिए NDMA और IMD से परामर्श करें।",
      kn: "mugilu ನಿಮ್ಮ ನಿಖರವಾದ ಸ್ಥಳದ ಮೇಲಿನ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯವನ್ನು ಹೆಸರಿಸಿ, ಏನು ಮಾಡಬೇಕು ಎಂಬುದನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳುತ್ತದೆ, ನೀವು ಯಾರು ಎಂಬುದರ ಆಧಾರದ ಮೇಲೆ: ಆಸ್ತಮಾ, ವೃದ್ಧರು, ಮಕ್ಕಳು, ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು ಅಥವಾ ಹೃದಯದ ತೊಂದರೆ. ಇದು ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ ಅಥವಾ ಸುರಕ್ಷತಾ ಸಲಹೆಯಲ್ಲ; ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, NDMA ಮತ್ತು IMDಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    },
  "mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: CPCB, Airnet, Aurassure and Google AirView+ (via the OAQ broker) for air, Open-Meteo for weather, ERA5 reanalysis (Copernicus) for the heat normals, NDMA and IMD (via SACHET) for warnings, NASA FIRMS for fire smoke, JTWC for cyclone tracks, OpenStreetMap, GeoNames and bharatlas for places and the map of India, and the AQLI method for years of life lost. The code is open under the MIT licence; the data keeps each source's own terms.":
    {
      hi: "mugilu के पास कोई सेंसर नहीं है और वह कोई पूर्वानुमान नहीं चलाता। यह दूसरों के काम पर टिका है और उन्हें श्रेय देता है: वायु गुणवत्ता के लिए CPCB, Airnet, Aurassure और Google AirView+ (OAQ ब्रोकर के माध्यम से), मौसम के लिए Open-Meteo, गर्मी के सामान्य तापमान के लिए ERA5 पुनः विश्लेषण (Copernicus), चेतावनियों के लिए NDMA और IMD (SACHET के माध्यम से), आग के धुएं के लिए NASA FIRMS, चक्रवात के मार्गों के लिए JTWC, स्थानों और भारत के मानचित्र के लिए OpenStreetMap, GeoNames और bharatlas, और जीवन के खोए वर्षों के लिए AQLI विधि। कोड MIT लाइसेंस के तहत खुला है; डेटा पर हर स्रोत की अपनी शर्तें लागू रहती हैं।",
      kn: "mugilu ಯಾವುದೇ ಸಂವೇದಕಗಳನ್ನು ಹೊಂದಿಲ್ಲ ಮತ್ತು ಯಾವುದೇ ಮುನ್ಸೂಚನೆಗಳನ್ನು ನೀಡುವುದಿಲ್ಲ. ಇದು ಇತರರ ಕೆಲಸವನ್ನು ಆಧರಿಸಿದೆ ಮತ್ತು ಅವರಿಗೆ ಮನ್ನಣೆ ನೀಡುತ್ತದೆ: ವಾಯು ಗುಣಮಟ್ಟಕ್ಕಾಗಿ CPCB, Airnet, Aurassure ಮತ್ತು Google AirView+ (OAQ ಬ್ರೋಕರ್ ಮೂಲಕ), ಹವಾಮಾನಕ್ಕಾಗಿ Open-Meteo, ಸಾಮಾನ್ಯ ಗರಿಷ್ಠ ತಾಪಮಾನಕ್ಕಾಗಿ ERA5 ಮರುವಿಶ್ಲೇಷಣೆ (Copernicus), ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ NDMA ಮತ್ತು IMD (SACHET ಮೂಲಕ), ಬೆಂಕಿಯ ಹೊಗೆಗಾಗಿ NASA FIRMS, ಚಂಡಮಾರುತದ ಮಾರ್ಗಗಳಿಗಾಗಿ JTWC, ಸ್ಥಳಗಳು ಮತ್ತು ಭಾರತದ ನಕ್ಷೆಗಾಗಿ OpenStreetMap, GeoNames ಮತ್ತು bharatlas, ಮತ್ತು ಕಳೆದುಕೊಳ್ಳುವ ಆಯುಷ್ಯದ ವರ್ಷಗಳಿಗಾಗಿ AQLI ವಿಧಾನ. ಕೋಡ್ MIT ಪರವಾನಗಿ ಅಡಿಯಲ್ಲಿ ಮುಕ್ತವಾಗಿದೆ; ದತ್ತಾಂಶಕ್ಕೆ ಪ್ರತಿ ಮೂಲದ ಸ್ವಂತ ನಿಯಮಗಳೇ ಅನ್ವಯಿಸುತ್ತವೆ.",
    },
  none: {
    hi: "कोई नहीं",
    kn: "ಅಪಾಯವಿಲ್ಲ",
  },
  "The latest {n} official NDMA / IMD alerts across India.": {
    hi: "भारत भर के ताज़ा {n} आधिकारिक NDMA / IMD अलर्ट।",
    kn: "ಭಾರತದಾದ್ಯಂತದ ಇತ್ತೀಚಿನ {n} ಅಧಿಕೃತ NDMA / IMD ಎಚ್ಚರಿಕೆಗಳು.",
  },
  rain: {
    hi: "बारिश",
    kn: "ಮಳೆ",
  },
  safe: {
    hi: "सुरक्षित",
    kn: "ಸುರಕ್ಷಿತ",
  },
  "scan to see this on your phone": {
    hi: "अपने फ़ोन पर देखने के लिए इसे स्कैन करें",
    kn: "ನಿಮ್ಮ ಫೋನಿನಲ್ಲಿ ನೋಡಲು ಇದನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
  },
  // The lowercase level word (dust tile, wet-bulb read); same as "Severe".
  severe: {
    hi: "गंभीर",
    kn: "ತೀವ್ರ",
  },
  "severe dust": {
    hi: "गंभीर धूल",
    kn: "ತೀವ್ರ ಧೂಳು",
  },
  "severe heat": {
    hi: "भीषण गर्मी",
    kn: "ತೀವ್ರ ಬಿಸಿಲು",
  },
  sky: {
    hi: "आकाश",
    kn: "ಆಕಾಶ",
  },
  smoke: {
    hi: "धुआं",
    kn: "ಹೊಗೆ",
  },
  "storm-force": {
    hi: "प्रचंड तूफ़ानी हवा",
    kn: "ಬಿರುಗಾಳಿ",
  },
  strong: {
    hi: "तेज हवा",
    kn: "ಜೋರು ಗಾಳಿ",
  },
  sun: {
    hi: "धूप",
    kn: "ಸೂರ್ಯನ ಬೆಳಕು",
  },
  terms: {
    hi: "शर्तें",
    kn: "ಷರತ್ತುಗಳು",
  },
  "the sky at this point": {
    hi: "इस स्थान पर आकाश",
    kn: "ಈ ಸ್ಥಳದ ಮೇಲಿನ ಆಕಾಶ",
  },
  "thick fog": {
    hi: "घना कोहरा",
    kn: "ದಟ್ಟ ಮಂಜು",
  },
  "You then see its sky: air, heat, rain and dust.": {
    hi: "फिर आपको उस जगह का आसमान दिखेगा: वायु, गर्मी, बारिश और धूल।",
    kn: "ನಂತರ ಅಲ್ಲಿನ ಆಕಾಶ ಕಾಣುತ್ತದೆ: ವಾಯು ಗುಣಮಟ್ಟ, ಬಿಸಿಲು, ಮಳೆ ಮತ್ತು ಧೂಳು.",
  },
  updated: {
    hi: "अपडेट:",
    kn: "ನವೀಕರಿಸಿದ್ದು",
  },
  "very cold": {
    hi: "बहुत ठंड",
    kn: "ತುಂಬಾ ಚಳಿ",
  },
  "very high": {
    hi: "बहुत अधिक",
    kn: "ಅತಿ ಹೆಚ್ಚು",
  },
  "very hot": {
    hi: "तेज गर्मी",
    kn: "ತುಂಬಾ ಬಿಸಿಲು",
  },
  warm: {
    hi: "हल्का गर्म",
    kn: "ಬೆಚ್ಚಗೆ",
  },
  cool: { hi: "हल्की ठंडक", kn: "ತಂಪು" },
  mild: { hi: "सुहावना", kn: "ಹಿತಕರ" },
  warnings: {
    hi: "चेतावनियाँ",
    kn: "ಎಚ್ಚರಿಕೆಗಳು",
  },
  wind: {
    hi: "हवा",
    kn: "ಗಾಳಿ",
  },
  "years of life lost": {
    hi: "जीवन के खोए वर्ष",
    kn: "ವರ್ಷ ಆಯುಷ್ಯ ನಷ್ಟ",
  },
  // Persona exposure steps + short disclaimer (Sarvam draft, glossary-fixed; native review pending).
  "Spend less time outdoors today. Do not exercise hard outside.": {
    hi: "आज, बाहर कम समय बिताएं और बाहर कठिन व्यायाम न करें।",
    kn: "ಇಂದು, ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ಕಠಿಣ ವ್ಯಾಯಾಮವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Spend less time outdoors. Cover your nose and mouth when you go out.": {
    hi: "बाहर कम समय बिताएँ। बाहर जाते समय अपनी नाक और मुँह ढकें।",
    kn: "ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ, ಮತ್ತು ನೀವು ಹೊರಗೆ ಹೋದರೆ ನಿಮ್ಮ ಮೂಗು ಮತ್ತು ಬಾಯಿಯನ್ನು ಮುಚ್ಚಿಕೊಳ್ಳಿ.",
  },
  "Keep windows closed. Spend less time outdoors.": {
    hi: "खिड़कियाँ बंद रखें और बाहर कम समय बिताएँ।",
    kn: "ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  "Cover your nose and mouth when you go out in the cold.": {
    hi: "ठंड में बाहर जाते समय अपनी नाक और मुँह ढकें।",
    kn: "ಚಳಿಯಲ್ಲಿ ಹೊರಗೆ ಹೋದಾಗ ನಿಮ್ಮ ಮೂಗು ಮತ್ತು ಬಾಯಿಯನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ.",
  },
  "A hot home is also a risk. Stay in a cool place and drink water regularly. Ask someone to check on you.": {
    hi: "गर्म घर भी जोखिम भरा है: किसी ठंडी जगह पर रहें, नियमित रूप से पानी पिएँ, और किसी से कहें कि वह आपका हालचाल लेता रहे।",
    kn: "ಬಿಸಿಯಾದ ಮನೆಯೂ ಅಪಾಯಕಾರಿ: ತಂಪಾದ ಸ್ಥಳದಲ್ಲಿ ಇರಿ, ನಿಯಮಿತವಾಗಿ ನೀರು ಕುಡಿಯಿರಿ, ಮತ್ತು ಯಾರಾದರೂ ನಿಮ್ಮ ಯೋಗಕ್ಷೇಮ ವಿಚಾರಿಸುತ್ತಿರುವಂತೆ ನೋಡಿಕೊಳ್ಳಿ.",
  },
  "Keep your home warm and wear layers indoors. Ask someone to check on you.": {
    hi: "अपने घर को गर्म रखें, घर के अंदर भी कई परतों के कपड़े पहनें, और किसी से कहें कि वह आपका हालचाल लेता रहे।",
    kn: "ನಿಮ್ಮ ಮನೆಯನ್ನು ಬೆಚ್ಚಗಿಡಿ, ಮನೆಯ ಒಳಗೆ ಸಹ ಹಲವಾರು ಪದರಗಳ ಬಟ್ಟೆಗಳನ್ನು ಧರಿಸಿ, ಮತ್ತು ಯಾರಾದರೂ ನಿಮ್ಮ ಯೋಗಕ್ಷೇಮ ವಿಚಾರಿಸುತ್ತಿರುವಂತೆ ನೋಡಿಕೊಳ್ಳಿ.",
  },
  "Spend less time outdoors today. Avoid hard physical activity there.": {
    hi: "आज, बाहर कम समय बिताएं और बाहर भारी काम करने से बचें।",
    kn: "ಇಂದು, ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ಶ್ರಮದಾಯಕ ಕೆಲಸವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Use a hat, shade and sunscreen. Keep play short at midday.": {
    hi: "टोपी, छाया और सनस्क्रीन का इस्तेमाल करें। दोपहर में बच्चों का बाहर खेलना कम रखें।",
    kn: "ಮಗುವಿಗೆ ಟೋಪಿ, ನೆರಳು ಮತ್ತು ಸನ್‌ಸ್ಕ್ರೀನ್ ನೀಡಿ, ಮತ್ತು ಮಧ್ಯಾಹ್ನದ ಹೊತ್ತು ಹೊರಾಂಗಣ ಆಟವನ್ನು ಕಡಿಮೆ ಮಾಡಿ.",
  },
  "Today, keep outdoor play short and easy.": {
    hi: "आज बच्चे का बाहर का खेल छोटा और हल्का रखें।",
    kn: "ಇಂದು, ಮಗುವಿನ ಹೊರಾಂಗಣ ಆಟವನ್ನು ಚಿಕ್ಕದಾಗಿ ಮತ್ತು ಸೌಮ್ಯವಾಗಿರಿಸಿ.",
  },
  "Today, keep outdoor play short.": {
    hi: "आज बच्चे का बाहर का खेल छोटा रखें।",
    kn: "ಇಂದು, ಮಗುವಿನ ಹೊರಾಂಗಣ ಆಟವನ್ನು ಚಿಕ್ಕದಾಗಿರಿಸಿ.",
  },
  "Give children more water and keep play in the shade. Never leave a child in a parked vehicle.": {
    hi: "बच्चों को ज़्यादा पानी दें और उनका खेल छाया में रखें। बच्चे को कभी भी खड़ी गाड़ी में न छोड़ें।",
    kn: "ಮಗುವಿಗೆ ಹೆಚ್ಚುವರಿ ನೀರು ಕೊಡಿ, ಮಗುವಿನ ಆಟವನ್ನು ನೆರಳು ಇರುವ ಜಾಗದಲ್ಲಿ ಇಡಿ, ಮತ್ತು ನಿಲ್ಲಿಸಿದ ವಾಹನದಲ್ಲಿ ಮಗುವನ್ನು ಎಂದಿಗೂ ಒಬ್ಬಂಟಿಯಾಗಿ ಬಿಡಬೇಡಿ.",
  },
  "Dress children in layers. Cover their head and hands.": {
    hi: "बच्चों को कई परतों के कपड़े पहनाएं और उनके सिर और हाथों को ढकें।",
    kn: "ಮಕ್ಕಳಿಗೆ ಹಲವಾರು ಪದರಗಳ ಬಟ್ಟೆ ತೊಡಿಸಿ ಮತ್ತು ಅವರ ತಲೆ ಮತ್ತು ಕೈಗಳನ್ನು ಮುಚ್ಚಿ.",
  },
  "Keep children indoors with the windows closed.": {
    hi: "खिड़कियाँ बंद करके बच्चों को घर के अंदर रखें।",
    kn: "ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಮಕ್ಕಳನ್ನು ಮನೆಯೊಳಗೆ ಇರಿಸಿ.",
  },
  "Drink water often and take breaks in the shade. Do not do heavy work from 12 to 3 pm.": {
    hi: "बार-बार पानी पिएँ, छाया में नियमित रूप से आराम करें, और दोपहर 12 बजे से 3 बजे के बीच भारी काम न करें।",
    kn: "ಆಗಾಗ್ಗೆ ನೀರು ಕುಡಿಯಿರಿ, ನೆರಳಿನಲ್ಲಿ ನಿಯಮಿತವಾಗಿ ವಿಶ್ರಾಂತಿ ತೆಗೆದುಕೊಳ್ಳಿ, ಮತ್ತು ಮಧ್ಯಾಹ್ನ 12 ರಿಂದ 3 ಗಂಟೆಯವರೆಗೆ ಭಾರವಾದ ಕೆಲಸಗಳನ್ನು ಮಾಡಬೇಡಿ.",
  },
  "Wear layers and stay dry. Take breaks in a warm place.": {
    hi: "कई परतों के कपड़े पहनें, सूखे रहें और गर्म जगह पर आराम करें।",
    kn: "ಹಲವಾರು ಪದರಗಳ ಬಟ್ಟೆಗಳನ್ನು ಧರಿಸಿ, ಒಣಗಿರಿ ಮತ್ತು ಬೆಚ್ಚಗಿನ ಸ್ಥಳದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ವಿರಾಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.",
  },
  "Cover your skin and wear a hat. Take breaks in the shade at midday.": {
    hi: "अपनी त्वचा को कपड़ों से ढकें, टोपी पहनें, और दोपहर के आसपास छाया में आराम करें।",
    kn: "ನಿಮ್ಮ ಚರ್ಮವನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ, ಟೋಪಿ ಧರಿಸಿ ಮತ್ತು ಮಧ್ಯಾಹ್ನದ ಸುಮಾರಿಗೆ ನೆರಳು ಇರುವ ಜಾಗದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ತೆಗೆದುಕೊಳ್ಳಿ.",
  },
  "Do lighter work, not heavy work. Take breaks indoors.": {
    hi: "भारी काम की जगह हल्के काम करें, और बीच-बीच में अंदर आराम करें।",
    kn: "ಭಾರವಾದ ಕೆಲಸಗಳ ಬದಲಿಗೆ ಹಗುರವಾದ ಕೆಲಸಗಳನ್ನು ಮಾಡಿ ಮತ್ತು ಒಳಾಂಗಣದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ವಿರಾಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.",
  },
  "Cover your nose and mouth. Protect your eyes.": {
    hi: "अपनी नाक और मुँह ढकें और अपनी आँखों को धूल से बचाएं।",
    kn: "ನಿಮ್ಮ ಮೂಗು ಮತ್ತು ಬಾಯಿಯನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ ಮತ್ತು ಧೂಳಿನಿಂದ ನಿಮ್ಮ ಕಣ್ಣುಗಳನ್ನು ರಕ್ಷಿಸಿಕೊಳ್ಳಿ.",
  },
  "Take breaks indoors. Keep heavy work short.": {
    hi: "बीच-बीच में अंदर आराम करें, और भारी काम थोड़े समय के लिए ही करें।",
    kn: "ಒಳಾಂಗಣದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ವಿರಾಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ ಮತ್ತು ಸ್ವಲ್ಪ ಸಮಯದವರೆಗೆ ಮಾತ್ರ ಭಾರವಾದ ಕೆಲಸ ಮಾಡಿ.",
  },
  "Avoid hard physical activity. Stay in a cool place.": {
    hi: "भारी काम से बचें और ठंडी जगह पर रहें।",
    kn: "ಶ್ರಮದಾಯಕ ಕೆಲಸವನ್ನು ತಪ್ಪಿಸಿ ಮತ್ತು ತಂಪಾದ ಸ್ಥಳದಲ್ಲಿ ಇರಿ.",
  },
  "Stay warm. Avoid sudden hard physical activity in the cold.": {
    hi: "अपने शरीर को गर्म रखें और ठंड में अचानक भारी काम करने से बचें।",
    kn: "ನಿಮ್ಮ ದೇಹವನ್ನು ಬೆಚ್ಚಗಿಟ್ಟುಕೊಳ್ಳಿ ಮತ್ತು ಚಳಿಯಲ್ಲಿ ಹಠಾತ್ ಶ್ರಮದಾಯಕ ಕೆಲಸವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Avoid hard physical activity outdoors today.": {
    hi: "आज, बाहर भारी काम करने से बचें।",
    kn: "ಇಂದು, ಹೊರಾಂಗಣದಲ್ಲಿ ಶ್ರಮದಾಯಕ ಕೆಲಸವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Stay indoors with the windows closed. Avoid hard physical activity.": {
    hi: "खिड़कियाँ बंद करके घर के अंदर रहें और भारी काम से बचें।",
    kn: "ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಒಳಾಂಗಣದಲ್ಲಿ ಇರಿ ಮತ್ತು ಶ್ರಮದಾಯಕ ಕೆಲಸವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "The heat is dangerous. Go to a cool place out of the sun. Drink water.": {
    hi: "गर्मी खतरनाक है। धूप से दूर एक ठंडी जगह पर जाएं और पानी पिएं।",
    kn: "ಬಿಸಿಲು ಅಪಾಯಕಾರಿಯಾಗಿದೆ. ಬಿಸಿಲಿನಿಂದ ದೂರ, ತಂಪಾದ ಸ್ಥಳಕ್ಕೆ ಹೋಗಿ. ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ.",
  },
  "Informational only, not medical advice.": {
    hi: "यह केवल जानकारी के लिए है, और यह चिकित्सीय सलाह नहीं है।",
    kn: "ಇದು ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ಮತ್ತು ಇದು ವೈದ್ಯಕೀಯ ಸಲಹೆಯಲ್ಲ.",
  },
  // "Install app" button + iOS Add-to-Home-Screen guide (install.ts). Draft, pending
  // native review. The quoted iOS labels follow iOS's own hi/kn UI wording.
  "Install app": { hi: "ऐप इंस्टॉल करें", kn: "ಆ್ಯಪ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ" },
  "Add mugilu to your Home Screen": {
    hi: "mugilu को अपनी होम स्क्रीन पर जोड़ें",
    kn: "mugilu ಅನ್ನು ನಿಮ್ಮ ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ",
  },
  "Tap the Share button (the square with an arrow) in Safari's toolbar.": {
    hi: "Safari के टूलबार में शेयर करें बटन (तीर वाला चौकोर) पर टैप करें।",
    kn: "Safari ಟೂಲ್‌ಬಾರ್‌ನಲ್ಲಿರುವ ಹಂಚಿಕೊಳ್ಳಿ ಬಟನ್ (ಬಾಣದ ಗುರುತಿನ ಚೌಕ) ಅನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.",
  },
  "Scroll down and tap Add to Home Screen.": {
    hi: "नीचे स्क्रॉल करें और होम स्क्रीन में जोड़ें पर टैप करें।",
    kn: "ಕೆಳಗೆ ಸ್ಕ್ರಾಲ್ ಮಾಡಿ, ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ ಅನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.",
  },
  "Tap Add.": { hi: "जोड़ें पर टैप करें।", kn: "ಸೇರಿಸಿ ಅನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ." },
  OK: { hi: "ठीक है", kn: "ಸರಿ" },
  // Offline (sw.ts): drafted here, native review pending.
  "No connection. This is the last reading on this device, from X. The conditions and warnings can be different now.": {
    hi: "कनेक्शन नहीं है। ये इस डिवाइस पर सहेजे गए आख़िरी आँकड़े हैं, X के। तब से हालात और चेतावनियाँ बदल चुकी हो सकती हैं।",
    kn: "ಸಂಪರ್ಕವಿಲ್ಲ. ಇದು ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಿದ ಕೊನೆಯ ಮಾಹಿತಿ (X). ಈಗ ಪರಿಸ್ಥಿತಿ ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳು ಬೇರೆ ಇರಬಹುದು.",
  },
  "You are offline": { hi: "आप ऑफ़लाइन हैं", kn: "ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ" },
  "mugilu shows the sky right now, so it needs a connection. Places you have opened on this device keep their last reading.":
    {
      hi: "mugilu अभी का आसमान दिखाता है, इसलिए इसे इंटरनेट कनेक्शन चाहिए। इस डिवाइस पर पहले खोली गई जगहों के आख़िरी आँकड़े सहेजे रहते हैं।",
      kn: "mugilu ಈಗಿನ ಆಕಾಶವನ್ನು ತೋರಿಸುತ್ತದೆ, ಆದ್ದರಿಂದ ಇದಕ್ಕೆ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಬೇಕು. ಈ ಸಾಧನದಲ್ಲಿ ಹಿಂದೆ ತೆರೆದ ಸ್ಥಳಗಳ ಕೊನೆಯ ಮಾಹಿತಿ ಉಳಿದಿರುತ್ತದೆ.",
    },
  "Near this point, but not at it:": { hi: "पास में, इस जगह पर नहीं:", kn: "ಈ ಸ್ಥಳದ ಹತ್ತಿರ, ಆದರೆ ಇಲ್ಲೇ ಅಲ್ಲ:" },
  "See your places": { hi: "अपनी जगहें देखें", kn: "ನಿಮ್ಮ ಸ್ಥಳಗಳನ್ನು ನೋಡಿ" },
  // Opt-in alerts (alerts.ts, alerts-ui.ts): drafted here, native review pending.
  "Official warning for X, until Y.": { hi: "X के लिए आधिकारिक चेतावनी, Y तक।", kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ: X, Y ವರೆಗೆ." },
  "Official warning for X.": { hi: "X के लिए आधिकारिक चेतावनी।", kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ: X." },
  "Send me official warnings for this place": {
    hi: "यहाँ की आधिकारिक चेतावनियों के बारे में मुझे सूचित करें",
    kn: "ಇಲ್ಲಿನ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳ ಬಗ್ಗೆ ನನಗೆ ತಿಳಿಸಿ",
  },
  "Alerts are on for this place.": { hi: "इस जगह के लिए अलर्ट चालू हैं।", kn: "ಈ ಸ್ಥಳಕ್ಕೆ ಅಲರ್ಟ್‌ಗಳು ಆನ್ ಆಗಿವೆ." },
  "Turn off": { hi: "बंद करें", kn: "ಆಫ್ ಮಾಡಿ" },
  "Your browser blocks notifications from mugilu. Allow them in the site settings of your browser. Then try again.": {
    hi: "mugilu के लिए सूचनाएँ बंद हैं। अपने ब्राउज़र की साइट सेटिंग में इन्हें अनुमति दें, फिर दोबारा कोशिश करें।",
    kn: "ನಿಮ್ಮ ಬ್ರೌಸರ್ mugilu ನಿಂದ ಬರುವ ಅಧಿಸೂಚನೆಗಳನ್ನು ತಡೆಯುತ್ತಿದೆ. ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಸೈಟ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅವುಗಳನ್ನು ಅನುಮತಿಸಿ. ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  "Alerts are on for 12 places. That is the limit. Turn off alerts for one place first.": {
    hi: "12 जगहों के लिए अलर्ट चालू हैं। इससे ज़्यादा नहीं हो सकते। पहले किसी एक जगह के अलर्ट बंद करें।",
    kn: "12 ಸ್ಥಳಗಳಿಗೆ ಅಲರ್ಟ್‌ಗಳು ಆನ್ ಆಗಿವೆ. ಇದೇ ಗರಿಷ್ಠ ಮಿತಿ. ಮೊದಲು ಒಂದು ಸ್ಥಳದ ಅಲರ್ಟ್‌ಗಳನ್ನು ಆಫ್ ಮಾಡಿ.",
  },
  "Alerts could not be turned on. Try again.": {
    hi: "अलर्ट चालू नहीं हो सके। दोबारा कोशिश करें।",
    kn: "ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  "On iPhone and iPad, first add mugilu to your Home Screen (Share, then Add to Home Screen). Open mugilu from the Home Screen. Then turn on alerts here.":
    {
      hi: "iPhone और iPad पर, पहले mugilu को अपनी होम स्क्रीन पर जोड़ें (शेयर करें, फिर होम स्क्रीन में जोड़ें), उसे वहीं से खोलें, और यहाँ अलर्ट चालू करें।",
      kn: "iPhone ಮತ್ತು iPad ನಲ್ಲಿ, ಮೊದಲು mugilu ಅನ್ನು ನಿಮ್ಮ ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ (ಹಂಚಿಕೊಳ್ಳಿ, ನಂತರ ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ), ಅಲ್ಲಿಂದ ತೆರೆಯಿರಿ, ಮತ್ತು ಇಲ್ಲಿ ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಿ.",
    },
  // The alerts note, split by state (sentences of the reviewed translation, recombined).
  "Alerts are opt-in. When you turn on alerts, mugilu keeps this place (to approximately 1 km) and the push address of your browser. mugilu uses them only to send you official NDMA/IMD warnings for this place.":
    {
      hi: "अलर्ट तभी चालू होते हैं जब आप खुद चुनें। अलर्ट चालू करने पर mugilu यह जगह (लगभग 1 km तक) और आपके ब्राउज़र का पुश पता रखता है, और इनका इस्तेमाल केवल इस जगह की आधिकारिक NDMA/IMD चेतावनियाँ भेजने के लिए करता है।",
      kn: "ಅಲರ್ಟ್‌ಗಳು ನೀವು ಆಯ್ಕೆ ಮಾಡಿದರೆ ಮಾತ್ರ. ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಿದಾಗ, mugilu ಈ ಸ್ಥಳವನ್ನು (ಸುಮಾರು 1 km ನಿಖರತೆಯಲ್ಲಿ) ಮತ್ತು ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಪುಶ್ ವಿಳಾಸವನ್ನು ಇಟ್ಟುಕೊಳ್ಳುತ್ತದೆ. mugilu ಇವುಗಳನ್ನು ಈ ಸ್ಥಳದ ಅಧಿಕೃತ NDMA/IMD ಎಚ್ಚರಿಕೆಗಳನ್ನು ಕಳುಹಿಸಲು ಮಾತ್ರ ಬಳಸುತ್ತದೆ.",
    },
  "When you turn off alerts, mugilu deletes this place and the push address of your browser.": {
    hi: "अलर्ट बंद करने पर mugilu यह जगह और आपके ब्राउज़र का पुश पता मिटा देता है।",
    kn: "ಅಲರ್ಟ್‌ಗಳನ್ನು ಆಫ್ ಮಾಡಿದಾಗ, mugilu ಈ ಸ್ಥಳ ಮತ್ತು ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಪುಶ್ ವಿಳಾಸವನ್ನು ಅಳಿಸುತ್ತದೆ.",
  },
  "If you turn on alerts for a place, mugilu keeps that place (to about 1 km) and your browser's push address, only to send you official warnings for it, and deletes them when you turn alerts off.":
    {
      hi: "अगर आप किसी जगह के लिए अलर्ट चालू करते हैं, तो mugilu वह जगह (लगभग 1 km तक) और आपके ब्राउज़र का पुश पता रखता है, केवल उस जगह की आधिकारिक चेतावनियाँ भेजने के लिए, और अलर्ट बंद करने पर इन्हें मिटा देता है।",
      kn: "ನೀವು ಒಂದು ಸ್ಥಳಕ್ಕೆ ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಿದರೆ, mugilu ಆ ಸ್ಥಳವನ್ನು (ಸುಮಾರು 1 km ನಿಖರತೆಯಲ್ಲಿ) ಮತ್ತು ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಪುಶ್ ವಿಳಾಸವನ್ನು ಇಟ್ಟುಕೊಳ್ಳುತ್ತದೆ, ಆ ಸ್ಥಳದ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಕಳುಹಿಸಲು ಮಾತ್ರ, ಮತ್ತು ಅಲರ್ಟ್‌ಗಳನ್ನು ಆಫ್ ಮಾಡಿದಾಗ ಅವುಗಳನ್ನು ಅಳಿಸುತ್ತದೆ.",
    },
  // /c strata, warnings, kiosk and embed detail (2026-10). Compared against a Bhashini
  // pass; kept whichever read better with the reviewed vocabulary above (Bhashini
  // transliterates proper nouns and breaks the X / {…} slots, so slotted strings are
  // hand-drafted). Pending native review. X is a number/time slot; {…} are filled by
  // the renderer.
  "For {persona}, also watch: {hazard} is {band}.": {
    hi: "{persona} के लिए ध्यान दें: {hazard} भी {band} स्तर पर है।",
    kn: "{persona}: ಇದನ್ನೂ ಗಮನಿಸಿ, {hazard} ಮಟ್ಟ {band}.",
  },
  "the sun": {
    hi: "धूप",
    kn: "ಸೂರ್ಯನ ಬೆಳಕು",
  },
  "the official warning": {
    hi: "आधिकारिक चेतावनी",
    kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ",
  },
  actual: {
    hi: "वास्तविक",
    kn: "ನಿಜವಾದ",
  },
  humidity: {
    hi: "आर्द्रता",
    kn: "ಆರ್ದ್ರತೆ",
  },
  "wet-bulb": {
    hi: "वेट-बल्ब",
    kn: "ವೆಟ್ ಬಲ್ಬ್",
  },
  "from X": {
    hi: "X दिशा से",
    kn: "X ದಿಕ್ಕಿನಿಂದ",
  },
  "X km/h steady": {
    hi: "X km/h स्थिर",
    kn: "X km/h ಸ್ಥಿರ",
  },
  "nearest X km": {
    hi: "निकटतम X km",
    kn: "ಹತ್ತಿರದ್ದು X km",
  },
  "X MW of fire power": {
    hi: "आग की शक्ति X MW",
    kn: "X MW ಬೆಂಕಿಯ ಶಕ್ತಿ",
  },
  "fires within 100 km": {
    hi: "100 km के भीतर आग",
    kn: "100 km ಒಳಗಿನ ಬೆಂಕಿ",
  },
  "some burning": {
    hi: "कहीं-कहीं आग",
    kn: "ಸ್ವಲ್ಪ ಬೆಂಕಿ",
  },
  "notable burning": {
    hi: "काफ़ी आग",
    kn: "ಗಮನಾರ್ಹ ಬೆಂಕಿ",
  },
  "heavy burning": {
    hi: "बहुत ज़्यादा आग",
    kn: "ಭಾರೀ ಬೆಂಕಿ",
  },
  "X mm of rain now": {
    hi: "अभी X mm बारिश",
    kn: "ಈಗ X mm ಮಳೆ",
  },
  now: {
    hi: "अभी",
    kn: "ಈಗ",
  },
  "until X": {
    hi: "X तक",
    kn: "X ವರೆಗೆ",
  },
  "Official warning": {
    hi: "आधिकारिक चेतावनी",
    kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ",
  },
  "+X more": {
    hi: "+X और",
    kn: "+X ಇನ್ನಷ್ಟು",
  },
  "Reading the sky": {
    hi: "आसमान पढ़ रहे हैं",
    kn: "ಆಕಾಶವನ್ನು ಓದುತ್ತಿದೆ",
  },
  "Checking the air": {
    hi: "वायु गुणवत्ता की जाँच कर रहे हैं",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ ಪರಿಶೀಲಿಸುತ್ತಿದೆ",
  },
  "Gauging the heat": {
    hi: "गर्मी माप रहे हैं",
    kn: "ಬಿಸಿಲನ್ನು ಅಳೆಯುತ್ತಿದೆ",
  },
  "Watching for warnings": {
    hi: "चेतावनियों पर नज़र रख रहे हैं",
    kn: "ಎಚ್ಚರಿಕೆಗಳ ಮೇಲೆ ನಿಗಾ ಇಡುತ್ತಿದೆ",
  },
  "Catching the wind": {
    hi: "हवा का रुख देख रहे हैं",
    kn: "ಗಾಳಿಯನ್ನು ಗಮನಿಸುತ್ತಿದೆ",
  },
  "Looking up": {
    hi: "आसमान की ओर देख रहे हैं",
    kn: "ಆಕಾಶವನ್ನು ನೋಡುತ್ತಿದೆ",
  },
  "as of X": {
    hi: "X की स्थिति",
    kn: "X ರಂತೆ",
  },
  "Embed this": {
    hi: "इसे एम्बेड करें",
    kn: "ಇದನ್ನು ಎಂಬೆಡ್ ಮಾಡಿ",
  },
  "Live widget (iframe):": {
    hi: "लाइव विजेट (iframe):",
    kn: "ಲೈವ್ ವಿಜೆಟ್ (iframe):",
  },
  "Or an image with the time on it:": {
    hi: "या टाइमस्टैम्प के साथ एक छवि:",
    kn: "ಅಥವಾ ಟೈಮ್‌ಸ್ಟ್ಯಾಂಪ್ ಹೊಂದಿರುವ ಚಿತ್ರ:",
  },
  // Heat compared with normal (heatnormals.ts). Bhashini draft from concrete samples
  // ("41°C ... 5°C ... late May"), templated by hand: "modelled" as अनुमानित / ಅಂದಾಜು like
  // the "modelled" label, °C kept compact, ERA5/Open-Meteo kept Latin, ತಾಪಮಾನ
  // (temperature) as elsewhere here. Native review pending.
  // {t}/{d} are whole °C; {period} is one of the three locative phrases below, with a
  // localised month name from Intl.
  "The high today is {t}°C. That is {d}°C above normal for {period}.": {
    hi: "यहाँ आज का अनुमानित अधिकतम तापमान {t}°C है, जो {period} सामान्य से {d}°C अधिक है।",
    kn: "ಇಂದಿನ ಅಂದಾಜು ಗರಿಷ್ಠ ತಾಪಮಾನ {t}°C, ಈ ಸ್ಥಳದಲ್ಲಿ {period} ಸಾಮಾನ್ಯಕ್ಕಿಂತ {d}°C ಹೆಚ್ಚು.",
  },
  "The high today is {t}°C. That is {d}°C below normal for {period}.": {
    hi: "यहाँ आज का अनुमानित अधिकतम तापमान {t}°C है, जो {period} सामान्य से {d}°C कम है।",
    kn: "ಇಂದಿನ ಅಂದಾಜು ಗರಿಷ್ಠ ತಾಪಮಾನ {t}°C, ಈ ಸ್ಥಳದಲ್ಲಿ {period} ಸಾಮಾನ್ಯಕ್ಕಿಂತ {d}°C ಕಡಿಮೆ.",
  },
  "early {month}": { hi: "{month} की शुरुआत में", kn: "{month} ತಿಂಗಳ ಆರಂಭದಲ್ಲಿ" },
  "mid {month}": { hi: "{month} के मध्य में", kn: "{month} ತಿಂಗಳ ಮಧ್ಯದಲ್ಲಿ" },
  "late {month}": { hi: "{month} के अंत में", kn: "{month} ತಿಂಗಳ ಕೊನೆಯಲ್ಲಿ" },
  "Today's high is a model value (Open-Meteo). The normal is from ERA5 data for 1991-2020.": {
    hi: "आज का अधिकतम तापमान एक मॉडल अनुमान है (Open-Meteo); सामान्य तापमान 1991-2020 के ERA5 पुनः विश्लेषण से है।",
    kn: "ಇಂದಿನ ಗರಿಷ್ಠ ತಾಪಮಾನ ಮಾದರಿ ಅಂದಾಜು (Open-Meteo); ಸಾಮಾನ್ಯ ತಾಪಮಾನ 1991-2020ರ ERA5 ಮರುವಿಶ್ಲೇಷಣೆಯಿಂದ.",
  },
  // /c graphics key + home location button and rename prompt (Bhashini draft,
  // hand-fixed). Native review pending.
  "The dashed line is the CPCB limit.": {
    hi: "डैश वाली रेखा CPCB की सीमा है।",
    kn: "ಡ್ಯಾಶ್ ಮಾಡಿದ ರೇಖೆಯು CPCB ಮಿತಿಯಾಗಿದೆ.",
  },
  "Finding your location…": { hi: "आपका स्थान खोजा जा रहा है…", kn: "ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…" },
  "Your location is not available.": { hi: "आपका स्थान उपलब्ध नहीं है।", kn: "ನಿಮ್ಮ ಸ್ಥಳವು ಲಭ್ಯವಿಲ್ಲ." },
  "Type a name for this place (for example, Home or Office)": {
    hi: "इस स्थान के लिए एक नाम टाइप करें (उदाहरण के लिए, घर या कार्यालय)",
    kn: "ಈ ಸ್ಥಳಕ್ಕೆ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ (ಉದಾಹರಣೆಗೆ, ಮನೆ ಅಥವಾ ಕಚೇರಿ)",
  },
  // Persona read: the hazard's first sentence, then how this group should take it
  // (sentences of the reviewed advice, split; the template and tag are new, pending
  // native review).
  "For {persona}, treat it as {band}.": {
    hi: "{persona} के लिए इसे {band} मानें।",
    kn: "{persona}: ಇದನ್ನು {band} ಎಂದು ಪರಿಗಣಿಸಿ.",
  },
  "for you": { hi: "आपके लिए", kn: "ನಿಮಗಾಗಿ" },
  "The air is moderate.": { hi: "वायु गुणवत्ता मध्यम है।", kn: "ವಾಯು ಗುಣಮಟ್ಟ ಮಧ್ಯಮವಾಗಿದೆ." },
  "The air is poor.": { hi: "वायु गुणवत्ता खराब है।", kn: "ವಾಯು ಗುಣಮಟ್ಟ ಕೆಟ್ಟದಾಗಿದೆ." },
  "It is very hot.": { hi: "बहुत गर्मी है।", kn: "ತುಂಬಾ ಬಿಸಿಲು ಇದೆ." },
  "The heat is high.": { hi: "गर्मी अधिक है।", kn: "ಬಿಸಿಲು ಹೆಚ್ಚಾಗಿದೆ." },
  "It is cold outside.": { hi: "बाहर ठंड है।", kn: "ಹೊರಗೆ ಚಳಿ ಇದೆ." },
  "It is very cold.": { hi: "बहुत ठंड है।", kn: "ತುಂಬಾ ಚಳಿ ಇದೆ." },
  "The sun is strong.": { hi: "धूप तेज़ है।", kn: "ಸೂರ್ಯನ ಬೆಳಕು ಪ್ರಖರವಾಗಿದೆ." },
  "The sun is very strong.": { hi: "धूप बहुत तेज़ है।", kn: "ಸೂರ್ಯನ ಬೆಳಕು ತುಂಬಾ ಪ್ರಖರವಾಗಿದೆ." },
  "There is a lot of dust.": { hi: "बहुत धूल है।", kn: "ಗಾಳಿಯಲ್ಲಿ ತುಂಬಾ ಧೂಳು ಇದೆ." },
  "There are fires near here.": { hi: "पास में आग लगी हुई है।", kn: "ಹತ್ತಿರದಲ್ಲಿ ಬೆಂಕಿ ಹೊತ್ತಿಕೊಂಡಿದೆ." },
  "There is a lot of burning near here.": {
    hi: "आस-पास कई जगह आग जल रही है।",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ಹಲವು ಕಡೆ ಬೆಂಕಿ ಉರಿಯುತ್ತಿದೆ.",
  },
  "Today against normal": { hi: "आज बनाम सामान्य", kn: "ಇಂದು, ಸಾಮಾನ್ಯಕ್ಕೆ ಹೋಲಿಸಿದರೆ" },
  "On days when it stands out, the heat layer compares today's modelled high with the normal high for that place and time of year, from 1991-2020 ERA5 reanalysis (Copernicus) via Open-Meteo. It shows only when the two are 3 °C or more apart. It is not a heatwave declaration, which only IMD makes.":
    {
      hi: "जिन दिनों यह अलग दिखता है, गर्मी की परत आज के अनुमानित अधिकतम तापमान की तुलना उस जगह और साल के उस समय के सामान्य अधिकतम तापमान से करती है, जो 1991-2020 के ERA5 पुनः विश्लेषण (Copernicus) से Open-Meteo के ज़रिए आता है। यह तभी दिखता है जब दोनों में 3 °C या अधिक का अंतर हो। यह लू की घोषणा नहीं है; वह केवल IMD करता है।",
      kn: "ಅದು ಎದ್ದು ಕಾಣುವ ದಿನಗಳಲ್ಲಿ, ಬಿಸಿಲಿನ ಪದರವು ಇಂದಿನ ಅಂದಾಜು ಗರಿಷ್ಠ ತಾಪಮಾನವನ್ನು ಆ ಸ್ಥಳ ಮತ್ತು ವರ್ಷದ ಆ ಸಮಯದ ಸಾಮಾನ್ಯ ಗರಿಷ್ಠ ತಾಪಮಾನದೊಂದಿಗೆ ಹೋಲಿಸುತ್ತದೆ; ಸಾಮಾನ್ಯ ತಾಪಮಾನ 1991-2020ರ ERA5 ಮರುವಿಶ್ಲೇಷಣೆಯಿಂದ (Copernicus) Open-Meteo ಮೂಲಕ ಬರುತ್ತದೆ. ಎರಡರ ನಡುವೆ 3 °C ಅಥವಾ ಹೆಚ್ಚು ಅಂತರವಿದ್ದಾಗ ಮಾತ್ರ ಇದು ಕಾಣಿಸುತ್ತದೆ. ಇದು ಬಿಸಿಗಾಳಿ ಘೋಷಣೆಯಲ್ಲ; ಅದನ್ನು IMD ಮಾತ್ರ ಮಾಡುತ್ತದೆ.",
    },
  // UI audit (2026-10): footer and nearby links, and the separate air-reading age.
  // Drafts pending native review.
  "Nearby:": { hi: "आस-पास:", kn: "ಹತ್ತಿರದ ಸ್ಥಳಗಳು:" },
  "Around {place}:": { hi: "{place} के आस-पास:", kn: "{place} ಸುತ್ತಮುತ್ತ:" },
  "Find your ward: {place} ward map": {
    hi: "अपना वार्ड खोजें: {place} वार्ड नक्शा",
    kn: "ನಿಮ್ಮ ವಾರ್ಡ್ ಹುಡುಕಿ: {place} ವಾರ್ಡ್ ನಕ್ಷೆ",
  },
  "Species of {state}": { hi: "{state} की प्रजातियाँ", kn: "{state}: ಜೀವಪ್ರಭೇದಗಳು" },
  "Nearby places": { hi: "आस-पास के स्थान", kn: "ಹತ್ತಿರದ ಸ್ಥಳಗಳು" },
  "all places": { hi: "सभी स्थान", kn: "ಎಲ್ಲಾ ಸ್ಥಳಗಳು" },
  // The footer's groups and the two links named for what they open.
  "Use it": { hi: "इस्तेमाल करें", kn: "ಬಳಸಿ" },
  "About mugilu": { hi: "mugilu के बारे में", kn: "mugilu ಬಗ್ಗೆ" },
  "API and embeds": { hi: "API और एम्बेड", kn: "API ಮತ್ತು ಎಂಬೆಡ್" },
  "terms and sources": { hi: "शर्तें और स्रोत", kn: "ಷರತ್ತುಗಳು ಮತ್ತು ಮೂಲಗಳು" },
  "Code MIT. Each source keeps its own licence.": {
    hi: "कोड MIT है। हर स्रोत का अपना लाइसेंस बना रहता है।",
    kn: "ಕೋಡ್ MIT. ಪ್ರತಿ ಮೂಲವು ತನ್ನದೇ ಪರವಾನಗಿಯನ್ನು ಉಳಿಸಿಕೊಳ್ಳುತ್ತದೆ.",
  },
  "put this on a screen": { hi: "इसे स्क्रीन पर लगाएँ", kn: "ಇದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಹಾಕಿ" },
  Menu: { hi: "मेनू", kn: "ಮೆನು" },
  // The /places directory (its hazard lists come from hazards.ts).
  [`Every place in India: ${HAZARDS_SHORT} by district · mugilu`]: {
    hi: `भारत का हर स्थान: ज़िलेवार ${HAZARDS_SHORT_TR.hi} · mugilu`,
    kn: `ಭಾರತದ ಪ್ರತಿಯೊಂದು ಸ್ಥಳ: ಜಿಲ್ಲಾವಾರು ${HAZARDS_SHORT_TR.kn} · mugilu`,
  },
  [`Browse the sky over every district and major city in India: the ${HAZARDS}, one page each.`]: {
    hi: `भारत के हर ज़िले और बड़े शहर का आकाश देखें: ${HAZARDS_TR.hi}, हर एक का अपना पेज।`,
    kn: `ಭಾರತದ ಪ್ರತಿ ಜಿಲ್ಲೆ ಮತ್ತು ಪ್ರಮುಖ ನಗರದ ಆಕಾಶವನ್ನು ನೋಡಿ: ${HAZARDS_TR.kn}, ಪ್ರತಿಯೊಂದಕ್ಕೂ ಒಂದು ಪುಟ.`,
  },
  "Every place, by state": { hi: "हर स्थान, राज्यवार", kn: "ಪ್ರತಿಯೊಂದು ಸ್ಥಳ, ರಾಜ್ಯವಾರು" },
  [`The sky over every district and major city in India, one page each. Pick a place to see its ${HAZARDS} right now.`]:
    {
      hi: `भारत के हर ज़िले और बड़े शहर का आकाश, हर एक का अपना पेज। कोई स्थान चुनें और देखें: वहाँ अभी ${HAZARDS_TR.hi}।`,
      kn: `ಭಾರತದ ಪ್ರತಿ ಜಿಲ್ಲೆ ಮತ್ತು ಪ್ರಮುಖ ನಗರದ ಆಕಾಶ, ಪ್ರತಿಯೊಂದಕ್ಕೂ ಒಂದು ಪುಟ. ಒಂದು ಸ್ಥಳವನ್ನು ಆರಿಸಿ: ಅಲ್ಲಿನ ಈಗಿನ ${HAZARDS_TR.kn}.`,
    },
  "places across India": { hi: "भारत भर के स्थान", kn: "ಭಾರತದಾದ್ಯಂತದ ಸ್ಥಳಗಳು" },
  "air reading": { hi: "वायु के आँकड़े:", kn: "ವಾಯು ಗುಣಮಟ್ಟ ಮಾಹಿತಿ" },
  // the weather taken from the 4-hourly grid when the live call failed (draft, pending native review)
  "weather reading": { hi: "मौसम के आँकड़े:", kn: "ಹವಾಮಾನ ಮಾಹಿತಿ" },
  // The place page's "Last 30 days" (ui/history.ts). {n} {d} {s} {m} {level} are slots.
  "Last 30 days": { hi: "पिछले 30 दिन", kn: "ಕಳೆದ 30 ದಿನಗಳು" },
  "Air, the worst AQI of each day, for {n} days": {
    hi: "वायु, हर दिन का सबसे खराब AQI, {n} दिनों का",
    kn: "ವಾಯು, ಪ್ರತಿ ದಿನದ ಅತಿ ಕೆಟ್ಟ AQI, {n} ದಿನಗಳದ್ದು",
  },
  "Air was very poor or severe on {n} of {d} days.": {
    hi: "{d} में से {n} दिन वायु बहुत खराब या गंभीर रही।",
    kn: "{d} ದಿನಗಳಲ್ಲಿ {n} ದಿನ ವಾಯು ತುಂಬಾ ಕೆಟ್ಟ ಅಥವಾ ತೀವ್ರ ಮಟ್ಟದಲ್ಲಿತ್ತು.",
  },
  "Air was poor on {n} of {d} days, never worse.": {
    hi: "{d} में से {n} दिन वायु खराब रही, इससे बुरी कभी नहीं।",
    kn: "{d} ದಿನಗಳಲ್ಲಿ {n} ದಿನ ವಾಯು ಕೆಟ್ಟ ಮಟ್ಟದಲ್ಲಿತ್ತು, ಅದಕ್ಕಿಂತ ಹೆಚ್ಚು ಎಂದೂ ಇಲ್ಲ.",
  },
  "Air was moderate on {n} of {d} days, never worse.": {
    hi: "{d} में से {n} दिन वायु मध्यम रही, इससे बुरी कभी नहीं।",
    kn: "{d} ದಿನಗಳಲ್ಲಿ {n} ದಿನ ವಾಯು ಮಧ್ಯಮ ಮಟ್ಟದಲ್ಲಿತ್ತು, ಅದಕ್ಕಿಂತ ಹೆಚ್ಚು ಎಂದೂ ಇಲ್ಲ.",
  },
  "Air was good or satisfactory on every one of {d} days.": {
    hi: "सभी {d} दिन वायु अच्छी या संतोषजनक रही।",
    kn: "ಎಲ್ಲಾ {d} ದಿನಗಳೂ ವಾಯು ಉತ್ತಮ ಅಥವಾ ತೃಪ್ತಿಕರ ಮಟ್ಟದಲ್ಲಿತ್ತು.",
  },
  "Each bar is a day: the worst AQI of the one station within 25 km.": {
    hi: "हर पट्टी एक दिन है: 25 km के भीतर के एकमात्र स्टेशन का सबसे खराब AQI।",
    kn: "ಪ್ರತಿ ಪಟ್ಟಿ ಒಂದು ದಿನ: 25 km ಒಳಗಿನ ಏಕೈಕ ನಿಲ್ದಾಣದ ಅತಿ ಕೆಟ್ಟ AQI.",
  },
  "Each bar is a day: the worst AQI of the middle station of {s} within 25 km.": {
    hi: "हर पट्टी एक दिन है: 25 km के भीतर के {s} स्टेशनों में बीच वाले स्टेशन का सबसे खराब AQI।",
    kn: "ಪ್ರತಿ ಪಟ್ಟಿ ಒಂದು ದಿನ: 25 km ಒಳಗಿನ {s} ನಿಲ್ದಾಣಗಳಲ್ಲಿ ಮಧ್ಯದ ನಿಲ್ದಾಣದ ಅತಿ ಕೆಟ್ಟ AQI.",
  },
  "Measured.": { hi: "मापा गया।", kn: "ಅಳೆದದ್ದು." },
  "No reading on 1 day.": { hi: "1 दिन कोई रीडिंग नहीं।", kn: "1 ದಿನ ಯಾವುದೇ ಮಾಪನ ಇಲ್ಲ." },
  "No reading on {m} days.": { hi: "{m} दिन कोई रीडिंग नहीं।", kn: "{m} ದಿನ ಯಾವುದೇ ಮಾಪನ ಇಲ್ಲ." },
  "This record has no air quality. It uses only the stations within {km} km, and none is that close.": {
    hi: "इस रिकॉर्ड में वायु गुणवत्ता नहीं है। यह केवल {km} km के भीतर के स्टेशन लेता है, और इतने पास कोई स्टेशन नहीं है।",
    kn: "ಈ ದಾಖಲೆಯಲ್ಲಿ ವಾಯು ಗುಣಮಟ್ಟ ಇಲ್ಲ. ಇದು {km} km ಒಳಗಿನ ನಿಲ್ದಾಣಗಳನ್ನು ಮಾತ್ರ ಬಳಸುತ್ತದೆ, ಅಷ್ಟು ಹತ್ತಿರ ಯಾವುದೇ ನಿಲ್ದಾಣವಿಲ್ಲ.",
  },
  "The other hazards": { hi: "अन्य खतरे", kn: "ಇತರ ಅಪಾಯಗಳು" },
  "raised on {n} of {d} days, up to {level}.": {
    hi: "{d} में से {n} दिन बढ़ा हुआ, अधिकतम {level}।",
    kn: "{d} ದಿನಗಳಲ್ಲಿ {n} ದಿನ ಏರಿಕೆ, ಗರಿಷ್ಠ {level}.",
  },
  "low on every day.": { hi: "हर दिन कम।", kn: "ಪ್ರತಿ ದಿನ ಕಡಿಮೆ." },
  // A place's trend page, /c/{slug}/trends (pages/trends.ts), and the hazards' chart notes (ui/history.ts).
  "Every hazard, day by day": { hi: "हर खतरा, दिन-ब-दिन", kn: "ಪ್ರತಿ ಅಪಾಯ, ದಿನದಿಂದ ದಿನಕ್ಕೆ" },
  "{n} fires": { hi: "{n} आग", kn: "{n} ಬೆಂಕಿ" },
  "{place} AQI and weather: last {n} days": {
    hi: "{place} AQI और मौसम: पिछले {n} दिन",
    kn: "{place} AQI ಮತ್ತು ಹವಾಮಾನ: ಕಳೆದ {n} ದಿನಗಳು",
  },
  "{place}, last {n} days:": { hi: "{place}, पिछले {n} दिन:", kn: "{place}, ಕಳೆದ {n} ದಿನಗಳು:" },
  Period: { hi: "अवधि", kn: "ಅವಧಿ" },
  "{n} days": { hi: "{n} दिन", kn: "{n} ದಿನಗಳು" },
  "{place} now": { hi: "{place} अभी", kn: "{place} ಈಗ" },
  Trends: { hi: "रुझान", kn: "ಪ್ರವೃತ್ತಿಗಳು" },
  "{place}, India: air, heat, cold, rain, wind, fog, smoke and UV, a day at a time over the last {n} days.": {
    hi: "{place}, भारत: वायु, गर्मी, ठंड, बारिश, हवा, कोहरा, धुआं और UV, पिछले {n} दिन, एक-एक दिन।",
    kn: "{place}, ಭಾರತ: ವಾಯು, ಬಿಸಿಲು, ಚಳಿ, ಮಳೆ, ಗಾಳಿ, ಮಂಜು, ಹೊಗೆ ಮತ್ತು UV, ಕಳೆದ {n} ದಿನಗಳು, ದಿನಕ್ಕೊಂದರಂತೆ.",
  },
  "No record for this place yet. It fills in each night.": {
    hi: "इस स्थान का अभी कोई रिकॉर्ड नहीं। यह हर रात भरता है।",
    kn: "ಈ ಸ್ಥಳದ ದಾಖಲೆ ಇನ್ನೂ ಇಲ್ಲ. ಇದು ಪ್ರತಿ ರಾತ್ರಿ ತುಂಬುತ್ತದೆ.",
  },
  "The {n} days in one line": { hi: "{n} दिन एक पंक्ति में", kn: "{n} ದಿನಗಳು ಒಂದೇ ಸಾಲಿನಲ್ಲಿ" },
  "Every hazard stayed low.": { hi: "हर खतरा कम रहा।", kn: "ಪ್ರತಿ ಅಪಾಯ ಕಡಿಮೆಯಾಗಿಯೇ ಇತ್ತು." },
  "Days at each level, by hazard": { hi: "हर स्तर पर दिन, खतरे के अनुसार", kn: "ಪ್ರತಿ ಮಟ್ಟದ ದಿನಗಳು, ಅಪಾಯವಾರು" },
  "Days at each level": { hi: "हर स्तर पर दिन", kn: "ಪ್ರತಿ ಮಟ್ಟದ ದಿನಗಳು" },
  "{from} to {to}. Every hazard mugilu reads, a day at a time, in the order of the risk it brought.": {
    hi: "{from} से {to}। mugilu जो भी खतरा पढ़ता है, एक-एक दिन, जोखिम के क्रम में।",
    kn: "{from} ರಿಂದ {to}. mugilu ಓದುವ ಪ್ರತಿ ಅಪಾಯ, ದಿನಕ್ಕೊಂದರಂತೆ, ಅದು ತಂದ ಅಪಾಯದ ಕ್ರಮದಲ್ಲಿ.",
  },
  "Official warnings will show here too: the days this place was under an NDMA or IMD warning. mugilu is filling that record now.":
    {
      hi: "आधिकारिक चेतावनियाँ भी यहाँ दिखेंगी: वे दिन जब यह स्थान NDMA या IMD की चेतावनी में था। mugilu अभी वह रिकॉर्ड भर रहा है।",
      kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳೂ ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ: ಈ ಸ್ಥಳ NDMA ಅಥವಾ IMD ಎಚ್ಚರಿಕೆಯಡಿ ಇದ್ದ ದಿನಗಳು. mugilu ಈಗ ಆ ದಾಖಲೆಯನ್ನು ತುಂಬುತ್ತಿದೆ.",
    },
  "Poor or worse on {h} of {d} days, very poor or severe on {s}.": {
    hi: "{d} में से {h} दिन खराब या उससे बुरी, {s} दिन बहुत खराब या गंभीर।",
    kn: "{d} ದಿನಗಳಲ್ಲಿ {h} ದಿನ ಕೆಟ್ಟ ಅಥವಾ ಅದಕ್ಕಿಂತ ಕೆಟ್ಟ, {s} ದಿನ ತುಂಬಾ ಕೆಟ್ಟ ಅಥವಾ ತೀವ್ರ.",
  },
  "High or severe on {h} of {d} days.": {
    hi: "{d} में से {h} दिन अधिक या गंभीर।",
    kn: "{d} ದಿನಗಳಲ್ಲಿ {h} ದಿನ ಹೆಚ್ಚು ಅಥವಾ ತೀವ್ರ.",
  },
  "Moderate on {n} of {d} days, never higher.": {
    hi: "{d} में से {n} दिन मध्यम, इससे ऊपर कभी नहीं।",
    kn: "{d} ದಿನಗಳಲ್ಲಿ {n} ದಿನ ಮಧ್ಯಮ, ಅದಕ್ಕಿಂತ ಹೆಚ್ಚು ಎಂದೂ ಇಲ್ಲ.",
  },
  "Low on every one of {d} days.": { hi: "सभी {d} दिन कम।", kn: "ಎಲ್ಲಾ {d} ದಿನಗಳೂ ಕಡಿಮೆ." },
  "Highest: {v} on {day}.": { hi: "सबसे अधिक: {day} को {v}।", kn: "ಗರಿಷ್ಠ: {day} ರಂದು {v}." },
  "Lowest: {v} on {day}.": { hi: "सबसे कम: {day} को {v}।", kn: "ಕನಿಷ್ಠ: {day} ರಂದು {v}." },
  "The day's worst AQI: the middle of the stations within 25 km, each by its worst reading": {
    hi: "दिन का सबसे खराब AQI: 25 km के भीतर के स्टेशनों में बीच वाला, हर एक अपनी सबसे खराब रीडिंग से",
    kn: "ದಿನದ ಅತಿ ಕೆಟ್ಟ AQI: 25 km ಒಳಗಿನ ನಿಲ್ದಾಣಗಳಲ್ಲಿ ಮಧ್ಯದ್ದು, ಪ್ರತಿಯೊಂದೂ ತನ್ನ ಅತಿ ಕೆಟ್ಟ ಮಾಪನದಂತೆ",
  },
  "The day's highest feels-like temperature": {
    hi: "दिन का सबसे अधिक महसूस होने वाला तापमान",
    kn: "ದಿನದ ಗರಿಷ್ಠ ಅನುಭವದ ತಾಪಮಾನ",
  },
  "The day's lowest feels-like temperature": { hi: "दिन का सबसे कम महसूस होने वाला तापमान", kn: "ದಿನದ ಕನಿಷ್ಠ ಅನುಭವದ ತಾಪಮಾನ" },
  "Rain over the day": { hi: "दिन भर की बारिश", kn: "ದಿನವಿಡೀ ಮಳೆ" },
  "The day's strongest gust": { hi: "दिन का सबसे तेज़ झोंका", kn: "ದಿನದ ಅತಿ ಬಲವಾದ ಗಾಳಿ ರಭಸ" },
  "The day's lowest visibility": { hi: "दिन की सबसे कम दृश्यता", kn: "ದಿನದ ಕನಿಷ್ಠ ಗೋಚರತೆ" },
  "Fires seen by satellite within 100 km": { hi: "100 km के भीतर उपग्रह से देखी गई आग", kn: "100 km ಒಳಗೆ ಉಪಗ್ರಹದಿಂದ ಕಂಡ ಬೆಂಕಿ" },
  "The day's highest UV index": { hi: "दिन का सबसे अधिक UV सूचकांक", kn: "ದಿನದ ಗರಿಷ್ಠ UV ಸೂಚ್ಯಂಕ" },
  Measured: { hi: "मापा गया", kn: "ಅಳೆದದ್ದು" },
  Modelled: { hi: "अनुमानित", kn: "ಅಂದಾಜು" },
  "Seen by satellite": { hi: "उपग्रह से देखा गया", kn: "ಉಪಗ್ರಹದಿಂದ ಕಂಡದ್ದು" },
  "no data": { hi: "कोई डेटा नहीं", kn: "ದತ್ತಾಂಶ ಇಲ್ಲ" },
  Day: { hi: "दिन", kn: "ದಿನ" },
  Level: { hi: "स्तर", kn: "ಮಟ್ಟ" },
  "day by day": { hi: "दिन-ब-दिन", kn: "ದಿನದಿಂದ ದಿನಕ್ಕೆ" },
  "Day by day": { hi: "दिन-ब-दिन", kn: "ದಿನದಿಂದ ದಿನಕ್ಕೆ" },
  "Its peak": { hi: "उसका चरम", kn: "ಅದರ ಗರಿಷ್ಠ" },
  "Low on every day": { hi: "हर दिन कम", kn: "ಪ್ರತಿ ದಿನ ಕಡಿಮೆ" },
  "A taller bar is a colder day: it grows as the feels-like low falls below 20°C.": {
    hi: "ऊँची पट्टी यानी ज़्यादा ठंडा दिन: महसूस होने वाला न्यूनतम तापमान 20°C से जितना नीचे, पट्टी उतनी ऊँची।",
    kn: "ಎತ್ತರದ ಪಟ್ಟಿ ಎಂದರೆ ಹೆಚ್ಚು ಚಳಿಯ ದಿನ: ಅನುಭವದ ಕನಿಷ್ಠ ತಾಪಮಾನ 20°C ಗಿಂತ ಎಷ್ಟು ಕೆಳಗೋ ಪಟ್ಟಿ ಅಷ್ಟು ಎತ್ತರ.",
  },
  "A taller bar is a thicker fog: it grows as the lowest visibility falls below 2,000 m.": {
    hi: "ऊँची पट्टी यानी घना कोहरा: न्यूनतम दृश्यता 2,000 m से जितनी नीचे, पट्टी उतनी ऊँची।",
    kn: "ಎತ್ತರದ ಪಟ್ಟಿ ಎಂದರೆ ದಟ್ಟ ಮಂಜು: ಕನಿಷ್ಠ ಗೋಚರತೆ 2,000 m ಗಿಂತ ಎಷ್ಟು ಕೆಳಗೋ ಪಟ್ಟಿ ಅಷ್ಟು ಎತ್ತರ.",
  },
  "These stayed low on every one of the {n} days.": {
    hi: "ये सभी {n} दिन कम रहे।",
    kn: "ಇವು ಎಲ್ಲಾ {n} ದಿನಗಳೂ ಕಡಿಮೆಯಾಗಿಯೇ ಇದ್ದವು.",
  },
  // The home page's "India, the last 30 days" (ui/history.ts).
  "India, the last 30 days": { hi: "भारत, पिछले 30 दिन", kn: "ಭಾರತ, ಕಳೆದ 30 ದಿನಗಳು" },
  "Poor or worse air in {n} of {c} cities on {day}.": {
    hi: "{day} को {c} में से {n} शहरों में वायु खराब या उससे बुरी रही।",
    kn: "{day} ರಂದು {c} ನಗರಗಳಲ್ಲಿ {n} ನಗರಗಳಲ್ಲಿ ವಾಯು ಕೆಟ್ಟ ಅಥವಾ ಅದಕ್ಕಿಂತ ಹೆಚ್ಚು ಕೆಟ್ಟದಾಗಿತ್ತು.",
  },
  "At the peak, {day}, it was {n}.": {
    hi: "सबसे अधिक {day} को: {n}।",
    kn: "ಗರಿಷ್ಠ {day} ರಂದು: {n}.",
  },
  "Cities with poor or worse air, each day for {n} days": {
    hi: "खराब या उससे बुरी वायु वाले शहर, {n} दिनों तक हर दिन",
    kn: "ಕೆಟ್ಟ ಅಥವಾ ಅದಕ್ಕಿಂತ ಕೆಟ್ಟ ವಾಯು ಇದ್ದ ನಗರಗಳು, {n} ದಿನಗಳ ಕಾಲ ಪ್ರತಿ ದಿನ",
  },
  "{day}: {n} cities poor or worse, {v} very poor or severe": {
    hi: "{day}: {n} शहर खराब या बुरे, {v} बहुत खराब या गंभीर",
    kn: "{day}: {n} ನಗರಗಳು ಕೆಟ್ಟ ಅಥವಾ ಹೆಚ್ಚು, {v} ತುಂಬಾ ಕೆಟ್ಟ ಅಥವಾ ತೀವ್ರ",
  },
  "Fires seen by satellite across India, each day for {n} days": {
    hi: "भारत भर में उपग्रह से देखी गई आग, {n} दिनों तक हर दिन",
    kn: "ಭಾರತದಾದ್ಯಂತ ಉಪಗ್ರಹದಿಂದ ಕಂಡ ಬೆಂಕಿ, {n} ದಿನಗಳ ಕಾಲ ಪ್ರತಿ ದಿನ",
  },
  "{day}: {n} fires": { hi: "{day}: {n} आग", kn: "{day}: {n} ಬೆಂಕಿ" },
  "Cities with poor or worse air": { hi: "खराब या उससे बुरी वायु वाले शहर", kn: "ಕೆಟ್ಟ ಅಥವಾ ಅದಕ್ಕಿಂತ ಕೆಟ್ಟ ವಾಯು ಇದ್ದ ನಗರಗಳು" },
  "Cities with an air station, each by its worst hour of the day.": {
    hi: "वायु स्टेशन वाले शहर, हर एक दिन के अपने सबसे खराब घंटे से।",
    kn: "ವಾಯು ನಿಲ್ದಾಣವಿರುವ ನಗರಗಳು, ಪ್ರತಿಯೊಂದೂ ದಿನದ ತನ್ನ ಅತಿ ಕೆಟ್ಟ ಗಂಟೆಯಂತೆ.",
  },
  "Very poor or severe": { hi: "बहुत खराब या गंभीर", kn: "ತುಂಬಾ ಕೆಟ್ಟ ಅಥವಾ ತೀವ್ರ" },
  "Fires seen by satellite": { hi: "उपग्रह से देखी गई आग", kn: "ಉಪಗ್ರಹದಿಂದ ಕಂಡ ಬೆಂಕಿ" },
  "Crop and forest burning across India, from NASA FIRMS.": {
    hi: "भारत भर में फसल और जंगल की आग, NASA FIRMS से।",
    kn: "ಭಾರತದಾದ್ಯಂತ ಬೆಳೆ ಮತ್ತು ಅರಣ್ಯ ಸುಡುವಿಕೆ, NASA FIRMS ನಿಂದ.",
  },
  "No fire record on 1 day.": { hi: "1 दिन आग का कोई रिकॉर्ड नहीं।", kn: "1 ದಿನ ಬೆಂಕಿಯ ದಾಖಲೆ ಇಲ್ಲ." },
  "No fire record on {m} days.": { hi: "{m} दिन आग का कोई रिकॉर्ड नहीं।", kn: "{m} ದಿನ ಬೆಂಕಿಯ ದಾಖಲೆ ಇಲ್ಲ." },
  "Pick a place on the map or in the list to see its own 30 days.": {
    hi: "किसी स्थान के अपने 30 दिन देखने के लिए उसे नक्शे या सूची में चुनें।",
    kn: "ಒಂದು ಸ್ಥಳದ ತನ್ನದೇ 30 ದಿನಗಳನ್ನು ನೋಡಲು ಅದನ್ನು ನಕ್ಷೆಯಲ್ಲಿ ಅಥವಾ ಪಟ್ಟಿಯಲ್ಲಿ ಆರಿಸಿ.",
  },
  "Weather modelled by Open-Meteo; fires seen by satellite (NASA FIRMS), within 100 km.": {
    hi: "मौसम Open-Meteo का अनुमान; आग उपग्रह से देखी गई (NASA FIRMS), 100 km के भीतर।",
    kn: "ಹವಾಮಾನ Open-Meteo ಅಂದಾಜು; ಬೆಂಕಿ ಉಪಗ್ರಹದಿಂದ ಕಂಡದ್ದು (NASA FIRMS), 100 km ಒಳಗೆ.",
  },
};
/** "A, B and C" in the page's language. */
export const andList = (parts: string[], lang: Lang) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${t("and", lang)} ${parts[parts.length - 1]}`;

/** The locale of each language, for dates and numbers. */
export const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

export function t(en: string, lang: Lang): string {
  if (lang === "en") return en;
  const e = TR[en];
  return (e && e[lang]) || en;
}
