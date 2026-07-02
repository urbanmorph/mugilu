// Language scaffolding for mugilu (en + hi + kn; more via [[localisation-method-sarvam]]).
//
// The KEY is the English source string: t("Popular:", lang). An unwired or
// untranslated string falls back to English automatically, so pages can be
// localised incrementally. hi drafts come from Sarvam + native review; kn from
// a native review pass. To add a language L: extend Lang/LANGS/LANG_NAME/LANG_FONT
// and fill TR[...][L]. Brand terms (mugilu, SACHET, NDMA, IMD, QR) stay in Latin.

export type Lang = "en" | "hi" | "kn";
export const LANGS: readonly Lang[] = ["en", "hi", "kn"] as const;
export const LANG_NAME: Record<Lang, string> = {
  en: "English",
  hi: "\u0939\u093f\u0902\u0926\u0940",
  kn: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1",
};

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

// Per-language display + body font stacks. System-Indic-first (no web-font
// download): Noto Serif/Sans are present on modern Android, iOS, Windows, macOS.
export const LANG_FONT: Record<Lang, { serif: string; sans: string } | null> = {
  en: null,
  hi: {
    serif: "'Noto Serif Devanagari','Tiro Devanagari Hindi',Georgia,serif",
    sans: "'Noto Sans Devanagari',ui-sans-serif,system-ui,sans-serif",
  },
  kn: {
    serif: "'Noto Serif Kannada','Tiro Kannada',Georgia,serif",
    sans: "'Noto Sans Kannada',ui-sans-serif,system-ui,sans-serif",
  },
};

// Indic scripts stack matras above and below the baseline, so the tight Latin
// display line-heights (.95-1.05) clip them. Swap the font vars and relax the
// display line-heights + give body copy a little more leading. Appended AFTER
// the page CSS in shell(), so it wins on cascade order without !important.
export function langCss(lang: Lang): string {
  const f = LANG_FONT[lang];
  if (!f) return "";
  return (
    ":root{--serif:" +
    f.serif +
    ";--sans:" +
    f.sans +
    "}" +
    "body{line-height:1.6}" +
    ".hero,.tagline,.loc,.amb-head,.amb-say,.ahero,.alead,.eamb,.kname,.khead,.wcat,.covers{line-height:1.25}"
  );
}

// en -> { hi, kn }. Generated from the native-reviewed sheets; edit there and regenerate.
const TR: Record<string, Partial<Record<Exclude<Lang, "en">, string>>> = {
  // /methodology prose (kn): hand-composed from the reviewed KANNADA_GLOSSARY + existing
  // UI strings (no Sarvam pass), proper nouns/acronyms kept Latin. Pending native
  // sign-off (supporting-docs/METHODOLOGY_KANNADA_REVIEW.md). Open calls flagged there:
  // "Ambient" feature name, "wet-bulb"=ತೇವ-ಬಲ್ಬ್, "read"=ಓದುವಿಕೆ. {score}/{terms} are link slots.
  "How the Ambient read works": {
    "kn": "Ambient ಓದುವಿಕೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ"
  },
  "mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. It's a glass box: the thresholds below are public and come from CPCB, IMD, WHO, NASA, the Australian BoM and the AQLI. Informational only, never medical or safety advice.": {
    "kn": "ಆಕಾಶವು ಈಗ ನಿಮಗೆ ಮಾಡುತ್ತಿರುವ ಅತ್ಯಂತ ಕೆಟ್ಟ ಒಂದೇ ವಿಷಯವನ್ನು mugilu ಹೆಸರಿಸುತ್ತದೆ, ನೀವು ಯಾರು ಎಂಬುದರ ಆಧಾರದ ಮೇಲೆ. ಇದು ಒಂದು ಪಾರದರ್ಶಕ ವ್ಯವಸ್ಥೆ: ಕೆಳಗಿನ ಮಿತಿಗಳು ಸಾರ್ವಜನಿಕವಾಗಿವೆ ಮತ್ತು CPCB, IMD, WHO, NASA, Australian BoM ಮತ್ತು AQLIಯಿಂದ ಬಂದಿವೆ. ಕೇವಲ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ಎಂದಿಗೂ ವೈದ್ಯಕೀಯ ಅಥವಾ ಸುರಕ್ಷತಾ ಸಲಹೆಯಲ್ಲ."
  },
  "One read, never an average": {
    "kn": "ಒಂದೇ ಓದುವಿಕೆ, ಎಂದಿಗೂ ಸರಾಸರಿ ಅಲ್ಲ"
  },
  "Each hazard is scored 0 to 3 (none, caution, high, severe). We surface the worst one, named in plain words (\"Severe smoke\", \"High heat\"), with one sentence on what to do. Averaging would hide the thing that matters, so we never average.": {
    "kn": "ಪ್ರತಿಯೊಂದು ಅಪಾಯಕ್ಕೂ 0 ರಿಂದ 3 ರವರೆಗೆ ಅಂಕ ನೀಡಲಾಗುತ್ತದೆ (ಅಪಾಯವಿಲ್ಲ · ಎಚ್ಚರಿಕೆ · ಹೆಚ್ಚು · ತೀವ್ರ). ನಾವು ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದನ್ನು ಸರಳ ಪದಗಳಲ್ಲಿ ಹೆಸರಿಸಿ ತೋರಿಸುತ್ತೇವೆ (\"ತೀವ್ರ ಹೊಗೆ\", \"ಹೆಚ್ಚು ಬಿಸಿಲು\"), ಏನು ಮಾಡಬೇಕು ಎಂಬುದರ ಬಗ್ಗೆ ಒಂದೇ ವಾಕ್ಯದೊಂದಿಗೆ. ಸರಾಸರಿ ಮಾಡಿದರೆ ಮುಖ್ಯವಾದ ವಿಷಯ ಮರೆಯಾಗುತ್ತದೆ, ಆದ್ದರಿಂದ ನಾವು ಎಂದಿಗೂ ಸರಾಸರಿ ಮಾಡುವುದಿಲ್ಲ."
  },
  "For who you are": {
    "kn": "ನೀವು ಯಾರೆಂಬುದಕ್ಕೆ ತಕ್ಕಂತೆ"
  },
  "Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as \"high\"). When your trigger isn't the headline but is still elevated, a second line surfaces it (\"also watch: air is high\"). The persona is a toggle you choose: never inferred, never stored.": {
    "kn": "ಒಂದು ದುರ್ಬಲತೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ (ಆಸ್ತಮಾ, ವೃದ್ಧರು, ಮಕ್ಕಳು, ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು, ಹೃದಯ) ಮತ್ತು ಆ ಗುಂಪು ಹೆಚ್ಚು ತೀವ್ರವಾಗಿ ಅನುಭವಿಸುವ ಅಪಾಯಗಳನ್ನು ಒಂದು ಹಂತ ಮೇಲಕ್ಕೆ ಏರಿಸಲಾಗುತ್ತದೆ (ಆದ್ದರಿಂದ ಆಸ್ತಮಾ ಇರುವವರು ಮಧ್ಯಮ ಗಾಳಿಯನ್ನು \"ಹೆಚ್ಚು\" ಎಂದು ನೋಡುತ್ತಾರೆ). ನಿಮ್ಮ ಸಮಸ್ಯೆ ಮುಖ್ಯಾಂಶವಲ್ಲದಿದ್ದರೂ ಇನ್ನೂ ಹೆಚ್ಚಿದ್ದರೆ, ಎರಡನೇ ಸಾಲು ಅದನ್ನು ತೋರಿಸುತ್ತದೆ (\"ಗಮನಿಸಿ: ಗಾಳಿ ಹೆಚ್ಚಿದೆ\"). ಈ ಆಯ್ಕೆ ನೀವೇ ಮಾಡುವ ಒಂದು ಟಾಗಲ್: ಎಂದಿಗೂ ಊಹಿಸುವುದಿಲ್ಲ, ಎಂದಿಗೂ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ."
  },
  "The thresholds": {
    "kn": "ಮಿತಿಗಳು"
  },
  "Hazard": {
    "kn": "ಅಪಾಯ"
  },
  "Caution": {
    "kn": "ಎಚ್ಚರಿಕೆ"
  },
  "Air (AQI)": {
    "kn": "ವಾಯುಗುಣ (AQI)"
  },
  "Heat (feels-like)": {
    "kn": "ಬಿಸಿಲು (ಅನಿಸುವ)"
  },
  "Heat (wet-bulb)": {
    "kn": "ಬಿಸಿಲು (ತೇವ-ಬಲ್ಬ್)"
  },
  "Heat (WBGT)": {
    "kn": "ಬಿಸಿಲು (WBGT)"
  },
  "Cold (feels-like)": {
    "kn": "ಶೀತ (ಅನಿಸುವ)"
  },
  "Wind (gusts, km/h)": {
    "kn": "ಗಾಳಿ (ರಭಸ, km/h)"
  },
  "Fog (visibility, m)": {
    "kn": "ಮಂಜು (ಗೋಚರತೆ, m)"
  },
  "Smoke (fires &lt;100 km)": {
    "kn": "ಹೊಗೆ (100 km ಒಳಗಿನ ಬೆಂಕಿ)"
  },
  "UV (index)": {
    "kn": "UV (ಸೂಚ್ಯಂಕ)"
  },
  "Dust (µg/m³)": {
    "kn": "ಧೂಳు (µg/m³)"
  },
  "Heat takes the worst of feels-like, wet-bulb and WBGT. The persona toggle then bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind), WHO (UV) and NASA FIRMS (smoke); the full logic is the open {score}, and every layer's source and licence is on {terms}.": {
    "kn": "ಬಿಸಿಲು ಎಂಬುದು ಅನಿಸುವ ತಾಪಮಾನ, ತೇವ-ಬಲ್ಬ್ ಮತ್ತು WBGT ಇವುಗಳಲ್ಲಿ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ. ನಂತರ ಪರ್ಸೋನಾ ಟಾಗಲ್ ಒಂದು ಸೂಕ್ಷ್ಮ ಅಪಾಯವನ್ನು ಒಂದು ಹಂತ ಮೇಲಕ್ಕೆ ಏರಿಸುತ್ತದೆ. ಈ ಮಟ್ಟಗಳು CPCB (ಗಾಳಿ), IMD ಮತ್ತು Australian BoM (ಬಿಸಿಲು / ಶೀತ / ಗಾಳಿ), WHO (UV) ಮತ್ತು NASA FIRMS (ಹೊಗೆ) ಇವುಗಳಿಂದ ಬರುತ್ತವೆ; ಸಂಪೂರ್ಣ ತರ್ಕವು ಮುಕ್ತ {score} ಆಗಿದೆ, ಮತ್ತು ಪ್ರತಿ ಪದರದ ಮೂಲ ಮತ್ತು ಪರವಾನಗಿ {terms} ಪುಟದಲ್ಲಿದೆ."
  },
  "terms & attribution": {
    "kn": "ಷರತ್ತುಗಳು ಮತ್ತು ಮನ್ನಣೆ"
  },
  "Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.": {
    "kn": "ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, NDMA ಮತ್ತು IMDಯನ್ನು ಸಂಪರ್ಕಿಸಿ."
  },
  "A place in India, or lat,lon": {
    "hi": "भारत में एक स्थान, या अक्षांश, देशांतर",
    "kn": "ಭಾರತದಲ್ಲಿ ಒಂದು ಸ್ಥಳ, ಅಥವಾ ಅಕ್ಷಾಂಶ, ರೇಖಾಂಶ"
  },
  "A serious warning is active. Follow official guidance.": {
    "hi": "एक गंभीर चेतावनी सक्रिय है। आधिकारिक मार्गदर्शन का पालन करें।",
    "kn": "ಗಂಭೀರ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯವಾಗಿದೆ. ಅಧಿಕೃತ ಮಾರ್ಗದರ್ಶನವನ್ನು ಅನುಸರಿಸಿ."
  },
  "A whole-sky view for people, and shared infrastructure for anyone building on top of it.": {
    "kn": "ಜನರಿಗೆ ಸಂಪೂರ್ಣ ಆಕಾಶದ ನೋಟ, ಮತ್ತು ಅದರ ಮೇಲೆ ನಿರ್ಮಿಸುವ ಯಾರಿಗಾದರೂ ಹಂಚಿಕೆಯ ಮೂಲಸೌಕರ್ಯ."
  },
  "Active warnings": {
    "hi": "सक्रिय चेतावनियाँ",
    "kn": "ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು"
  },
  "Add ?ref=your-app to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.": {
    "kn": "ನಿಮ್ಮ ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ಗುರುತಿಸಲು ಯಾವುದೇ API ಅಥವಾ ಎಂಬೆಡ್ URLಗೆ ref=your-app ಪ್ಯಾರಾಮೀಟರ್ ಅನ್ನು ಸೇರಿಸಿ (ಸರಾಸರಿ, ಡೊಮೇನ್-ಮಟ್ಟ). ಇದು ಎಲ್ಲಾ ಉಚಿತವಾಗಿದೆ ಮತ್ತು ಯಾವುದೇ ಕೀಲಿಯ ಅಗತ್ಯವಿಲ್ಲ."
  },
  "Air": {
    "hi": "वायु",
    "kn": "ವಾಯುಗುಣ"
  },
  "Air from CPCB, Airnet (CSTEP) and Aurassure via the Open Air Quality broker and OpenAQ; weather, heat, UV and dust from Open-Meteo; official warnings from NDMA and IMD via SACHET; geography from bharatlas. Each source keeps its own licence, and mugilu credits all of them.": {
    "kn": "CPCB, Airnet (CSTEP) ಮತ್ತು Aurassure‌ನಿಂದ ವಾಯು ಗುಣಮಟ್ಟದ ಮಾಹಿತಿ; Open Air Quality broker ಮತ್ತು OpenAQ ಮೂಲಕ ಹವಾಮಾನ, ಬಿಸಿಲು, UV ಮತ್ತು ಧೂಳಿನ ಮಾಹಿತಿ; NDMA ಮತ್ತು IMDಯಿಂದ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು; bharatlas‌ನಿಂದ ಭೌಗೋಳಿಕ ಮಾಹಿತಿ. ಪ್ರತಿಯೊಂದು ಮೂಲವೂ ತನ್ನದೇ ಆದ ಪರವಾನಗಿಯನ್ನು ಹೊಂದಿರುತ್ತದೆ ಮತ್ತು mugilu ಅವರೆಲ್ಲರಿಗೂ ಮನ್ನಣೆ ನೀಡುತ್ತದೆ."
  },
  "Air is dangerous. Stay indoors if you can.": {
    "hi": "वायु गुणवत्ता खतरनाक है। यदि आप कर सकते हैं तो घर के अंदर रहें।",
    "kn": "ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಅಪಾಯಕಾರಿಯಾಗಿದೆ. ಸಾಧ್ಯವಾದರೆ ಮನೆಯೊಳಗೆ ಇರಿ."
  },
  "Air is poor. Sensitive groups, take it easy.": {
    "hi": "वायु गुणवत्ता खराब है। संवेदनशील समूहों के लोगों को शारीरिक गतिविधि कम करनी चाहिए।",
    "kn": "ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಕೆಟ್ಟದಾಗಿದೆ. ಸೂಕ್ಷ್ಮ ಗುಂಪುಗಳಲ್ಲಿರುವ ಜನರು ದೈಹಿಕ ಚಟುವಟಿಕೆಯನ್ನು ಕಡಿಮೆ ಮಾಡಿಕೊಳ್ಳಬೇಕು."
  },
  "Air is so-so, fine for most people.": {
    "hi": "हवा मध्यम है, अधिकांश लोगों के लिए ठीक है।",
    "kn": "ವಾಯು ಗುಣಮಟ್ಟ ಸ್ವಲ್ಪ ಮಟ್ಟಿಗೆ ಉತ್ತಮವಾಗಿದೆ, ಹೆಚ್ಚಿನ ಜನರಿಗೆ ಸರಿ."
  },
  "Air refreshes hourly, the national heat, rain, UV and dust grid every few hours, and official warnings hourly. Every reading is timestamped with how long ago it was measured.": {
    "kn": "ವಾಯು-ಗುಣಮಟ್ಟದ ದತ್ತಾಂಶ ಪ್ರತಿ ಗಂಟೆಗೆ ನವೀಕರಿಸಲಾಗುತ್ತದೆ, ರಾಷ್ಟ್ರೀಯ ಬಿಸಿಲು, ಮಳೆ, UV ಮತ್ತು ಧೂಳಿನ ಗ್ರಿಡ್ ಪ್ರತಿ ಕೆಲವು ಗಂಟೆಗಳಿಗೊಮ್ಮೆ ಮತ್ತು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು ಪ್ರತಿ ಗಂಟೆಗೆ. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯ ತುಣುಕಿಗೂ ಅದನ್ನು ಅಳೆಯಲಾದ ಸಮಯದೊಂದಿಗೆ ಸಮಯಮುದ್ರೆ ಮಾಡಲಾಗಿರುತ್ತದೆ."
  },
  "All clear": {
    "hi": "सब कुछ ठीक है",
    "kn": "ಎಲ್ಲವೂ ಸರಿ"
  },
  "An official advisory is in effect.": {
    "hi": "एक आधिकारिक परामर्श लागू है।",
    "kn": "ಅಧಿಕೃತ ಸಲಹೆ ಜಾರಿಯಲ್ಲಿದೆ."
  },
  "An official warning is active. Stay alert.": {
    "hi": "एक आधिकारिक चेतावनी सक्रिय है। सतर्क रहें।",
    "kn": "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯವಾಗಿದೆ. ಎಚ್ಚರವಾಗಿರಿ."
  },
  "Any place in India": {
    "hi": "भारत में कहीं भी",
    "kn": "ಭಾರತದಲ್ಲಿ ಎಲ್ಲಿಯಾದರೂ"
  },
  "Asthma & lungs": {
    "hi": "अस्थमा और फेफड़े",
    "kn": "ಆಸ್ತಮಾ ಮತ್ತು ಶ್ವಾಸಕೋಶ"
  },
  "Asthma and lungs": {
    "hi": "अस्थमा और फेफड़े",
    "kn": "ಆಸ್ತಮಾ ಮತ್ತು ಶ್ವಾಸಕೋಶ"
  },
  "Build on it": {
    "kn": "ಅದರ ಮೇಲೆ ನಿರ್ಮಿಸಿ"
  },
  "Built by urbanmorph, led by Sathya Sankaran.": {
    "kn": "ಇದನ್ನು ನಿರ್ಮಿಸಿದ್ದು urbanmorph, Sathya Sankaran ನೇತೃತ್ವದಲ್ಲಿ."
  },
  "Children": {
    "hi": "बच्चे",
    "kn": "ಮಕ್ಕಳು"
  },
  "Cold conditions. Cover up and limit time outside.": {
    "hi": "ठंडी परिस्थितियाँ। बाहर समय सीमित करें और ढक कर रखें।",
    "kn": "ಶೀತಲ ಪರಿಸ್ಥಿತಿಗಳು. ಹೊರಾಂಗಣದಲ್ಲಿ ಕಳೆಯುವ ಸಮಯವನ್ನು ಮಿತಿಗೊಳಿಸಿ ಮತ್ತು ಮುಚ್ಚಿಕೊಳ್ಳಿ."
  },
  "Common questions": {
    "kn": "ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳು"
  },
  "Conditions are good right now.": {
    "hi": "अभी परिस्थितियाँ अच्छी हैं।",
    "kn": "ಈಗ ಪರಿಸ್ಥಿತಿಗಳು ಉತ್ತಮವಾಗಿವೆ."
  },
  "Couldn't find \"X\". Try a city or place name.": {
    "hi": "वह स्थान नहीं मिला। किसी शहर या स्थान का नाम आज़माएं।",
    "kn": "ಆ ಸ್ಥಳವನ್ನು ಕಂಡುಹಿಡಿಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಒಂದು ನಗರ ಅಥವಾ ಸ್ಥಳದ ಹೆಸರನ್ನು ಪ್ರಯತ್ನಿಸಿ."
  },
  "Damaging winds. Stay indoors, away from trees and hoardings.": {
    "hi": "हानिकारक हवाएँ। घर के अंदर रहें, पेड़ों और होर्डिंगों से दूर रहें।",
    "kn": "ಹಾನಿಕಾರಕ ಗಾಳಿ. ಮನೆಯೊಳಗೆ ಇರಿ, ಮರಗಳು ಮತ್ತು ಜಾಹೀರಾತು ಫಲಕಗಳಿಂದ ದೂರವಿರಿ."
  },
  "Dangerous cold. Stay warm indoors if you can.": {
    "hi": "खतरनाक ठंड। यदि आप कर सकते हैं तो घर के अंदर रहें।",
    "kn": "ಅಪಾಯಕಾರಿ ಶೀತ. ಸಾಧ್ಯವಾದರೆ ಒಳಾಂಗಣದಲ್ಲಿ ಬೆಚ್ಚಗಿರಿ."
  },
  "Dangerous heat. Avoid being outdoors.": {
    "hi": "खतरनाक गर्मी। बाहर जाने से बचें।",
    "kn": "ಅಪಾಯಕಾರಿ ಬಿಸಿಲು. ಹೊರಾಂಗಣದಲ್ಲಿ ಇರಬೇಡಿ."
  },
  "Dense fog. Slow down, use low beams, allow extra time.": {
    "hi": "घना कोहरा। धीमा हो जाइए, कम बीम का प्रयोग कीजिए, अतिरिक्त समय दीजिए।",
    "kn": "ದಟ್ಟವಾದ ಮಂಜು. ನಿಧಾನವಾಗಿ ಚಾಲನೆ ಮಾಡಿ, ಕಡಿಮೆ ಕಿರಣಗಳನ್ನು ಬಳಸಿ, ಹೆಚ್ಚುವರಿ ಸಮಯ ನೀಡಿ."
  },
  "Display": {
    "hi": "प्रदर्शन",
    "kn": "ಪ್ರದರ್ಶನ"
  },
  "Dust": {
    "hi": "धूल",
    "kn": "ಧೂಳು"
  },
  "Dustiest": {
    "hi": "सबसे धूल भरा स्थान",
    "kn": "ಅತ್ಯಂತ ಧೂಳುಭರಿತ"
  },
  "Dusty. Mask up if you're sensitive.": {
    "hi": "हवा धूल भरी है। यदि आप संवेदनशील हैं तो मास्क धारण करें।",
    "kn": "ಗಾಳಿಯಲ್ಲಿ ಧೂಳು ತುಂಬಿದೆ. ನಿಮಗೆ ಅಲರ್ಜಿ ಇದ್ದರೆ ಮಾಸ್ಕ್ ಧರಿಸಿ."
  },
  "Embed it": {
    "kn": "ಅದನ್ನು ಅಳವಡಿಸಿ"
  },
  "Everyone": {
    "hi": "सभी",
    "kn": "ಎಲ್ಲರೂ"
  },
  "Extreme sun. Cover up and skip the midday hours.": {
    "hi": "सूर्य बहुत तेज है। अपनी त्वचा को कपड़ों से ढकें और दोपहर के समय बाहर जाने से बचें।",
    "kn": "ಸೂರ್ಯನು ಅತ್ಯಂತ ಪ್ರಬಲನಾಗಿರುತ್ತಾನೆ. ನಿಮ್ಮ ಚರ್ಮವನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ ಮತ್ತು ಮಧ್ಯಾಹ್ನ ಹೊರಗೆ ಹೋಗುವುದನ್ನು ತಪ್ಪಿಸಿ."
  },
  "Fine": {
    "hi": "संतोषजनक",
    "kn": "ತೃಪ್ತಿಕರ"
  },
  "Fires burning nearby. Sensitive groups, watch the air.": {
    "hi": "पास में आग लगी हुई है। संवेदनशील लोगों को वायु गुणवत्ता देखनी चाहिए।",
    "kn": "ಹತ್ತಿರದಲ್ಲಿ ಬೆಂಕಿ ಹೊತ್ತಿಕೊಂಡಿದೆ. ಸೂಕ್ಷ್ಮ ವ್ಯಕ್ತಿಗಳು ವಾಯು ಗುಣಮಟ್ಟವನ್ನು ಗಮನಿಸಬೇಕು."
  },
  "For AI agents": {
    "kn": "AI ಏಜೆಂಟ್‌ಗಳಿಗೆ"
  },
  "For an always-on unattended screen, point a kiosk-browser app at the same link so it auto-starts.": {
    "hi": "हमेशा चालू रहने वाली, बिना निगरानी वाली स्क्रीन के लिए, किसी कियोस्क-ब्राउज़र ऐप (उदाहरण के लिए Android पर Fully Kiosk) को उसी लिंक पर सेट करें ताकि यह अपने आप शुरू हो जाए।",
    "kn": "ಸದಾ-ಆನ್, ಮೇಲ್ವಿಚಾರಣೆಯಿಲ್ಲದ ಸ್ಕ್ರೀನ್‌ಗೆ, ಅದೇ ಕೊಂಡಿಗೆ ಕಿಒಸ್ಕ್-ಬ್ರೌಸರ್ ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ಹೊಂದಿಸಿ, ಆದ್ದರಿಂದ ಅದು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ."
  },
  "For developers": {
    "kn": "ಡೆವಲಪರ್‌ಗಳಿಗೆ"
  },
  "For people": {
    "kn": "ಜನರಿಗಾಗಿ"
  },
  "For years, people across India have made the sky legible one piece at a time: a map of one city's air, a thread about a heatwave, a chart of last year's monsoon. Brilliant work, but scattered, and easy to lose by the next season.": {
    "kn": "ಹಲವು ವರ್ಷಗಳಿಂದ, ಭಾರತದಾದ್ಯಂತ ಜನರು ಆಕಾಶವನ್ನು ಒಂದು ಸಮಯದಲ್ಲಿ ಒಂದು ತುಣುಕಾಗಿ ಓದಬಲ್ಲಂತೆ ಮಾಡುತ್ತಿದ್ದಾರೆ: ಒಂದು ನಗರದ ಗಾಳಿಯ ನಕ್ಷೆ, ಬಿಸಿಲಿನ ಅಲೆಗಳ ಬಗ್ಗೆ ಒಂದು ಲೇಖನ, ಕಳೆದ ವರ್ಷದ ಮಳೆಯ ನಕ್ಷೆ. ಅತ್ಯುತ್ತಮ ಕೆಲಸ, ಆದರೆ ಮುಂದಿನ ಋತುವಿನಲ್ಲಿ ಹರಡಿ ಹೋಗಿ, ಸುಲಭವಾಗಿ ಕಳೆದುಹೋಗುತ್ತದೆ."
  },
  "Go": {
    "hi": "जाएं",
    "kn": "ಹೋಗಿ"
  },
  "Good": {
    "hi": "अच्छा",
    "kn": "ಉತ್ತಮ"
  },
  "Heart condition": {
    "hi": "हृदय रोग",
    "kn": "ಹೃದಯರೋಗ"
  },
  "Heat": {
    "hi": "गर्मी",
    "kn": "ಬಿಸಿಲು"
  },
  "Heat is high. Slow down, hydrate, find shade.": {
    "hi": "गर्मी अधिक है। धीमे हो जाइए, पानी पिएँ, छाया ढूँढ़ लीजिए।",
    "kn": "ಬಿಸಿಲು ಹೆಚ್ಚಾಗಿದೆ. ನಿಧಾನವಾಗಿ ಹೋಗಿ, ನೀರು ಕುಡಿಯಿರಿ, ನೆರಳು ಹುಡುಕಿ."
  },
  "Heavy burning nearby. Keep windows shut, limit time outdoors.": {
    "hi": "पास में भारी आग लगी हुई है। खिड़कियाँ बंद रखें और बाहर कम समय बिताएँ।",
    "kn": "ಹತ್ತಿರದಲ್ಲಿ ಭಾರೀ ಬೆಂಕಿ ಹೊತ್ತಿಕೊಂಡಿದೆ. ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ."
  },
  "Heavy dust. Limit time outdoors.": {
    "hi": "हवा में बहुत धूल है। बाहर कम समय बिताएँ।",
    "kn": "ಗಾಳಿಯಲ್ಲಿ ಧೂಳು ತುಂಬಿದೆ. ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ."
  },
  "High": {
    "hi": "उच्च",
    "kn": "ಉನ್ನತ ಮಟ್ಟದ"
  },
  "Hottest": {
    "hi": "सबसे गर्म स्थान",
    "kn": "ಅತ್ಯಂತ ಬಿಸಿಲು"
  },
  "How current are the readings?": {
    "kn": "ಮಾಹಿತಿ ಎಷ್ಟು ಇತ್ತೀಚಿನದು?"
  },
  "How it runs": {
    "hi": "इसका संचालन कैसे होता है",
    "kn": "ಅದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ"
  },
  "Informational and educational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings, consult NDMA and IMD directly.": {
    "hi": "जानकारी और शिक्षा के लिए, न कि चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए। आधिकारिक खतरे की चेतावनियों के लिए, NDMA और IMD से सीधे परामर्श करें।",
    "kn": "ಮಾಹಿತಿ ಮತ್ತು ಶಿಕ್ಷಣಕ್ಕಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಅಧಿಕೃತ ಅಪಾಯದ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, ಎನ್.ಡಿ.ಎಂ.ಎ ಮತ್ತು ಐ.ಎಂ.ಡಿ.ಯನ್ನು ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ."
  },
  "Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD.": {
    "hi": "जानकारी के लिए, न कि चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए। आधिकारिक खतरे की चेतावनियों के लिए, NDMA और IMD से परामर्श करें।",
    "kn": "ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಅಧಿಕೃತ ಅಪಾಯದ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, ಎನ್.ಡಿ.ಎಂ.ಎ ಮತ್ತು ಐ.ಎಂ.ಡಿ.ಯನ್ನು ಸಂಪರ್ಕಿಸಿ."
  },
  "Intense fires nearby. Treat the air as hazardous; stay indoors.": {
    "hi": "पास में तीव्र आग। हवा को खतरनाक समझें और घर के अंदर रहें।",
    "kn": "ಹತ್ತಿರದಲ್ಲಿ ತೀವ್ರವಾದ ಬೆಂಕಿ ಕಾಣಿಸಿಕೊಂಡಿದೆ. ಗಾಳಿಯನ್ನು ಅಪಾಯಕಾರಿ ಎಂದು ಪರಿಗಣಿಸಿ, ಒಳಾಂಗಣದಲ್ಲಿರಿ."
  },
  "Is it safe to go outside right now?": {
    "kn": "ಹೊರಗೆ ಹೋಗುವುದು ಈಗ ಸುರಕ್ಷಿತವೇ?"
  },
  "Is mugilu free?": {
    "kn": "mugilu ಉಚಿತವೇ?"
  },
  "It's cold out. Layer up.": {
    "hi": "बाहर ठण्ड है। गर्म कपड़ों की परतें पहनें।",
    "kn": "ಹೊರಗೆ ಚಳಿ ಇದೆ. ಬೆಚ್ಚಗಿನ ಬಟ್ಟೆಗಳ ಪದರಗಳನ್ನು ಧರಿಸಿ."
  },
  "It's warm, so keep water handy.": {
    "hi": "गर्मी है, इसलिए पानी अपने पास रखें।",
    "kn": "ಇದು ಬೆಚ್ಚಗಿರುತ್ತದೆ, ಆದ್ದರಿಂದ ನೀರನ್ನು ಸುಲಭವಾಗಿ ಸಿಗುವಂತೆ ಇಟ್ಟುಕೊಳ್ಳಿ."
  },
  "It's windy. Secure loose items.": {
    "hi": "हवा चल रही है। ढीले सामान को नीचे बांध दें ताकि वे उड़ न जाएं।",
    "kn": "ಗಾಳಿ ಜೋರಾಗಿದೆ. ಸಡಿಲವಾದ ವಸ್ತುಗಳನ್ನು ಕಟ್ಟಿಕೊಳ್ಳಿ, ಆಗ ಅವು ಬೀಸಿ ಹೋಗುವುದಿಲ್ಲ."
  },
  "Leave it. It refreshes on its own, keeps the screen awake, and if the network blips it holds the last reading and recovers.": {
    "hi": "छोड़ दीजिए। यह अपने आप रिफ्रेश होता है, स्क्रीन को चालू रखता है, और यदि नेटवर्क कुछ देर के लिए बंद हो जाए तो आखिरी रीडिंग दिखाता रहता है और फिर से जुड़ जाता है।",
    "kn": "ಅದನ್ನು ಬಿಡಿ. ಇದು ತನ್ನಷ್ಟಕ್ಕೆ ತಾನೇ ರಿಫ್ರೆಶ್ ಆಗುತ್ತದೆ, ಸ್ಕ್ರೀನ್ ಅನ್ನು ಆನ್ ಮಾಡುತ್ತದೆ ಮತ್ತು ನೆಟ್ವರ್ಕ್ ಸ್ವಲ್ಪ ಸಮಯದವರೆಗೆ ಸ್ಥಗಿತಗೊಂಡರೆ ಅದು ಕೊನೆಯ ಓದುವಿಕೆಯನ್ನು ತೋರಿಸಿ ಮತ್ತೆ ಸಂಪರ್ಕಗೊಳ್ಳುತ್ತದೆ."
  },
  "Look up another place": {
    "hi": "कोई और जगह देखें",
    "kn": "ಬೇರೆಡೆಗೆ ಹೋಗಿ ನೋಡಿ."
  },
  "Low": {
    "hi": "कम",
    "kn": "ಕೆಳಮಟ್ಟದ"
  },
  "Moderate": {
    "hi": "मध्यम",
    "kn": "ಮಧ್ಯಮ"
  },
  "No active national alerts right now.": {
    "hi": "अभी कोई सक्रिय राष्ट्रीय चेतावनी नहीं है।",
    "kn": "ಪ್ರಸ್ತುತ ಯಾವುದೇ ಸಕ್ರಿಯ ರಾಷ್ಟ್ರೀಯ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ."
  },
  "Not a map.": {
    "hi": "यह कोई मानचित्र नहीं है।",
    "kn": "ಇದು ನಕ್ಷೆಯಲ್ಲ."
  },
  "Not here.": {
    "hi": "यह पृष्ठ नहीं मिला",
    "kn": "ಈ ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ."
  },
  "Older adults": {
    "hi": "वृद्ध",
    "kn": "ವೃದ್ಧರು"
  },
  "Open display": {
    "hi": "प्रदर्शन खोलें",
    "kn": "ಪ್ರದರ್ಶನವನ್ನು ತೆರೆಯಿರಿ."
  },
  "Open the display link in the screen's browser: a smart TV, a cheap streaming stick, or an old tablet in a stand.": {
    "hi": "स्क्रीन के वेब ब्राउज़र में प्रदर्शन लिंक खोलें: एक स्मार्ट टीवी, एक सस्ती स्ट्रीमिंग स्टिक, या स्टैंड में एक पुराना टैबलेट।",
    "kn": "ಸ್ಕ್ರೀನ್‌ನ ವೆಬ್ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಪ್ರದರ್ಶನ ಕೊಂಡಿಯನ್ನು ತೆರೆಯಿರಿ: ಸ್ಮಾರ್ಟ್ ಟಿವಿ, ಅಗ್ಗದ ಸ್ಟ್ರೀಮಿಂಗ್ ಸ್ಟಿಕ್ ಅಥವಾ ಸ್ಟ್ಯಾಂಡ್‌ನಲ್ಲಿರುವ ಹಳೆಯ ಟ್ಯಾಬ್ಲೆಟ್."
  },
  "Outdoor workers": {
    "hi": "बाहर काम करने वाले",
    "kn": "ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು"
  },
  "Patchy low visibility. Drive with care.": {
    "hi": "धुंधली दृश्यता। सावधानी से चलाइए।",
    "kn": "ಮಬ್ಬಾದ ಕಡಿಮೆ ಗೋಚರತೆ. ಎಚ್ಚರಿಕೆಯಿಂದ ನಡೆಸಿ."
  },
  "Pick a place": {
    "hi": "कोई जगह चुनें",
    "kn": "ಒಂದು ಸ್ಥಳವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ."
  },
  "Poor": {
    "hi": "खराब",
    "kn": "ಕೆಟ್ಟ"
  },
  "Popular:": {
    "hi": "प्रसिद्ध स्थान:",
    "kn": "ಜನಪ್ರಿಯ ಸ್ಥಳಗಳು:"
  },
  "Press full-screen (F11 with a keyboard, or the browser's full-screen control).": {
    "hi": "फुल-स्क्रीन दबाएं (कीबोर्ड पर F11, या ब्राउज़र का फुल-स्क्रीन नियंत्रण)।",
    "kn": "ಫುಲ್-ಸ್ಕ್ರೀನ್ ಮೋಡ್ (ಕೀಬೋರ್ಡ್‌ನಲ್ಲಿ F11, ಅಥವಾ ಬ್ರೌಸರ್‌ನ ಫುಲ್-ಸ್ಕ್ರೀನ್ ನಿಯಂತ್ರಣ) ಒತ್ತಿ."
  },
  "Put it on a screen": {
    "kn": "ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಹಾಕಿ"
  },
  "Put mugilu on a screen.": {
    "hi": "mugilu को स्क्रीन पर लगाएं।",
    "kn": "ಅದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಹಾಕಿ."
  },
  "Rain": {
    "hi": "बारिश",
    "kn": "ಮಳೆ"
  },
  "Right now in India": {
    "hi": "अभी पूरे भारत में",
    "kn": "ಈಗ ಭಾರತದಾದ್ಯಂತ"
  },
  "Sathya Sankaran wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.": {
    "kn": "Sathya Sankaran ಪ್ರತಿ ಬಾರಿಯೂ ಮೊದಲಿನಿಂದ ಪ್ರಾರಂಭಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಲು ಬಯಸಿದ್ದರು: ಭಾರತದ ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲೆ ಪ್ರತಿಯೊಂದು ಅಪಾಯವನ್ನು ಒಟ್ಟುಗೂಡಿಸಿ, ನಂತರ ಅದನ್ನು ಮೂಲಸೌಕರ್ಯವಾಗಿ ಹಸ್ತಾಂತರಿಸುವುದು, ಆದ್ದರಿಂದ ಮುಂದಿನ ನಕ್ಷೆ, ಕಥೆ ಅಥವಾ ಎಚ್ಚರಿಕೆಯು ಏನೂ ಇಲ್ಲದಿರುವಲ್ಲಿಂದ ಪ್ರಾರಂಭಿಸಬೇಕಾಗಿಲ್ಲ."
  },
  "Severe": {
    "hi": "गंभीर",
    "kn": "ತೀವ್ರ"
  },
  "Smoke": {
    "hi": "धुआं",
    "kn": "ಹೊಗೆ"
  },
  "Some dust in the air.": {
    "hi": "हवा में थोड़ी धूल।",
    "kn": "ಗಾಳಿಯಲ್ಲಿ ಸ್ವಲ್ಪ ಧೂಳು ಇದೆ."
  },
  "Source on GitHub, drop a star if it's useful": {
    "kn": "GitHub‌ನಲ್ಲಿರುವ ಮೂಲ ಸಂಕೇತ, ಅದು ಉಪಯುಕ್ತವಾಗಿದ್ದರೆ ಸ್ಟಾರ್ ಸೇರಿಸಿ."
  },
  "Sources": {
    "hi": "स्रोत",
    "kn": "ಮೂಲಗಳು"
  },
  "Strong sun, a hat or sunscreen helps.": {
    "hi": "तेज धूप में टोपी या सनस्क्रीन पहनने से मदद मिलती है।",
    "kn": "ಬಿಸಿಲು, ಟೋಪಿ ಅಥವಾ ಸನ್‌ಸ್ಕ್ರೀನ್‌ ಸಹಾಯ ಮಾಡುತ್ತದೆ."
  },
  "Strong winds. Take care outdoors, expect blowing dust.": {
    "hi": "तेज हवाएँ चल रही हैं। बाहर सावधान रहें, और धूल उड़ती रहने की उम्मीद रखें।",
    "kn": "ಬಲವಾದ ಗಾಳಿ ಬೀಸುತ್ತಿದೆ. ಹೊರಗೆ ಜಾಗರೂಕರಾಗಿರಿ, ಮತ್ತು ಧೂಳು ಬೀಸುತ್ತಿರುವುದನ್ನು ನಿರೀಕ್ಷಿಸಿ."
  },
  "Sun": {
    "hi": "सूर्य",
    "kn": "ಸೂರ್ಯ"
  },
  "Take some care outdoors.": {
    "hi": "बाहर थोड़ी सावधानी रखें।",
    "kn": "ಹೊರಗೆ ಸ್ವಲ್ಪ ಜಾಗರೂಕತೆಯಿಂದಿರಿ."
  },
  "That is mugilu.": {
    "kn": "ಅದೇ mugilu."
  },
  "That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate.": {
    "hi": "उस पृष्ठ का mugilu पर अस्तित्व नहीं है। इसके बजाय किसी जगह को देखें या निर्देशांक दें।",
    "kn": "ಆ ಪುಟ ಇಲ್ಲಿ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ. ಬದಲಿಗೆ, ಒಂದು ಸ್ಥಳವನ್ನು ಹುಡುಕಿ ಅಥವಾ ನಿರ್ದೇಶಾಂಕವನ್ನು ನೀಡಿ."
  },
  "The open sky of India, one coordinate at a time.": {
    "hi": "भारत का खुला आकाश, एक बार में एक निर्देशांक।",
    "kn": "ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ, ನಿರ್ದೇಶಾಂಕ ಒಂದೊಂದಾಗಿ."
  },
  "The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is non-commercial, for good, the third in a small set of public tools alongside bharatlas and mdshare.": {
    "kn": "ನಿಮ್ಮ ಮೇಲಿರುವ ಆಕಾಶವು ಒಂದು ಹಂಚಿಕೆಯ ಸಾಮಾನ್ಯ ಸ್ಥಳವಾಗಿದೆ. ಇದು ಹಣ ವೆಚ್ಚವಾಗಬಾರದು ಅಥವಾ ಯಾರೊಬ್ಬರ ಆ್ಯಪ್‌ನೊಳಗೆ ಲಾಕ್ ಆಗಬಾರದು ಎಂದು ತಿಳಿದಿದೆ. mugilu ವಾಣಿಜ್ಯೇತರವಾಗಿದ್ದು, ಸಾರ್ವಜನಿಕ ಹಿತಕ್ಕಾಗಿ ತಯಾರಿಸಲ್ಪಟ್ಟಿದೆ, bharatlas ಮತ್ತು mdshare ಜೊತೆಗೆ ಸಾರ್ವಜನಿಕ ಸಾಧನಗಳ ಸಣ್ಣ ಸಮೂಹದಲ್ಲಿ ಮೂರನೆಯದಾಗಿದೆ."
  },
  "The sun is very strong. Limit midday hours.": {
    "hi": "सूर्य बहुत तेज है। दोपहर के समय बाहर कम समय बिताएं।",
    "kn": "ಸೂರ್ಯ ಬಹಳ ಪ್ರಬಲನಾಗಿರುತ್ತಾನೆ. ಮಧ್ಯಾಹ್ನದ ಸಮಯದಲ್ಲಿ ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ."
  },
  "Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.": {
    "hi": "किसी भी डिस्प्ले को आकाश की लाइव, स्व-अपडेटिंग रीडिंग में बदलें। कोई जगह चुनें, उसे स्क्रीन पर खोलें, फुल-स्क्रीन दबाएं। यह खुद को रिफ्रेश करता है और एक कोने का QR कोड राहगीरों को उनके फोन पर उसी जगह पर भेजता है।",
    "kn": "ಯಾವುದೇ ಡಿಸ್ಪ್ಲೇಯನ್ನು ಆಕಾಶದ ಲೈವ್, ಸ್ವಯಂ-ಅಪ್‌ಡೇಟ್ ಆಗುವ ಓದುವಿಕೆಯಾಗಿ ಪರಿವರ್ತಿಸಿ. ಒಂದು ಸ್ಥಳವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ, ಅದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ತೆರೆಯಿರಿ, ಫುಲ್-ಸ್ಕ್ರೀನ್ ಒತ್ತಿರಿ. ಇದು ತನ್ನನ್ನು ತಾನು ರಿಫ್ರೆಶ್ ಮಾಡಿಕೊಳ್ಳುತ್ತದೆ, ಮತ್ತು ಒಂದು ಮೂಲೆಯ ಕ್ಯೂ.ಆರ್. ಕೋಡ್‌ನಿಂದ ಹಾದುಹೋಗುವವರಿಗೆ ಅವರ ಫೋನಿನಲ್ಲಿ ಅದೇ ಸ್ಥಳಕ್ಕೆ ಕಳುಹಿಸುತ್ತದೆ."
  },
  "Type a place. See what the sky is doing to you right now: air, heat (and how survivable it really is), rain, sun and dust, alongside any official warning over that spot. Then one plain line, the single worst thing for you, whether you have asthma, work outdoors, or are minding a child or an older parent. No sign-up, no jargon.": {
    "kn": "ಸ್ಥಳ ಟೈಪ್ ಮಾಡಿ. ಆಕಾಶವು ಈಗ ನಿಮಗೆ ಏನು ಮಾಡುತ್ತಿದೆ ಎಂಬುದನ್ನು ನೋಡಿ: ವಾಯು ಗುಣಮಟ್ಟ, ಬಿಸಿಲು (ಮತ್ತು ಅದು ನಿಜವಾಗಿಯೂ ಎಷ್ಟು ಬದುಕುಳಿಯಬಲ್ಲದು), ಮಳೆ, ಸೂರ್ಯ ಮತ್ತು ಧೂಳು, ಜೊತೆಗೆ ಆ ಸ್ಥಳದ ಬಗ್ಗೆ ಯಾವುದೇ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ. ನಂತರ ಒಂದು ಸರಳ ರೇಖೆ, ನಿಮಗೆ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದು, ನೀವು ಆಸ್ತಮಾ ಹೊಂದಿದ್ದರೂ, ಹೊರಾಂಗಣದಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದರೂ ಅಥವಾ ಮಗುವನ್ನು ಅಥವಾ ಹಿರಿಯ ಪೋಷಕರನ್ನು ನೋಡಿಕೊಳ್ಳುತ್ತಿದ್ದರೂ. ನೋಂದಣಿ ಅಗತ್ಯವಿಲ್ಲ, ಯಾವುದೇ ತಾಂತ್ರಿಕ ಶಬ್ದಗಳಿಲ್ಲ."
  },
  "Type any place in India, in any language": {
    "hi": "भारत में किसी भी स्थान का नाम, किसी भी भाषा में लिखें",
    "kn": "ಭಾರತದಲ್ಲಿರುವ ಯಾವುದೇ ಸ್ಥಳದ ಹೆಸರನ್ನು, ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ, ಬರೆಯಿರಿ."
  },
  "UV index": {
    "hi": "पराबैंगनी सूचकांक",
    "kn": "ನೇರಳಾತೀತ ಸೂಚ್ಯಂಕ"
  },
  "Use my location": {
    "hi": "मेरे स्थान का प्रयोग करें",
    "kn": "ನನ್ನ ಸ್ಥಳವನ್ನು ಬಳಸಿ."
  },
  "Very dense fog. Avoid driving if you can.": {
    "hi": "बहुत घना कोहरा। यदि आप कर सकते हैं तो गाड़ी न चलाएँ।",
    "kn": "ತುಂಬಾ ದಟ್ಟವಾದ ಮಂಜು. ಸಾಧ್ಯವಾದರೆ ವಾಹನ ಚಲಾಯಿಸದಿರಿ."
  },
  "Very poor": {
    "hi": "बहुत खराब",
    "kn": "ತುಂಬಾ ಕೆಟ್ಟ"
  },
  "Visibility": {
    "hi": "दृश्यता",
    "kn": "ಗೋಚರತೆ"
  },
  "Weight it for who is nearby": {
    "hi": "पास के लोगों के अनुसार पढ़ना तय करें",
    "kn": "ಹತ್ತಿರದಲ್ಲಿ ಇರುವ ಜನರ ಗುಂಪಿಗೆ ಓದುವಿಕೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ."
  },
  "Wet-bulb is the temperature a wet thermometer settles at: it folds heat and humidity into the one number that decides whether your body can still cool itself. Above about 32 degrees wet-bulb, even resting in shade turns dangerous. Ordinary feels-like numbers hide this, so mugilu surfaces it.": {
    "kn": "ಆರ್ದ್ರ-ಬಲ್ಬ್ ಎಂಬುದು ತೇವವಾದ ಥರ್ಮಾಮೀಟರ್ ತಲುಪುವ ತಾಪಮಾನವಾಗಿದೆ: ಇದು ಬಿಸಿಲು ಮತ್ತು ತೇವಾಂಶವನ್ನು ಒಂದೇ ಸಂಖ್ಯೆಯಲ್ಲಿ ಸಂಯೋಜಿಸುತ್ತದೆ, ಇದು ನಿಮ್ಮ ದೇಹವು ಇನ್ನೂ ತನ್ನನ್ನು ತಾನು ತಂಪಾಗಿಸಿಕೊಳ್ಳಬಹುದೇ ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸುತ್ತದೆ. ಸುಮಾರು 32 ಡಿಗ್ರಿ ತೇವ-ಬಲ್ಬ್‌ಗಿಂತ ಹೆಚ್ಚಿನ ತಾಪಮಾನದಲ್ಲಿ, ನೆರಳಿನಲ್ಲಿ ವಿಶ್ರಾಂತಿ ಪಡೆಯುವುದೂ ಸಹ ಅಪಾಯಕಾರಿಯಾಗುತ್ತದೆ. ಸಾಮಾನ್ಯ ಭಾವನೆಗಳು-ತರಹದ ಸಂಖ್ಯೆಗಳು ಇದನ್ನು ಮರೆಮಾಡುತ್ತವೆ, ಆದ್ದರಿಂದ mugilu ಅದನ್ನು ತೋರಿಸುತ್ತಾನೆ."
  },
  "What is wet-bulb temperature, and why does mugilu show it?": {
    "kn": "ತೇವಾಂಶ-ಬಲ್ಬ್ ತಾಪಮಾನ ಎಂದರೇನು, ಮತ್ತು mugilu ಅದನ್ನು ಏಕೆ ತೋರಿಸುತ್ತದೆ?"
  },
  "What's it like outside, right now?": {
    "hi": "बाहर अभी कैसा है?",
    "kn": "ಈಗ ಹೊರಗೆ ಹೇಗಿದೆ?"
  },
  "Where does mugilu's data come from?": {
    "kn": "mugilu ಬಳಸುವ ದತ್ತಾಂಶ ಎಲ್ಲಿಂದ ಬರುತ್ತದೆ?"
  },
  "Where it comes from": {
    "kn": "ಇದು ಎಲ್ಲಿಂದ ಬರುತ್ತದೆ"
  },
  "Why it's free": {
    "kn": "ಇದು ಏಕೆ ಉಚಿತ"
  },
  "Why mugilu": {
    "kn": "mugilu ಏಕೆ"
  },
  "Wind": {
    "hi": "हवा",
    "kn": "ಗಾಳಿ"
  },
  "Worst air": {
    "hi": "सबसे खराब वायु गुणवत्ता",
    "kn": "ಅತ್ಯಂತ ಕೆಟ್ಟ ವಾಯು ಗುಣಮಟ್ಟ"
  },
  "X days ago": {
    "hi": "X दिन पहले",
    "kn": "X ದಿನಗಳ ಹಿಂದೆ"
  },
  "X hours ago": {
    "hi": "X घंटे पहले",
    "kn": "X ಗಂಟೆಗಳ ಹಿಂದೆ"
  },
  "X min ago": {
    "hi": "X मिनट पहले",
    "kn": "X ನಿಮಿಷಗಳ ಹಿಂದೆ"
  },
  "Yes. It is free, open source (MIT) and non-commercial, with no sign-up. Every reading is also available as JSON, Markdown, an embeddable card, an OpenAPI spec, and an MCP server for AI agents.": {
    "kn": "ಹೌದು. ಇದು ಉಚಿತ, ಮುಕ್ತ ಮೂಲ (MIT) ಮತ್ತು ವಾಣಿಜ್ಯೇತರವಾಗಿದ್ದು, ಯಾವುದೇ ನೋಂದಣಿಯಿಲ್ಲ. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯು JSON, Markdown, ಎಂಬೆಡ್ ಮಾಡಬಹುದಾದ ಕಾರ್ಡ್, OpenAPI ಸ್ಪೆಕ್ ಮತ್ತು AI ಏಜೆಂಟ್‌ಗಳಿಗಾಗಿ MCP ಸರ್ವರ್ ಆಗಿ ಲಭ್ಯವಿದೆ."
  },
  "Your places": {
    "hi": "आपके सहेजे हुए स्थान",
    "kn": "ನಿಮ್ಮ ಸ್ಥಳಗಳು"
  },
  "a digital commons": {
    "hi": "डिजिटल कॉमन्स",
    "kn": "ಡಿಜಿಟಲ್ ಕಾಮನ್ಸ್"
  },
  "about": {
    "hi": "परिचय",
    "kn": "ಬಗ್ಗೆ"
  },
  "air": {
    "hi": "वायु",
    "kn": "ಗಾಳಿ"
  },
  "alert": {
    "hi": "चेतावनी",
    "kn": "ಎಚ್ಚರಿಕೆ"
  },
  "breezy": {
    "hi": "हल्की हवा",
    "kn": "ಹಗುರ ಗಾಳಿ"
  },
  "build on it": {
    "hi": "उस पर निर्माण करें",
    "kn": "ಅದರ ಮೇಲೆ ನಿರ್ಮಾಣ ಮಾಡಿ"
  },
  "calm": {
    "hi": "शांत",
    "kn": "ಶಾಂತ"
  },
  "caution": {
    "hi": "सावधानी",
    "kn": "ಎಚ್ಚರಿಕೆ"
  },
  "chance of rain": {
    "hi": "बारिश की संभावना",
    "kn": "ಮಳೆ ಸಾಧ್ಯತೆ"
  },
  "clear": {
    "hi": "स्पष्ट",
    "kn": "ಗೋಚರತೆ"
  },
  "code": {
    "hi": "स्रोत कोड",
    "kn": "ಸೋರ್ಸ್ ಕೋಡ್"
  },
  "cold": {
    "hi": "सर्दी",
    "kn": "ಶೀತ"
  },
  "dangerous": {
    "hi": "खतरनाक",
    "kn": "ಅಪಾಯಕಾರಿ"
  },
  "dangerous cold": {
    "hi": "खतरनाक ठंड",
    "kn": "ಘನೀಕರಿಸುವ"
  },
  "dangerous humid heat": {
    "hi": "खतरनाक उमस भरी गर्मी",
    "kn": "ಅಪಾಯಕಾರವಾದ ಆರ್ದ್ರತೆ ಮತ್ತು ಬಿಸಿಲು"
  },
  "dense fog": {
    "hi": "अति घना कोहरा",
    "kn": "ದಟ್ಟವಾದ ಮಂಜು"
  },
  "dust": {
    "hi": "धूल",
    "kn": "ಧೂಳು"
  },
  "extreme": {
    "hi": "अत्यधिक",
    "kn": "ವಿಪರೀತ"
  },
  "extreme heat": {
    "hi": "अत्यधिक गर्मी",
    "kn": "ವಿಪರೀತ ಬಿಸಿಲು"
  },
  "feels": {
    "hi": "महसूस",
    "kn": "ಅನಿಸುತ್ತದೆ"
  },
  "feels like": {
    "hi": "जैसा लगता है",
    "kn": "ಅನಿಸುತ್ತದೆ"
  },
  "fog": {
    "hi": "कोहरा",
    "kn": "ಮಂಜು"
  },
  "gale": {
    "hi": "तूफ़ानी हवा",
    "kn": "ಬಿರುಗಾಳಿ"
  },
  "gusts": {
    "hi": "झोंके",
    "kn": "ಗಾಳಿಯ ರಭಸ"
  },
  "hazy": {
    "hi": "धुंधला",
    "kn": "ಮಬ್ಬಾದ"
  },
  "heat": {
    "hi": "गर्मी",
    "kn": "ಬಿಸಿಲು"
  },
  "high": {
    "hi": "अधिक",
    "kn": "ಹೆಚ್ಚು"
  },
  "high dust": {
    "hi": "अधिक धूल",
    "kn": "ಹೆಚ್ಚು ಧೂಳು"
  },
  "how it works": {
    "hi": "यह कैसे कार्य करता है",
    "kn": "ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ:"
  },
  "just now": {
    "hi": "अभी",
    "kn": "ಈಗಷ್ಟೇ"
  },
  "light dust": {
    "hi": "हल्की धूल",
    "kn": "ಸ್ವಲ್ಪ ಧೂಳು"
  },
  "low": {
    "hi": "कम",
    "kn": "ಕಡಿಮೆ"
  },
  "measured": {
    "hi": "मापा गया",
    "kn": "ಸಂವೇದಕದಿಂದ ಅಳೆಯಲಾದ"
  },
  "misty": {
    "hi": "हल्का धुंध",
    "kn": "ಮಬ್ಬಾದ"
  },
  "modelled": {
    "hi": "अनुमानित",
    "kn": "ಅಂದಾಜು"
  },
  "moderate": {
    "hi": "मध्यम",
    "kn": "ಮಧ್ಯಮ"
  },
  "moderate dust": {
    "hi": "मध्यम धूल",
    "kn": "ಮಧ್ಯಮ ಧೂಳು"
  },
  "mugilu is meant to be built on, not just looked at. Every reading is also open, machine-readable data, so you can put the whole sky behind your own map, story, dashboard or alert, and spend your time on the part that matters: the telling, and the action.": {
    "kn": "mugilu ಎಂದರೆ ಕೇವಲ ನೋಡುವುದಷ್ಟೇ ಅಲ್ಲ, ಅದನ್ನು ಕಟ್ಟಬೇಕು. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯ ತುಣುಕು ಸಹ ಮುಕ್ತವಾಗಿದೆ, ಯಂತ್ರ-ಓದಬಲ್ಲದು, ಆದ್ದರಿಂದ ನೀವು ನಿಮ್ಮ ಸ್ವಂತ ನಕ್ಷೆ, ಕಥೆ, ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಅಥವಾ ಎಚ್ಚರಿಕೆಯ ಹಿಂದೆ ಇಡೀ ಆಕಾಶವನ್ನು ಇರಿಸಬಹುದು, ಮತ್ತು ನಿಮ್ಮ ಸಮಯವನ್ನು ಮುಖ್ಯವಾದ ಭಾಗದ ಮೇಲೆ ಕಳೆಯಬಹುದು: ಹೇಳುವುದು, ಮತ್ತು ಕ್ರಮ ಕೈಗೊಳ್ಳುವುದು."
  },
  "mugilu is the Kannada word for the open sky.": {
    "kn": "mugilu — ಇದು ಮುಕ್ತ ಆಕಾಶಕ್ಕೆ ಕನ್ನಡ ಪದ (ಮುಗಿಲು)."
  },
  "mugilu mirrors the SACHET feed and keeps an archive of every alert.": {
    "hi": "mugilu हर चेतावनी का अभिलेख रखते हुए SACHET फ़ीड को दर्शाता है।",
    "kn": "ಇದು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಫೀಡ್ ಅನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ ಮತ್ತು ಪ್ರತಿ ಎಚ್ಚರಿಕೆಯ ಆರ್ಕೈವ್ ಅನ್ನು ಇಡುತ್ತದೆ."
  },
  "mugilu names the single worst hazard over your exact location and says plainly what to do, weighted for who you are: asthma, older adults, children, outdoor workers, or a heart condition. It is informational, not medical or safety advice; for official warnings, consult NDMA and IMD.": {
    "kn": "mugilu ನಿಮ್ಮ ನಿಖರವಾದ ಸ್ಥಳದ ಮೇಲೆ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯವನ್ನು ಹೆಸರಿಸಿ, ಏನು ಮಾಡಬೇಕು ಎಂಬುದನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳುತ್ತಾನೆ, ನೀವು ಯಾರು ಎಂಬುದರ ಆಧಾರದ ಮೇಲೆ: ಆಸ್ತಮಾ, ಹಿರಿಯ ವಯಸ್ಕರು, ಮಕ್ಕಳು, ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು ಅಥವಾ ಹೃದಯ ಸ್ಥಿತಿ. ಇದು ಕೇವಲ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ ಅಥವಾ ಸುರಕ್ಷತಾ ಸಲಹೆಗಳಿಗಾಗಿ ಅಲ್ಲ; ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, NDMA ಮತ್ತು IMDಯನ್ನು ಸಂಪರ್ಕಿಸಿ."
  },
  "mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: CPCB and OpenAQ for air, Open-Meteo for weather, NDMA and IMD (via SACHET) for warnings, and bharatlas for the map of India. The code is open under the MIT licence; the data keeps each source's own terms.": {
    "kn": "mugilu ಯಾವುದೇ ಸಂವೇದಕಗಳನ್ನು ಹೊಂದಿಲ್ಲ ಮತ್ತು ಯಾವುದೇ ಮುನ್ಸೂಚನೆಗಳನ್ನು ನೀಡುವುದಿಲ್ಲ. ಇದು ಇತರರ ಕೆಲಸವನ್ನು ಆಧರಿಸಿದೆ ಮತ್ತು ಅವರಿಗೆ ಮನ್ನಣೆ ನೀಡುತ್ತದೆ: ವಾಯು ಗುಣಮಟ್ಟಕ್ಕಾಗಿ CPCB ಮತ್ತು OpenAQ, ಹವಾಮಾನಕ್ಕಾಗಿ Open-Meteo, ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ NDMA ಮತ್ತು IMD (SACHET ಮೂಲಕ) ಮತ್ತು ಭಾರತದ ನಕ್ಷೆಗಾಗಿ bharatlas. ಕೋಡ್ MIT ಪರವಾನಗಿ ಅಡಿಯಲ್ಲಿ ತೆರೆದಿರುತ್ತದೆ; ದತ್ತಾಂಶವು ಪ್ರತಿ ಮೂಲದ ಸ್ವಂತ ನಿಯಮಗಳನ್ನು ಹೊಂದಿರುತ್ತದೆ."
  },
  "none": {
    "hi": "कोई नहीं",
    "kn": "ಅಪಾಯವಿಲ್ಲ"
  },
  "official NDMA / IMD alerts across India, right now.": {
    "hi": "भारत भर में आधिकारिक NDMA / IMD अलर्ट, अभी।",
    "kn": "ಭಾರತದಾದ್ಯಂತ ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಎಚ್ಚರಿಕೆಗಳು, ಈಗಲೇ."
  },
  "rain": {
    "hi": "बारिश",
    "kn": "ಮಳೆ"
  },
  "rain chance": {
    "hi": "बारिश की संभावना",
    "kn": "ಮಳೆ ಸಾಧ್ಯತೆ"
  },
  "safe": {
    "hi": "सुरक्षित",
    "kn": "ಸುರಕ್ಷಿತ"
  },
  "scan for this on your phone": {
    "hi": "अपने फ़ोन पर देखने के लिए इसे स्कैन करें",
    "kn": "ನಿಮ್ಮ ಫೋನಿನಲ್ಲಿ ನೋಡಲು ಇದನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ."
  },
  "severe dust": {
    "hi": "गंभीर धूल",
    "kn": "ತೀವ್ರ ಧೂಳು"
  },
  "severe heat": {
    "hi": "भीषण गर्मी",
    "kn": "ತೀವ್ರ ಬಿಸಿಲು"
  },
  "sky": {
    "hi": "आकाश",
    "kn": "ಆಕಾಶ"
  },
  "smoke": {
    "hi": "धुआं",
    "kn": "ಹೊಗೆ"
  },
  "storm-force": {
    "hi": "प्रचंड तूफ़ानी हवा",
    "kn": "ಚಂಡಮಾರುತ"
  },
  "strong": {
    "hi": "तेज हवा",
    "kn": "ಜೋರು ಗಾಳಿ"
  },
  "sun": {
    "hi": "सूर्य",
    "kn": "ಸೂರ್ಯ"
  },
  "terms": {
    "hi": "शर्तें",
    "kn": "ಷರತ್ತುಗಳು"
  },
  "the sky over this spot": {
    "hi": "इस स्थान पर आकाश",
    "kn": "ಆಕಾಶ ಈ ಸ್ಥಳದ ಮೇಲೆ"
  },
  "thick fog": {
    "hi": "घना कोहरा",
    "kn": "ದಟ್ಟವಾದ ಮಂಜು"
  },
  "to see its sky: air, heat, rain, dust.": {
    "hi": "इसका आकाश देखने के लिए: वायु, गर्मी, बारिश, धूल।",
    "kn": "ಅದರ ಆಕಾಶವನ್ನು ನೋಡಲು: ಗಾಳಿ, ಬಿಸಿಲು, ಮಳೆ, ಧೂಳು."
  },
  "updated": {
    "hi": "अपडेट किया गया",
    "kn": "ಕೊನೆಯದಾಗಿ ಪರಿಷ್ಕೃತ"
  },
  "very cold": {
    "hi": "बहुत ठंड",
    "kn": "ಶೀತಲ ವಾತಾವರಣ"
  },
  "very high": {
    "hi": "बहुत अधिक",
    "kn": "ಅತಿಹೆಚ್ಚು"
  },
  "very hot": {
    "hi": "बहुत गर्म",
    "kn": "ತುಂಬಾ ಬಿಸಿಲು"
  },
  "warm": {
    "hi": "गर्म",
    "kn": "ಬಿಸಿಲು"
  },
  "warnings": {
    "hi": "चेतावनियाँ",
    "kn": "ಎಚ್ಚರಿಕೆಗಳು"
  },
  "wind": {
    "hi": "हवा",
    "kn": "ಗಾಳಿ"
  },
  "years of life lost": {
    "hi": "जीवन के खोए वर्ष",
    "kn": "ವರ್ಷಗಳ ಜೀವನ ಕಳೆದುಹೋಗಿದೆ"
  }
};
export function t(en: string, lang: Lang): string {
  if (lang === "en") return en;
  const e = TR[en];
  return (e && e[lang]) || en;
}
