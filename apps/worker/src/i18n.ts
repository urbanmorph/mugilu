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
    // Display headings: relax the tight Latin line-heights (.95-1.05) and drop the negative
    // tracking so stacked matras / conjuncts don't clip or crowd.
    ".hero,.tagline,.loc,.amb-head,.ahero,.eamb,.kname,.khead,.wcat,.covers{line-height:1.25;letter-spacing:normal}" +
    // Leads sat at 1.42 in Latin; Indic needs MORE leading, not less (was wrongly 1.25).
    ".alead,.amb-say{line-height:1.55}" +
    // Eyebrow / dt label rows used line-height:1, which clips Indic matras.
    ".ah,.amb-eye,.lyr dt{line-height:1.35}" +
    // The footer back-link carries translated text; the mono stack has no Indic glyphs.
    ".aback a{font-family:var(--sans)}"
  );
}

// en -> { hi, kn }. Generated from the native-reviewed sheets; edit there and regenerate.
const TR: Record<string, Partial<Record<Exclude<Lang, "en">, string>>> = {
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
  'Each hazard is scored 0 to 3 (none, caution, high, severe). We surface the worst one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. Averaging would hide the thing that matters, so we never average.':
    {
      hi: 'प्रत्येक खतरे को 0 से 3 तक अंक दिए जाते हैं (कोई नहीं, सावधानी, अधिक, गंभीर)। हम सबसे बुरे को सरल शब्दों में नाम देकर दिखाते हैं ("गंभीर धुआं", "अधिक गर्मी"), क्या करना है इस पर एक वाक्य के साथ। औसत निकालने से जो मायने रखता है वह छिप जाएगा, इसलिए हम कभी औसत नहीं निकालते।',
      kn: 'ಪ್ರತಿಯೊಂದು ಅಪಾಯಕ್ಕೂ 0 ರಿಂದ 3 ರವರೆಗೆ ಅಂಕ ನೀಡಲಾಗುತ್ತದೆ (ಅಪಾಯವಿಲ್ಲ · ಎಚ್ಚರಿಕೆ · ಹೆಚ್ಚು · ತೀವ್ರ). ನಾವು ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದನ್ನು ಸರಳ ಪದಗಳಲ್ಲಿ ಹೆಸರಿಸಿ ತೋರಿಸುತ್ತೇವೆ ("ತೀವ್ರ ಹೊಗೆ", "ಹೆಚ್ಚು ಬಿಸಿಲು"), ಏನು ಮಾಡಬೇಕು ಎಂಬುದರ ಬಗ್ಗೆ ಒಂದೇ ವಾಕ್ಯದೊಂದಿಗೆ. ಸರಾಸರಿ ಮಾಡಿದರೆ ಮುಖ್ಯವಾದ ವಿಷಯ ಮರೆಯಾಗುತ್ತದೆ, ಆದ್ದರಿಂದ ನಾವು ಎಂದಿಗೂ ಸರಾಸರಿ ಮಾಡುವುದಿಲ್ಲ.',
    },
  "For who you are": {
    hi: "आप कौन हैं, उसके अनुसार",
    kn: "ನೀವು ಯಾರೆಂಬುದಕ್ಕೆ ತಕ್ಕಂತೆ",
  },
  'Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). When your trigger isn\'t the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle you choose: never inferred, never stored.':
    {
      hi: 'एक संवेदनशीलता चुनें (अस्थमा, वृद्ध, बच्चे, बाहर काम करने वाले, हृदय) और वह समूह जिन खतरों को अधिक तीव्रता से महसूस करता है उन्हें एक स्तर ऊपर कर दिया जाता है (इसलिए अस्थमा वाले को मध्यम वायु "अधिक" दिखती है)। जब आपकी समस्या मुख्य बात नहीं है पर फिर भी बढ़ी हुई है, तो एक दूसरी पंक्ति उसे सामने लाती है ("यह भी देखें: वायु अधिक है")। यह चुनाव आप स्वयं करते हैं: कभी अनुमान नहीं, कभी संग्रहीत नहीं।',
      kn: 'ಒಂದು ದುರ್ಬಲತೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ (ಆಸ್ತಮಾ, ವೃದ್ಧರು, ಮಕ್ಕಳು, ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು, ಹೃದಯ) ಮತ್ತು ಆ ಗುಂಪು ಹೆಚ್ಚು ತೀವ್ರವಾಗಿ ಅನುಭವಿಸುವ ಅಪಾಯಗಳನ್ನು ಒಂದು ಹಂತ ಮೇಲಕ್ಕೆ ಏರಿಸಲಾಗುತ್ತದೆ (ಆದ್ದರಿಂದ ಆಸ್ತಮಾ ಇರುವವರು ಮಧ್ಯಮ ಗಾಳಿಯನ್ನು "ಹೆಚ್ಚು" ಎಂದು ನೋಡುತ್ತಾರೆ). ನಿಮ್ಮ ಸಮಸ್ಯೆ ಮುಖ್ಯಾಂಶವಲ್ಲದಿದ್ದರೂ ಇನ್ನೂ ಹೆಚ್ಚಿದ್ದರೆ, ಎರಡನೇ ಸಾಲು ಅದನ್ನು ತೋರಿಸುತ್ತದೆ ("ಗಮನಿಸಿ: ಗಾಳಿ ಹೆಚ್ಚಿದೆ"). ಈ ಆಯ್ಕೆ ನೀವೇ ಮಾಡುವ ಒಂದು ಟಾಗಲ್: ಎಂದಿಗೂ ಊಹಿಸುವುದಿಲ್ಲ, ಎಂದಿಗೂ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ.',
    },
  "The thresholds": {
    hi: "सीमाएँ",
    kn: "ಮಿತಿಗಳು",
  },
  Hazard: {
    hi: "खतरा",
    kn: "ಅಪಾಯ",
  },
  Caution: {
    hi: "सावधानी",
    kn: "ಎಚ್ಚರಿಕೆ",
  },
  "Air (AQI)": {
    hi: "वायु (AQI)",
    kn: "ವಾಯುಗುಣ (AQI)",
  },
  "Heat (feels-like)": {
    hi: "गर्मी (महसूस)",
    kn: "ಬಿಸಿಲು (ಅನಿಸುವ)",
  },
  "Heat (wet-bulb)": {
    hi: "गर्मी (वेट-बल्ब)",
    kn: "ಬಿಸಿಲು (ತೇವ-ಬಲ್ಬ್)",
  },
  "Heat (WBGT)": {
    hi: "गर्मी (WBGT)",
    kn: "ಬಿಸಿಲು (WBGT)",
  },
  "Cold (feels-like)": {
    hi: "सर्दी (महसूस)",
    kn: "ಶೀತ (ಅನಿಸುವ)",
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
    kn: "ಧೂಳు (µg/m³)",
  },
  "Heat takes the worst of feels-like, wet-bulb and WBGT. The persona toggle then bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind), WHO (UV) and NASA FIRMS (smoke); the full logic is the open {score}, and every layer's source and licence is on {terms}.":
    {
      hi: "गर्मी, महसूस-तापमान, वेट-बल्ब और WBGT में से सबसे बुरा लेती है। फिर प्रोफ़ाइल टॉगल एक संवेदनशील खतरे को एक स्तर ऊपर कर देता है। ये सीमाएँ CPCB (वायु), IMD और Australian BoM (गर्मी / सर्दी / हवा), WHO (UV) और NASA FIRMS (धुआं) से आती हैं; पूरा तर्क खुला {score} है, और हर परत का स्रोत और लाइसेंस {terms} पृष्ठ पर है।",
      kn: "ಬಿಸಿಲು ಎಂಬುದು ಅನಿಸುವ ತಾಪಮಾನ, ತೇವ-ಬಲ್ಬ್ ಮತ್ತು WBGT ಇವುಗಳಲ್ಲಿ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ. ನಂತರ ಪರ್ಸೋನಾ ಟಾಗಲ್ ಒಂದು ಸೂಕ್ಷ್ಮ ಅಪಾಯವನ್ನು ಒಂದು ಹಂತ ಮೇಲಕ್ಕೆ ಏರಿಸುತ್ತದೆ. ಈ ಮಟ್ಟಗಳು CPCB (ಗಾಳಿ), IMD ಮತ್ತು Australian BoM (ಬಿಸಿಲು / ಶೀತ / ಗಾಳಿ), WHO (UV) ಮತ್ತು NASA FIRMS (ಹೊಗೆ) ಇವುಗಳಿಂದ ಬರುತ್ತವೆ; ಸಂಪೂರ್ಣ ತರ್ಕವು ಮುಕ್ತ {score} ಆಗಿದೆ, ಮತ್ತು ಪ್ರತಿ ಪದರದ ಮೂಲ ಮತ್ತು ಪರವಾನಗಿ {terms} ಪುಟದಲ್ಲಿದೆ.",
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
      hi: "केवल जानकारी और शिक्षा के लिए, न कि चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए। रीडिंग मापे गए और अनुमानित मूल्यों का मिश्रण हैं और गलत, पुरानी या अनुपलब्ध हो सकती हैं। सटीकता या उपलब्धता की कोई गारंटी नहीं है। आधिकारिक खतरे की चेतावनियों के लिए, NDMA और IMD से सीधे परामर्श करें।",
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
  "Heat, rain, UV, dust, wind": {
    hi: "गर्मी, बारिश, UV, धूल, हवा",
    kn: "ಬಿಸಿಲು, ಮಳೆ, UV, ಧೂಳು, ಗಾಳಿ",
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
      hi: "कोई खाते नहीं, कोई साइन-अप नहीं, कोई विज्ञापन नेटवर्क नहीं। उपयोगिता गणनाएँ पहली-पक्ष और समग्र (गोल निर्देशांक, कोई IP पता, कोई प्रति-व्यक्ति डेटा) हैं। आगंतुकों की संख्या और पृष्ठ प्रदर्शन के लिए, mugilu Cloudflare Web Analytics का उपयोग करता है, जो कुकी-रहित है, कोई व्यक्तिगत डेटा एकत्र नहीं करता है, और कोई क्रॉस-साइट ट्रैकिंग या फिंगरप्रिंटिंग नहीं करता है। आपके सहेजे हुए स्थान केवल आपके अपने ब्राउज़र में ही रहते हैं।",
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
    hi: "जीवन के खोए वर्ष {aqli} पद्धति का उपयोग करते हैं (U Chicago EPIC)।",
    kn: "ಜೀವನದ ಕಳೆದುಹೋದ ವರ್ಷಗಳು {aqli} ವಿಧಾನವನ್ನು ಬಳಸುತ್ತವೆ (U Chicago EPIC).",
  },
  "an MCP server at {mcp} (tools for conditions, place search, nearest stations, warnings and the national picture; plus resources and prompts). Listed in {llms}.":
    {
      hi: "{mcp} पर एक MCP सर्वर (स्थितियों, स्थान खोज, निकटतम केंद्रों, चेतावनियों और राष्ट्रीय चित्र के लिए टूल; साथ ही संसाधन और प्रॉम्प्ट)। {llms} में सूचीबद्ध।",
      kn: "{mcp} ನಲ್ಲಿ ಒಂದು MCP ಸರ್ವರ್ (ಪರಿಸ್ಥಿತಿಗಳು, ಸ್ಥಳ ಹುಡುಕಾಟ, ಹತ್ತಿರದ ಕೇಂದ್ರಗಳು, ಎಚ್ಚರಿಕೆಗಳು ಮತ್ತು ರಾಷ್ಟ್ರೀಯ ಚಿತ್ರಣಕ್ಕೆ ಸಾಧನಗಳು; ಜೊತೆಗೆ ಸಂಪನ್ಮೂಲಗಳು ಮತ್ತು ಪ್ರಾಂಪ್ಟ್‌ಗಳು). {llms} ನಲ್ಲಿ ಪಟ್ಟಿಮಾಡಲಾಗಿದೆ.",
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
    kn: "ಚಿಕಿತ್ಸಾಲಯ, ಶಾಲೆ ಅಥವಾ ಲಾಬಿಗೆ ಸ್ವಯಂ-ರಿಫ್ರೆಶ್ ಆಗುವ ಗೋಡೆ ಪ್ರದರ್ಶನ ಅಥವಾ ಕಿಒಸ್ಕ್, {display} ನಲ್ಲಿ ಹೊಂದಿಸಲಾಗಿದೆ.",
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
  "mugilu: air, heat, rain and warnings over any point in India": {
    hi: "mugilu: भारत में किसी भी बिंदु पर वायु, गर्मी, बारिश और चेतावनियाँ",
    kn: "mugilu: ಭಾರತದಲ್ಲಿ ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲೆ ವಾಯು, ಬಿಸಿಲು, ಮಳೆ ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳು",
  },
  "mugilu: the open sky of India. Air, heat, rain, UV, dust and the official warning over any point, the single worst hazard named for you.":
    {
      hi: "mugilu: भारत का खुला आकाश। किसी भी बिंदु पर वायु, गर्मी, बारिश, UV, धूल और आधिकारिक चेतावनी, आपके लिए नामित सबसे बुरा खतरा।",
      kn: "mugilu: ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ. ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲಿನ ವಾಯು, ಬಿಸಿಲು, ಮಳೆ, UV, ಧೂಳು ಮತ್ತು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ, ನಿಮಗಾಗಿ ಹೆಸರಿಸಲಾದ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯ.",
    },
  "About mugilu: the open sky of India": {
    hi: "mugilu के बारे में: भारत का खुला आकाश",
    kn: "mugilu ಬಗ್ಗೆ: ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ",
  },
  "mugilu shows the air, heat, rain, sun, dust and official warnings over any point in India right now, and names the single worst hazard for you. About the project, its open data sources, and how to build on it.":
    {
      hi: "mugilu अभी भारत में किसी भी बिंदु पर वायु, गर्मी, बारिश, सूरज, धूल और आधिकारिक चेतावनियाँ दिखाता है, और आपके लिए सबसे बुरे खतरे को नाम देता है। परियोजना, इसके खुले डेटा स्रोतों, और इस पर कैसे निर्माण करें, इसके बारे में।",
      kn: "mugilu ಈಗ ಭಾರತದ ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲಿನ ವಾಯು, ಬಿಸಿಲు, ಮಳೆ, ಸೂರ್ಯ, ಧೂಳು ಮತ್ತು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳನ್ನು ತೋರಿಸುತ್ತದೆ, ಮತ್ತು ನಿಮಗೆ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯವನ್ನು ಹೆಸರಿಸುತ್ತದೆ. ಯೋಜನೆ, ಅದರ ಮುಕ್ತ ದತ್ತಾಂಶ ಮೂಲಗಳು ಮತ್ತು ಅದರ ಮೇಲೆ ಹೇಗೆ ನಿರ್ಮಿಸುವುದು ಎಂಬುದರ ಬಗ್ಗೆ.",
    },
  "How mugilu works: the Ambient read explained": {
    hi: "mugilu कैसे काम करता है: Ambient रीडिंग की व्याख्या",
    kn: "mugilu ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ: Ambient ಓದುವಿಕೆಯ ವಿವರಣೆ",
  },
  "How mugilu's Ambient read is computed: the public, auditable thresholds for air, heat, cold, wind, fog, smoke, UV and dust, and how the persona weighting works.":
    {
      hi: "mugilu की Ambient रीडिंग की गणना कैसे होती है: वायु, गर्मी, सर्दी, हवा, कोहरा, धुआं, UV और धूल के लिए सार्वजनिक, जाँचने-योग्य सीमाएँ, और प्रोफ़ाइल भार कैसे काम करता है।",
      kn: "mugilu ನ Ambient ಓದುವಿಕೆಯನ್ನು ಹೇಗೆ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ: ವಾಯು, ಬಿಸಿಲు, ಶೀತ, ಗಾಳಿ, ಮಂಜು, ಹೊಗೆ, UV ಮತ್ತು ಧೂಳಿಗೆ ಸಾರ್ವಜನಿಕ, ಪರಿಶೀಲಿಸಬಹುದಾದ ಮಿತಿಗಳು, ಮತ್ತು ಪ್ರೊಫೈಲ್ ತೂಕ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ.",
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
  "air, heat, rain and warnings right now": {
    hi: "वायु, गर्मी, बारिश और चेतावनियाँ अभी",
    kn: "ವಾಯು, ಬಿಸಿಲు, ಮಳೆ ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳు ಈಗ",
  },
  // /c conditions <meta description> framing (place name is prepended, stays verbatim).
  "Air, heat, rain, UV, dust, smoke and any official warning over this spot, with the single worst hazard named for you.":
    {
      hi: "इस स्थान पर वायु, गर्मी, बारिश, UV, धूल, धुआं और कोई भी आधिकारिक चेतावनी, आपके लिए नामित सबसे बुरे खतरे के साथ।",
      kn: "ಈ ಸ್ಥಳದ ಮೇಲಿನ ವಾಯು, ಬಿಸಿಲು, ಮಳೆ, UV, ಧೂಳು, ಹೊಗೆ ಮತ್ತು ಯಾವುದೇ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ, ನಿಮಗಾಗಿ ಹೆಸರಿಸಲಾದ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯದೊಂದಿಗೆ.",
    },
  "A serious warning is active. Follow official guidance.": {
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
      hi: "अपने ऐप (संचयी, डोमेन-स्तर) की पहचान करने के लिए किसी भी API या एम्बेड URL में पैरामीटर ref=your-app जोड़ें। यह सब निःशुल्क है और इसमें किसी कुंजी की आवश्यकता नहीं है।",
      kn: "ನಿಮ್ಮ ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ಗುರುತಿಸಲು ಯಾವುದೇ API ಅಥವಾ ಎಂಬೆಡ್ URLಗೆ ref=your-app ಪ್ಯಾರಾಮೀಟರ್ ಅನ್ನು ಸೇರಿಸಿ (ಸರಾಸರಿ, ಡೊಮೇನ್-ಮಟ್ಟ). ಇದು ಎಲ್ಲಾ ಉಚಿತವಾಗಿದೆ ಮತ್ತು ಯಾವುದೇ ಕೀಲಿಯ ಅಗತ್ಯವಿಲ್ಲ.",
    },
  Air: {
    hi: "वायु",
    kn: "ವಾಯುಗುಣ",
  },
  "Air from CPCB, Airnet (CSTEP), Aurassure and Google AirView+ via the Open Air Quality (OAQ) broker; weather, heat, UV and dust from Open-Meteo; official warnings from NDMA and IMD via SACHET; fire smoke from NASA FIRMS; place search from OpenStreetMap and GeoNames, and boundaries from bharatlas; years of life lost from the AQLI method. Each source keeps its own licence, and mugilu credits all of them.":
    {
      hi: "वायु गुणवत्ता डेटा CPCB, Airnet (CSTEP), Aurassure और Google AirView+ से Open Air Quality (OAQ) ब्रोकर के माध्यम से आता है; मौसम, गर्मी, UV और धूल का डेटा Open-Meteo से आता है; आधिकारिक चेतावनियाँ NDMA और IMD से SACHET के माध्यम से आती हैं; आग के धुएं का डेटा NASA FIRMS से आता है; स्थान खोज OpenStreetMap और GeoNames से, और सीमाएँ bharatlas से आती हैं; जीवन के खोए वर्ष AQLI विधि से आते हैं। प्रत्येक स्रोत का अपना लाइसेंस होता है, और mugilu उन सभी को श्रेय देता है।",
      kn: "ವಾಯು ಗುಣಮಟ್ಟದ ದತ್ತಾಂಶ CPCB, Airnet (CSTEP), Aurassure ಮತ್ತು Google AirView+‌ನಿಂದ Open Air Quality (OAQ) ಬ್ರೋಕರ್ ಮೂಲಕ ಬರುತ್ತದೆ; ಹವಾಮಾನ, ಬಿಸಿಲು, UV ಮತ್ತು ಧೂಳಿನ ದತ್ತಾಂಶ Open-Meteoಯಿಂದ ಬರುತ್ತದೆ; ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು NDMA ಮತ್ತು IMDಯಿಂದ SACHET ಮೂಲಕ ಬರುತ್ತವೆ; ಬೆಂಕಿಯ ಹೊಗೆಯ ದತ್ತಾಂಶ NASA FIRMSನಿಂದ ಬರುತ್ತದೆ; ಸ್ಥಳ ಹುಡುಕಾಟ OpenStreetMap ಮತ್ತು GeoNamesನಿಂದ, ಗಡಿಗಳು bharatlasನಿಂದ ಬರುತ್ತವೆ; ಕಳೆದುಹೋದ ಜೀವನದ ವರ್ಷಗಳು AQLI ವಿಧಾನದಿಂದ ಬರುತ್ತವೆ. ಪ್ರತಿಯೊಂದು ಮೂಲವೂ ತನ್ನದೇ ಆದ ಪರವಾನಗಿಯನ್ನು ಹೊಂದಿರುತ್ತದೆ ಮತ್ತು mugilu ಅವರೆಲ್ಲರಿಗೂ ಮನ್ನಣೆ ನೀಡುತ್ತದೆ.",
    },
  "Air is dangerous. Stay indoors if you can.": {
    hi: "वायु गुणवत्ता खतरनाक है। यदि आप कर सकते हैं तो घर के अंदर रहें।",
    kn: "ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಅಪಾಯಕಾರಿಯಾಗಿದೆ. ಸಾಧ್ಯವಾದರೆ ಮನೆಯೊಳಗೆ ಇರಿ.",
  },
  "Air is poor. Sensitive groups, take it easy.": {
    hi: "वायु गुणवत्ता खराब है। संवेदनशील समूहों के लोगों को शारीरिक गतिविधि कम करनी चाहिए।",
    kn: "ಗಾಳಿಯ ಗುಣಮಟ್ಟ ಕೆಟ್ಟದಾಗಿದೆ. ಸೂಕ್ಷ್ಮ ಗುಂಪುಗಳಲ್ಲಿರುವ ಜನರು ದೈಹಿಕ ಚಟುವಟಿಕೆಯನ್ನು ಕಡಿಮೆ ಮಾಡಿಕೊಳ್ಳಬೇಕು.",
  },
  "Air is so-so, fine for most people.": {
    hi: "हवा मध्यम है, अधिकांश लोगों के लिए ठीक है।",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ ಸ್ವಲ್ಪ ಮಟ್ಟಿಗೆ ಉತ್ತಮವಾಗಿದೆ, ಹೆಚ್ಚಿನ ಜನರಿಗೆ ಸರಿ.",
  },
  "Air refreshes hourly, the national heat, rain, UV and dust grid every few hours, and official warnings hourly. Every reading is timestamped with how long ago it was measured.":
    {
      hi: "वायु-गुणवत्ता डेटा हर घंटे, राष्ट्रीय ताप, वर्षा, UV और धूल ग्रिड हर कुछ घंटों में और आधिकारिक चेतावनियाँ हर घंटे अद्यतन होती हैं। प्रत्येक जानकारी का समय-चिह्नित किया जाता है कि इसे कितने समय पहले मापा गया था।",
      kn: "ವಾಯು-ಗುಣಮಟ್ಟದ ದತ್ತಾಂಶ ಪ್ರತಿ ಗಂಟೆಗೆ ನವೀಕರಿಸಲಾಗುತ್ತದೆ, ರಾಷ್ಟ್ರೀಯ ಬಿಸಿಲು, ಮಳೆ, UV ಮತ್ತು ಧೂಳಿನ ಗ್ರಿಡ್ ಪ್ರತಿ ಕೆಲವು ಗಂಟೆಗಳಿಗೊಮ್ಮೆ ಮತ್ತು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು ಪ್ರತಿ ಗಂಟೆಗೆ. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯ ತುಣುಕಿಗೂ ಅದನ್ನು ಅಳೆಯಲಾದ ಸಮಯದೊಂದಿಗೆ ಸಮಯಮುದ್ರೆ ಮಾಡಲಾಗಿರುತ್ತದೆ.",
    },
  "All clear": {
    hi: "सब कुछ ठीक है",
    kn: "ಎಲ್ಲವೂ ಸರಿ",
  },
  "An official advisory is in effect.": {
    hi: "एक आधिकारिक परामर्श लागू है।",
    kn: "ಅಧಿಕೃತ ಸಲಹೆ ಜಾರಿಯಲ್ಲಿದೆ.",
  },
  "An official warning is active. Stay alert.": {
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
  "Asthma and lungs": {
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
  "Cold conditions. Cover up and limit time outside.": {
    hi: "ठंडी परिस्थितियाँ। बाहर समय सीमित करें और ढक कर रखें।",
    kn: "ಶೀತಲ ಪರಿಸ್ಥಿತಿಗಳು. ಹೊರಾಂಗಣದಲ್ಲಿ ಕಳೆಯುವ ಸಮಯವನ್ನು ಮಿತಿಗೊಳಿಸಿ ಮತ್ತು ಮುಚ್ಚಿಕೊಳ್ಳಿ.",
  },
  "Common questions": {
    hi: "सामान्य प्रश्न",
    kn: "ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳು",
  },
  "Conditions are good right now.": {
    hi: "अभी परिस्थितियाँ अच्छी हैं।",
    kn: "ಈಗ ಪರಿಸ್ಥಿತಿಗಳು ಉತ್ತಮವಾಗಿವೆ.",
  },
  'Couldn\'t find "X". Try a city or place name.': {
    hi: "वह स्थान नहीं मिला। किसी शहर या स्थान का नाम आज़माएं।",
    kn: "ಆ ಸ್ಥಳವನ್ನು ಕಂಡುಹಿಡಿಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಒಂದು ನಗರ ಅಥವಾ ಸ್ಥಳದ ಹೆಸರನ್ನು ಪ್ರಯತ್ನಿಸಿ.",
  },
  "Damaging winds. Stay indoors, away from trees and hoardings.": {
    hi: "हानिकारक हवाएँ। घर के अंदर रहें, पेड़ों और होर्डिंगों से दूर रहें।",
    kn: "ಹಾನಿಕಾರಕ ಗಾಳಿ. ಮನೆಯೊಳಗೆ ಇರಿ, ಮರಗಳು ಮತ್ತು ಜಾಹೀರಾತು ಫಲಕಗಳಿಂದ ದೂರವಿರಿ.",
  },
  "Dangerous cold. Stay warm indoors if you can.": {
    hi: "खतरनाक ठंड। यदि आप कर सकते हैं तो घर के अंदर रहें।",
    kn: "ಅಪಾಯಕಾರಿ ಶೀತ. ಸಾಧ್ಯವಾದರೆ ಒಳಾಂಗಣದಲ್ಲಿ ಬೆಚ್ಚಗಿರಿ.",
  },
  "Dense fog. Slow down, use low beams, allow extra time.": {
    hi: "घना कोहरा। धीमा हो जाइए, कम बीम का प्रयोग कीजिए, अतिरिक्त समय दीजिए।",
    kn: "ದಟ್ಟವಾದ ಮಂಜು. ನಿಧಾನವಾಗಿ ಚಾಲನೆ ಮಾಡಿ, ಕಡಿಮೆ ಕಿರಣಗಳನ್ನು ಬಳಸಿ, ಹೆಚ್ಚುವರಿ ಸಮಯ ನೀಡಿ.",
  },
  Display: {
    hi: "प्रदर्शन",
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
  "Dusty. Mask up if you're sensitive.": {
    hi: "हवा धूल भरी है। यदि आप संवेदनशील हैं तो मास्क धारण करें।",
    kn: "ಗಾಳಿಯಲ್ಲಿ ಧೂಳು ತುಂಬಿದೆ. ನಿಮಗೆ ಅಲರ್ಜಿ ಇದ್ದರೆ ಮಾಸ್ಕ್ ಧರಿಸಿ.",
  },
  "Embed it": {
    hi: "इसे एम्बेड करें",
    kn: "ಅದನ್ನು ಅಳವಡಿಸಿ",
  },
  Everyone: {
    hi: "सभी",
    kn: "ಎಲ್ಲರೂ",
  },
  "Extreme sun. Cover up and skip the midday hours.": {
    hi: "सूर्य बहुत तेज है। अपनी त्वचा को कपड़ों से ढकें और दोपहर के समय बाहर जाने से बचें।",
    kn: "ಸೂರ್ಯನು ಅತ್ಯಂತ ಪ್ರಬಲನಾಗಿರುತ್ತಾನೆ. ನಿಮ್ಮ ಚರ್ಮವನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ ಮತ್ತು ಮಧ್ಯಾಹ್ನ ಹೊರಗೆ ಹೋಗುವುದನ್ನು ತಪ್ಪಿಸಿ.",
  },
  Fine: {
    hi: "संतोषजनक",
    kn: "ತೃಪ್ತಿಕರ",
  },
  "Fires burning nearby. Sensitive groups, watch the air.": {
    hi: "पास में आग लगी हुई है। संवेदनशील लोगों को वायु गुणवत्ता देखनी चाहिए।",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ಬೆಂಕಿ ಹೊತ್ತಿಕೊಂಡಿದೆ. ಸೂಕ್ಷ್ಮ ವ್ಯಕ್ತಿಗಳು ವಾಯು ಗುಣಮಟ್ಟವನ್ನು ಗಮನಿಸಬೇಕು.",
  },
  "For AI agents": {
    hi: "AI एजेंट्स के लिए",
    kn: "AI ಏಜೆಂಟ್‌ಗಳಿಗೆ",
  },
  "For an always-on unattended screen, point a kiosk-browser app at the same link so it auto-starts.": {
    hi: "हमेशा चालू रहने वाली, बिना निगरानी वाली स्क्रीन के लिए, किसी कियोस्क-ब्राउज़र ऐप (उदाहरण के लिए Android पर Fully Kiosk) को उसी लिंक पर सेट करें ताकि यह अपने आप शुरू हो जाए।",
    kn: "ಸದಾ-ಆನ್, ಮೇಲ್ವಿಚಾರಣೆಯಿಲ್ಲದ ಸ್ಕ್ರೀನ್‌ಗೆ, ಅದೇ ಕೊಂಡಿಗೆ ಕಿಒಸ್ಕ್-ಬ್ರೌಸರ್ ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ಹೊಂದಿಸಿ, ಆದ್ದರಿಂದ ಅದು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.",
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
      hi: "कई वर्षों से भारत भर के लोग एक-एक करके आसमान को पढ़ने योग्य बना रहे हैंः एक शहर की वायु गुणवत्ता का मानचित्र, एक गर्मी की लहर के बारे में एक लेख, पिछले वर्ष के मानसून का एक चार्ट। शानदार काम है, लेकिन बिखरा हुआ है और अगले सत्र में आसानी से खो सकता है।",
      kn: "ಹಲವು ವರ್ಷಗಳಿಂದ, ಭಾರತದಾದ್ಯಂತ ಜನರು ಆಕಾಶವನ್ನು ಒಂದು ಸಮಯದಲ್ಲಿ ಒಂದು ತುಣುಕಾಗಿ ಓದಬಲ್ಲಂತೆ ಮಾಡುತ್ತಿದ್ದಾರೆ: ಒಂದು ನಗರದ ಗಾಳಿಯ ನಕ್ಷೆ, ಬಿಸಿಲಿನ ಅಲೆಗಳ ಬಗ್ಗೆ ಒಂದು ಲೇಖನ, ಕಳೆದ ವರ್ಷದ ಮಳೆಯ ನಕ್ಷೆ. ಅತ್ಯುತ್ತಮ ಕೆಲಸ, ಆದರೆ ಮುಂದಿನ ಋತುವಿನಲ್ಲಿ ಹರಡಿ ಹೋಗಿ, ಸುಲಭವಾಗಿ ಕಳೆದುಹೋಗುತ್ತದೆ.",
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
  "Heat is high. Slow down, hydrate, find shade.": {
    hi: "गर्मी अधिक है। धीमे हो जाइए, पानी पिएँ, छाया ढूँढ़ लीजिए।",
    kn: "ಬಿಸಿಲು ಹೆಚ್ಚಾಗಿದೆ. ನಿಧಾನವಾಗಿ ಹೋಗಿ, ನೀರು ಕುಡಿಯಿರಿ, ನೆರಳು ಹುಡುಕಿ.",
  },
  "Heavy burning nearby. Keep windows shut, limit time outdoors.": {
    hi: "पास में भारी आग लगी हुई है। खिड़कियाँ बंद रखें और बाहर कम समय बिताएँ।",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ಭಾರೀ ಬೆಂಕಿ ಹೊತ್ತಿಕೊಂಡಿದೆ. ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  "Heavy dust. Limit time outdoors.": {
    hi: "हवा में बहुत धूल है। बाहर कम समय बिताएँ।",
    kn: "ಗಾಳಿಯಲ್ಲಿ ಧೂಳು ತುಂಬಿದೆ. ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  High: {
    hi: "उच्च",
    kn: "ಉನ್ನತ ಮಟ್ಟದ",
  },
  Hottest: {
    hi: "सबसे गर्म स्थान",
    kn: "ಅತ್ಯಂತ ಬಿಸಿಲು",
  },
  "How current are the readings?": {
    hi: "सूचना कितनी हाल की है?",
    kn: "ಮಾಹಿತಿ ಎಷ್ಟು ಇತ್ತೀಚಿನದು?",
  },
  "How it runs": {
    hi: "इसका संचालन कैसे होता है",
    kn: "ಅದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ",
  },
  "Informational and educational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings, consult NDMA and IMD directly.":
    {
      hi: "जानकारी और शिक्षा के लिए, न कि चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए। आधिकारिक खतरे की चेतावनियों के लिए, NDMA और IMD से सीधे परामर्श करें।",
      kn: "ಮಾಹಿತಿ ಮತ್ತು ಶಿಕ್ಷಣಕ್ಕಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಅಧಿಕೃತ ಅಪಾಯದ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, ಎನ್.ಡಿ.ಎಂ.ಎ ಮತ್ತು ಐ.ಎಂ.ಡಿ.ಯನ್ನು ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ.",
    },
  "Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD.":
    {
      hi: "जानकारी के लिए, न कि चिकित्सा, आपातकालीन या सुरक्षा-महत्वपूर्ण निर्णयों के लिए। आधिकारिक खतरे की चेतावनियों के लिए, NDMA और IMD से परामर्श करें।",
      kn: "ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ, ತುರ್ತು ಅಥವಾ ಸುರಕ್ಷತಾ-ನಿರ್ಣಾಯಕ ನಿರ್ಧಾರಗಳಿಗೆ ಅಲ್ಲ. ಅಧಿಕೃತ ಅಪಾಯದ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, ಎನ್.ಡಿ.ಎಂ.ಎ ಮತ್ತು ಐ.ಎಂ.ಡಿ.ಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    },
  "Intense fires nearby. Treat the air as hazardous; stay indoors.": {
    hi: "पास में तीव्र आग। हवा को खतरनाक समझें और घर के अंदर रहें।",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ತೀವ್ರವಾದ ಬೆಂಕಿ ಕಾಣಿಸಿಕೊಂಡಿದೆ. ಗಾಳಿಯನ್ನು ಅಪಾಯಕಾರಿ ಎಂದು ಪರಿಗಣಿಸಿ, ಒಳಾಂಗಣದಲ್ಲಿರಿ.",
  },
  "Is it safe to go outside right now?": {
    hi: "क्या अभी बाहर जाना सुरक्षित है?",
    kn: "ಹೊರಗೆ ಹೋಗುವುದು ಈಗ ಸುರಕ್ಷಿತವೇ?",
  },
  "Is mugilu free?": {
    hi: "क्या mugilu निःशुल्क है?",
    kn: "mugilu ಉಚಿತವೇ?",
  },
  "It's cold out. Layer up.": {
    hi: "बाहर ठण्ड है। गर्म कपड़ों की परतें पहनें।",
    kn: "ಹೊರಗೆ ಚಳಿ ಇದೆ. ಬೆಚ್ಚಗಿನ ಬಟ್ಟೆಗಳ ಪದರಗಳನ್ನು ಧರಿಸಿ.",
  },
  "It's warm, so keep water handy.": {
    hi: "गर्मी है, इसलिए पानी अपने पास रखें।",
    kn: "ಇದು ಬೆಚ್ಚಗಿರುತ್ತದೆ, ಆದ್ದರಿಂದ ನೀರನ್ನು ಸುಲಭವಾಗಿ ಸಿಗುವಂತೆ ಇಟ್ಟುಕೊಳ್ಳಿ.",
  },
  "It's windy. Secure loose items.": {
    hi: "हवा चल रही है। ढीले सामान को नीचे बांध दें ताकि वे उड़ न जाएं।",
    kn: "ಗಾಳಿ ಜೋರಾಗಿದೆ. ಸಡಿಲವಾದ ವಸ್ತುಗಳನ್ನು ಕಟ್ಟಿಕೊಳ್ಳಿ, ಆಗ ಅವು ಬೀಸಿ ಹೋಗುವುದಿಲ್ಲ.",
  },
  "Leave it. It refreshes on its own, keeps the screen awake, and if the network blips it holds the last reading and recovers.":
    {
      hi: "छोड़ दीजिए। यह अपने आप रिफ्रेश होता है, स्क्रीन को चालू रखता है, और यदि नेटवर्क कुछ देर के लिए बंद हो जाए तो आखिरी रीडिंग दिखाता रहता है और फिर से जुड़ जाता है।",
      kn: "ಅದನ್ನು ಬಿಡಿ. ಇದು ತನ್ನಷ್ಟಕ್ಕೆ ತಾನೇ ರಿಫ್ರೆಶ್ ಆಗುತ್ತದೆ, ಸ್ಕ್ರೀನ್ ಅನ್ನು ಆನ್ ಮಾಡುತ್ತದೆ ಮತ್ತು ನೆಟ್ವರ್ಕ್ ಸ್ವಲ್ಪ ಸಮಯದವರೆಗೆ ಸ್ಥಗಿತಗೊಂಡರೆ ಅದು ಕೊನೆಯ ಓದುವಿಕೆಯನ್ನು ತೋರಿಸಿ ಮತ್ತೆ ಸಂಪರ್ಕಗೊಳ್ಳುತ್ತದೆ.",
    },
  "Look up another place": {
    hi: "कोई और जगह देखें",
    kn: "ಬೇರೆಡೆಗೆ ಹೋಗಿ ನೋಡಿ.",
  },
  Low: {
    hi: "कम",
    kn: "ಕೆಳಮಟ್ಟದ",
  },
  Moderate: {
    hi: "मध्यम",
    kn: "ಮಧ್ಯಮ",
  },
  "No active national alerts right now.": {
    hi: "अभी कोई सक्रिय राष्ट्रीय चेतावनी नहीं है।",
    kn: "ಪ್ರಸ್ತುತ ಯಾವುದೇ ಸಕ್ರಿಯ ರಾಷ್ಟ್ರೀಯ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ.",
  },
  "Not a map.": {
    hi: "यह कोई मानचित्र नहीं है।",
    kn: "ಇದು ನಕ್ಷೆಯಲ್ಲ.",
  },
  "Not here.": {
    hi: "यह पृष्ठ नहीं मिला",
    kn: "ಈ ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ.",
  },
  "Older adults": {
    hi: "वृद्ध",
    kn: "ವೃದ್ಧರು",
  },
  "Open display": {
    hi: "प्रदर्शन खोलें",
    kn: "ಪ್ರದರ್ಶನವನ್ನು ತೆರೆಯಿರಿ.",
  },
  "Open the display link in the screen's browser: a smart TV, a cheap streaming stick, or an old tablet in a stand.": {
    hi: "स्क्रीन के वेब ब्राउज़र में प्रदर्शन लिंक खोलें: एक स्मार्ट टीवी, एक सस्ती स्ट्रीमिंग स्टिक, या स्टैंड में एक पुराना टैबलेट।",
    kn: "ಸ್ಕ್ರೀನ್‌ನ ವೆಬ್ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಪ್ರದರ್ಶನ ಕೊಂಡಿಯನ್ನು ತೆರೆಯಿರಿ: ಸ್ಮಾರ್ಟ್ ಟಿವಿ, ಅಗ್ಗದ ಸ್ಟ್ರೀಮಿಂಗ್ ಸ್ಟಿಕ್ ಅಥವಾ ಸ್ಟ್ಯಾಂಡ್‌ನಲ್ಲಿರುವ ಹಳೆಯ ಟ್ಯಾಬ್ಲೆಟ್.",
  },
  "Outdoor workers": {
    hi: "बाहर काम करने वाले",
    kn: "ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು",
  },
  "Patchy low visibility. Drive with care.": {
    hi: "धुंधली दृश्यता। सावधानी से चलाइए।",
    kn: "ಮಬ್ಬಾದ ಕಡಿಮೆ ಗೋಚರತೆ. ಎಚ್ಚರಿಕೆಯಿಂದ ನಡೆಸಿ.",
  },
  "Pick a place": {
    hi: "कोई जगह चुनें",
    kn: "ಒಂದು ಸ್ಥಳವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ.",
  },
  Poor: {
    hi: "खराब",
    kn: "ಕೆಟ್ಟ",
  },
  "Popular:": {
    hi: "प्रसिद्ध स्थान:",
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
    kn: "ಅದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಹಾಕಿ.",
  },
  Rain: {
    hi: "बारिश",
    kn: "ಮಳೆ",
  },
  "Right now in India": {
    hi: "अभी पूरे भारत में",
    kn: "ಈಗ ಭಾರತದಾದ್ಯಂತ",
  },
  "Sathya Sankaran wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.":
    {
      hi: "Sathya Sankaran हर बार शुरुआत से ही शुरू करना बंद करना चाहते थे: पूरे आकाश को एक दृष्टिकोण में लाना, भारत में किसी भी बिंदु पर हर खतरे को एक साथ लाना, और फिर इसे बुनियादी ढांचे के रूप में देना, ताकि अगले मानचित्र, कहानी या चेतावनी को कुछ भी नहीं से शुरू करना न पड़े।",
      kn: "Sathya Sankaran ಪ್ರತಿ ಬಾರಿಯೂ ಮೊದಲಿನಿಂದ ಪ್ರಾರಂಭಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಲು ಬಯಸಿದ್ದರು: ಭಾರತದ ಯಾವುದೇ ಬಿಂದುವಿನ ಮೇಲೆ ಪ್ರತಿಯೊಂದು ಅಪಾಯವನ್ನು ಒಟ್ಟುಗೂಡಿಸಿ, ನಂತರ ಅದನ್ನು ಮೂಲಸೌಕರ್ಯವಾಗಿ ಹಸ್ತಾಂತರಿಸುವುದು, ಆದ್ದರಿಂದ ಮುಂದಿನ ನಕ್ಷೆ, ಕಥೆ ಅಥವಾ ಎಚ್ಚರಿಕೆಯು ಏನೂ ಇಲ್ಲದಿರುವಲ್ಲಿಂದ ಪ್ರಾರಂಭಿಸಬೇಕಾಗಿಲ್ಲ.",
    },
  Severe: {
    hi: "गंभीर",
    kn: "ತೀವ್ರ",
  },
  Smoke: {
    hi: "धुआं",
    kn: "ಹೊಗೆ",
  },
  "Some dust in the air.": {
    hi: "हवा में थोड़ी धूल।",
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
  "Strong sun, a hat or sunscreen helps.": {
    hi: "तेज धूप में टोपी या सनस्क्रीन पहनने से मदद मिलती है।",
    kn: "ಬಿಸಿಲು, ಟೋಪಿ ಅಥವಾ ಸನ್‌ಸ್ಕ್ರೀನ್‌ ಸಹಾಯ ಮಾಡುತ್ತದೆ.",
  },
  "Strong winds. Take care outdoors, expect blowing dust.": {
    hi: "तेज हवाएँ चल रही हैं। बाहर सावधान रहें, और धूल उड़ती रहने की उम्मीद रखें।",
    kn: "ಬಲವಾದ ಗಾಳಿ ಬೀಸುತ್ತಿದೆ. ಹೊರಗೆ ಜಾಗರೂಕರಾಗಿರಿ, ಮತ್ತು ಧೂಳು ಬೀಸುತ್ತಿರುವುದನ್ನು ನಿರೀಕ್ಷಿಸಿ.",
  },
  Sun: {
    hi: "सूर्य",
    kn: "ಸೂರ್ಯ",
  },
  "Take some care outdoors.": {
    hi: "बाहर थोड़ी सावधानी रखें।",
    kn: "ಹೊರಗೆ ಸ್ವಲ್ಪ ಜಾಗರೂಕತೆಯಿಂದಿರಿ.",
  },
  "That is mugilu.": {
    hi: "यही है mugilu।",
    kn: "ಅದೇ mugilu.",
  },
  "That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate.": {
    hi: "उस पृष्ठ का mugilu पर अस्तित्व नहीं है। इसके बजाय किसी जगह को देखें या निर्देशांक दें।",
    kn: "ಆ ಪುಟ ಇಲ್ಲಿ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ. ಬದಲಿಗೆ, ಒಂದು ಸ್ಥಳವನ್ನು ಹುಡುಕಿ ಅಥವಾ ನಿರ್ದೇಶಾಂಕವನ್ನು ನೀಡಿ.",
  },
  "The open sky of India, one coordinate at a time.": {
    hi: "भारत का खुला आकाश, एक बार में एक निर्देशांक।",
    kn: "ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ, ನಿರ್ದೇಶಾಂಕ ಒಂದೊಂದಾಗಿ.",
  },
  "The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is non-commercial, for good, the third in a small set of public tools alongside bharatlas and mdshare.":
    {
      hi: "आपके ऊपर का आकाश एक साझा सार्वजनिक क्षेत्र है। यह जानकर कि इसे खरीदने के लिए पैसे खर्च करने या किसी के ऐप के अंदर बंद रहने की आवश्यकता नहीं है। mugilu गैर-वाणिज्यिक है, जो सार्वजनिक हित के लिए बनाया गया है, bharatlas और mdshare के साथ सार्वजनिक उपकरणों के एक छोटे समूह में तीसरा है।",
      kn: "ನಿಮ್ಮ ಮೇಲಿರುವ ಆಕಾಶವು ಒಂದು ಹಂಚಿಕೆಯ ಸಾಮಾನ್ಯ ಸ್ಥಳವಾಗಿದೆ. ಇದು ಹಣ ವೆಚ್ಚವಾಗಬಾರದು ಅಥವಾ ಯಾರೊಬ್ಬರ ಆ್ಯಪ್‌ನೊಳಗೆ ಲಾಕ್ ಆಗಬಾರದು ಎಂದು ತಿಳಿದಿದೆ. mugilu ವಾಣಿಜ್ಯೇತರವಾಗಿದ್ದು, ಸಾರ್ವಜನಿಕ ಹಿತಕ್ಕಾಗಿ ತಯಾರಿಸಲ್ಪಟ್ಟಿದೆ, bharatlas ಮತ್ತು mdshare ಜೊತೆಗೆ ಸಾರ್ವಜನಿಕ ಸಾಧನಗಳ ಸಣ್ಣ ಸಮೂಹದಲ್ಲಿ ಮೂರನೆಯದಾಗಿದೆ.",
    },
  "The sun is very strong. Limit midday hours.": {
    hi: "सूर्य बहुत तेज है। दोपहर के समय बाहर कम समय बिताएं।",
    kn: "ಸೂರ್ಯ ಬಹಳ ಪ್ರಬಲನಾಗಿರುತ್ತಾನೆ. ಮಧ್ಯಾಹ್ನದ ಸಮಯದಲ್ಲಿ ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  "Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.":
    {
      hi: "किसी भी डिस्प्ले को आकाश की लाइव, स्व-अपडेटिंग रीडिंग में बदलें। कोई जगह चुनें, उसे स्क्रीन पर खोलें, फुल-स्क्रीन दबाएं। यह खुद को रिफ्रेश करता है और एक कोने का QR कोड राहगीरों को उनके फोन पर उसी जगह पर भेजता है।",
      kn: "ಯಾವುದೇ ಡಿಸ್ಪ್ಲೇಯನ್ನು ಆಕಾಶದ ಲೈವ್, ಸ್ವಯಂ-ಅಪ್‌ಡೇಟ್ ಆಗುವ ಓದುವಿಕೆಯಾಗಿ ಪರಿವರ್ತಿಸಿ. ಒಂದು ಸ್ಥಳವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ, ಅದನ್ನು ಸ್ಕ್ರೀನ್ ಮೇಲೆ ತೆರೆಯಿರಿ, ಫುಲ್-ಸ್ಕ್ರೀನ್ ಒತ್ತಿರಿ. ಇದು ತನ್ನನ್ನು ತಾನು ರಿಫ್ರೆಶ್ ಮಾಡಿಕೊಳ್ಳುತ್ತದೆ, ಮತ್ತು ಒಂದು ಮೂಲೆಯ ಕ್ಯೂ.ಆರ್. ಕೋಡ್‌ನಿಂದ ಹಾದುಹೋಗುವವರಿಗೆ ಅವರ ಫೋನಿನಲ್ಲಿ ಅದೇ ಸ್ಥಳಕ್ಕೆ ಕಳುಹಿಸುತ್ತದೆ.",
    },
  "Type a place. See what the sky is doing to you right now: air, heat (and how survivable it really is), rain, sun and dust, alongside any official warning over that spot. Then one plain line, the single worst thing for you, whether you have asthma, work outdoors, or are minding a child or an older parent. No sign-up, no jargon.":
    {
      hi: "स्थान लिख दीजिए। देखिए कि आसमान इस समय आपके साथ क्या कर रहा है: वायु गुणवत्ता, गर्मी (और यह वास्तव में कितनी सहने योग्य है), बारिश, सूरज और धूल, साथ ही उस स्थान के बारे में कोई आधिकारिक चेतावनी। फिर एक सरल पंक्ति, जो आपके लिए सबसे खराब है, चाहे आपको दमा हो, बाहर काम करते हों या किसी बच्चे या बुज़ुर्ग माता-पिता की देखभाल कर रहे हों। कोई साइन-अप नहीं, और कोई तकनीकी शब्दावली नहीं।",
      kn: "ಸ್ಥಳ ಟೈಪ್ ಮಾಡಿ. ಆಕಾಶವು ಈಗ ನಿಮಗೆ ಏನು ಮಾಡುತ್ತಿದೆ ಎಂಬುದನ್ನು ನೋಡಿ: ವಾಯು ಗುಣಮಟ್ಟ, ಬಿಸಿಲು (ಮತ್ತು ಅದು ನಿಜವಾಗಿಯೂ ಎಷ್ಟು ಬದುಕುಳಿಯಬಲ್ಲದು), ಮಳೆ, ಸೂರ್ಯ ಮತ್ತು ಧೂಳು, ಜೊತೆಗೆ ಆ ಸ್ಥಳದ ಬಗ್ಗೆ ಯಾವುದೇ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ. ನಂತರ ಒಂದು ಸರಳ ರೇಖೆ, ನಿಮಗೆ ಅತ್ಯಂತ ಕೆಟ್ಟದ್ದು, ನೀವು ಆಸ್ತಮಾ ಹೊಂದಿದ್ದರೂ, ಹೊರಾಂಗಣದಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದರೂ ಅಥವಾ ಮಗುವನ್ನು ಅಥವಾ ಹಿರಿಯ ಪೋಷಕರನ್ನು ನೋಡಿಕೊಳ್ಳುತ್ತಿದ್ದರೂ. ನೋಂದಣಿ ಅಗತ್ಯವಿಲ್ಲ, ಯಾವುದೇ ತಾಂತ್ರಿಕ ಶಬ್ದಗಳಿಲ್ಲ.",
    },
  "Type any place in India, in any language": {
    hi: "भारत में किसी भी स्थान का नाम, किसी भी भाषा में लिखें",
    kn: "ಭಾರತದಲ್ಲಿರುವ ಯಾವುದೇ ಸ್ಥಳದ ಹೆಸರನ್ನು, ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ, ಬರೆಯಿರಿ.",
  },
  "UV index": {
    hi: "पराबैंगनी सूचकांक",
    kn: "ನೇರಳಾತೀತ ಸೂಚ್ಯಂಕ",
  },
  "Use my location": {
    hi: "मेरे स्थान का प्रयोग करें",
    kn: "ನನ್ನ ಸ್ಥಳವನ್ನು ಬಳಸಿ.",
  },
  "Very dense fog. Avoid driving if you can.": {
    hi: "बहुत घना कोहरा। यदि आप कर सकते हैं तो गाड़ी न चलाएँ।",
    kn: "ತುಂಬಾ ದಟ್ಟವಾದ ಮಂಜು. ಸಾಧ್ಯವಾದರೆ ವಾಹನ ಚಲಾಯಿಸದಿರಿ.",
  },
  "Very poor": {
    hi: "बहुत खराब",
    kn: "ತುಂಬಾ ಕೆಟ್ಟ",
  },
  Visibility: {
    hi: "दृश्यता",
    kn: "ಗೋಚರತೆ",
  },
  "Weight it for who is nearby": {
    hi: "पास के लोगों के अनुसार पढ़ना तय करें",
    kn: "ಹತ್ತಿರದಲ್ಲಿ ಇರುವ ಜನರ ಗುಂಪಿಗೆ ಓದುವಿಕೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ.",
  },
  "Wet-bulb is the temperature a wet thermometer settles at: it folds heat and humidity into the one number that decides whether your body can still cool itself. Above about 32°C wet-bulb, even resting in shade turns dangerous. Ordinary feels-like numbers hide this, so mugilu surfaces it.":
    {
      hi: "वेट-बल्ब वह तापमान है जिस पर एक गीला थर्मामीटर स्थिर होता हैः यह गर्मी और आर्द्रता को एक संख्या में मिलाता है जो यह तय करता है कि आपका शरीर अभी भी खुद को ठंडा कर सकता है या नहीं। लगभग 32 डिग्री वेट-बल्ब से ऊपर, छाया में भी रहना खतरनाक हो जाता है। सामान्य महसूस-तापमान के आँकड़े इसे छुपाते हैं, इसलिए mugilu इसे दिखाता है।",
      kn: "ಆರ್ದ್ರ-ಬಲ್ಬ್ ಎಂಬುದು ತೇವವಾದ ಥರ್ಮಾಮೀಟರ್ ತಲುಪುವ ತಾಪಮಾನವಾಗಿದೆ: ಇದು ಬಿಸಿಲು ಮತ್ತು ತೇವಾಂಶವನ್ನು ಒಂದೇ ಸಂಖ್ಯೆಯಲ್ಲಿ ಸಂಯೋಜಿಸುತ್ತದೆ, ಇದು ನಿಮ್ಮ ದೇಹವು ಇನ್ನೂ ತನ್ನನ್ನು ತಾನು ತಂಪಾಗಿಸಿಕೊಳ್ಳಬಹುದೇ ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸುತ್ತದೆ. ಸುಮಾರು 32 ಡಿಗ್ರಿ ತೇವ-ಬಲ್ಬ್‌ಗಿಂತ ಹೆಚ್ಚಿನ ತಾಪಮಾನದಲ್ಲಿ, ನೆರಳಿನಲ್ಲಿ ವಿಶ್ರಾಂತಿ ಪಡೆಯುವುದೂ ಸಹ ಅಪಾಯಕಾರಿಯಾಗುತ್ತದೆ. ಸಾಮಾನ್ಯ ಭಾವನೆಗಳು-ತರಹದ ಸಂಖ್ಯೆಗಳು ಇದನ್ನು ಮರೆಮಾಡುತ್ತವೆ, ಆದ್ದರಿಂದ mugilu ಅದನ್ನು ತೋರಿಸುತ್ತಾನೆ.",
    },
  "What is wet-bulb temperature, and why does mugilu show it?": {
    hi: "वेट-बल्ब तापमान क्या है और mugilu इसे क्यों दिखाता है?",
    kn: "ತೇವಾಂಶ-ಬಲ್ಬ್ ತಾಪಮಾನ ಎಂದರೇನು, ಮತ್ತು mugilu ಅದನ್ನು ಏಕೆ ತೋರಿಸುತ್ತದೆ?",
  },
  "What's it like outside, right now?": {
    hi: "बाहर अभी कैसा है?",
    kn: "ಈಗ ಹೊರಗೆ ಹೇಗಿದೆ?",
  },
  "Where does mugilu's data come from?": {
    hi: "mugilu द्वारा उपयोग किया जाने वाला डेटा कहाँ से आता है?",
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
      hi: "हाँ। यह निःशुल्क, मुक्त स्रोत (MIT) और गैर-वाणिज्यिक है, जिसमें कोई साइन-अप नहीं है। प्रत्येक जानकारी JSON, Markdown, एम्बेडेबल कार्ड, OpenAPI स्पेक्स और MCP सर्वर के रूप में भी उपलब्ध है।",
      kn: "ಹೌದು. ಇದು ಉಚಿತ, ಮುಕ್ತ ಮೂಲ (MIT) ಮತ್ತು ವಾಣಿಜ್ಯೇತರವಾಗಿದ್ದು, ಯಾವುದೇ ನೋಂದಣಿಯಿಲ್ಲ. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯು JSON, Markdown, ಎಂಬೆಡ್ ಮಾಡಬಹುದಾದ ಕಾರ್ಡ್, OpenAPI ಸ್ಪೆಕ್ ಮತ್ತು AI ಏಜೆಂಟ್‌ಗಳಿಗಾಗಿ MCP ಸರ್ವರ್ ಆಗಿ ಲಭ್ಯವಿದೆ.",
    },
  "Your places": {
    hi: "आपके सहेजे हुए स्थान",
    kn: "ನಿಮ್ಮ ಸ್ಥಳಗಳು",
  },
  "a digital commons": {
    hi: "डिजिटल कॉमन्स",
    kn: "ಡಿಜಿಟಲ್ ಕಾಮನ್ಸ್",
  },
  about: {
    hi: "परिचय",
    kn: "ಬಗ್ಗೆ",
  },
  air: {
    hi: "वायु",
    kn: "ಗಾಳಿ",
  },
  alert: {
    hi: "चेतावनी",
    kn: "ಎಚ್ಚರಿಕೆ",
  },
  breezy: {
    hi: "हल्की हवा",
    kn: "ಹಗುರ ಗಾಳಿ",
  },
  "build on it": {
    hi: "उस पर निर्माण करें",
    kn: "ಅದರ ಮೇಲೆ ನಿರ್ಮಾಣ ಮಾಡಿ",
  },
  calm: {
    hi: "शांत",
    kn: "ಶಾಂತ",
  },
  caution: {
    hi: "सावधानी",
    kn: "ಎಚ್ಚರಿಕೆ",
  },
  "chance of rain": {
    hi: "बारिश की संभावना",
    kn: "ಮಳೆ ಸಾಧ್ಯತೆ",
  },
  clear: {
    hi: "स्पष्ट",
    kn: "ಗೋಚರತೆ",
  },
  code: {
    hi: "स्रोत कोड",
    kn: "ಸೋರ್ಸ್ ಕೋಡ್",
  },
  cold: {
    hi: "सर्दी",
    kn: "ಶೀತ",
  },
  dangerous: {
    hi: "खतरनाक",
    kn: "ಅಪಾಯಕಾರಿ",
  },
  "dangerous cold": {
    hi: "खतरनाक ठंड",
    kn: "ಘನೀಕರಿಸುವ",
  },
  "dangerous humid heat": {
    hi: "खतरनाक उमस भरी गर्मी",
    kn: "ಅಪಾಯಕಾರವಾದ ಆರ್ದ್ರತೆ ಮತ್ತು ಬಿಸಿಲು",
  },
  "dense fog": {
    hi: "अति घना कोहरा",
    kn: "ದಟ್ಟವಾದ ಮಂಜು",
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
    hi: "अत्यधिक गर्मी",
    kn: "ವಿಪರೀತ ಬಿಸಿಲು",
  },
  feels: {
    hi: "महसूस",
    kn: "ಅನಿಸುತ್ತದೆ",
  },
  "feels like": {
    hi: "जैसा लगता है",
    kn: "ಅನಿಸುತ್ತದೆ",
  },
  fog: {
    hi: "कोहरा",
    kn: "ಮಂಜು",
  },
  gale: {
    hi: "तूफ़ानी हवा",
    kn: "ಬಿರುಗಾಳಿ",
  },
  gusts: {
    hi: "झोंके",
    kn: "ಗಾಳಿಯ ರಭಸ",
  },
  hazy: {
    hi: "धुंधला",
    kn: "ಮಬ್ಬಾದ",
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
    hi: "यह कैसे कार्य करता है",
    kn: "ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ:",
  },
  "just now": {
    hi: "अभी",
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
    hi: "हल्का धुंध",
    kn: "ಮಬ್ಬಾದ",
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
      hi: "mugilu को केवल देखने के बजाय, उस पर निर्माण किया जाना चाहिए। प्रत्येक जानकारी भी खुली और मशीन द्वारा पढ़ी जाने योग्य है, इसलिए आप अपने स्वयं के मानचित्र, कहानी, डैशबोर्ड या चेतावनी के पीछे पूरा आकाश रख सकते हैं, और अपने समय को उस हिस्से पर व्यतीत कर सकते हैं जो मायने रखता हैः बताने वाला और कार्रवाई।",
      kn: "mugilu ಎಂದರೆ ಕೇವಲ ನೋಡುವುದಷ್ಟೇ ಅಲ್ಲ, ಅದನ್ನು ಕಟ್ಟಬೇಕು. ಪ್ರತಿಯೊಂದು ಮಾಹಿತಿಯ ತುಣುಕು ಸಹ ಮುಕ್ತವಾಗಿದೆ, ಯಂತ್ರ-ಓದಬಲ್ಲದು, ಆದ್ದರಿಂದ ನೀವು ನಿಮ್ಮ ಸ್ವಂತ ನಕ್ಷೆ, ಕಥೆ, ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಅಥವಾ ಎಚ್ಚರಿಕೆಯ ಹಿಂದೆ ಇಡೀ ಆಕಾಶವನ್ನು ಇರಿಸಬಹುದು, ಮತ್ತು ನಿಮ್ಮ ಸಮಯವನ್ನು ಮುಖ್ಯವಾದ ಭಾಗದ ಮೇಲೆ ಕಳೆಯಬಹುದು: ಹೇಳುವುದು, ಮತ್ತು ಕ್ರಮ ಕೈಗೊಳ್ಳುವುದು.",
    },
  "mugilu is the Kannada word for the open sky.": {
    hi: "mugilu — खुले आकाश के लिए कन्नड़ शब्द है।",
    kn: "mugilu — ಇದು ಮುಕ್ತ ಆಕಾಶಕ್ಕೆ ಕನ್ನಡ ಪದ (ಮುಗಿಲು).",
  },
  "mugilu mirrors the SACHET feed and keeps an archive of every alert.": {
    hi: "mugilu हर चेतावनी का अभिलेख रखते हुए SACHET फ़ीड को दर्शाता है।",
    kn: "ಇದು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಫೀಡ್ ಅನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ ಮತ್ತು ಪ್ರತಿ ಎಚ್ಚರಿಕೆಯ ಆರ್ಕೈವ್ ಅನ್ನು ಇಡುತ್ತದೆ.",
  },
  "mugilu names the single worst hazard over your exact location and says plainly what to do, weighted for who you are: asthma, older adults, children, outdoor workers, or a heart condition. It is informational, not medical or safety advice; for official warnings, consult NDMA and IMD.":
    {
      hi: "mugilu आपके सटीक स्थान पर सबसे खराब खतरे का नाम लेता है और स्पष्ट रूप से बताता है कि क्या करना हैः अस्थमा, वृद्ध वयस्क, बच्चे, बाहरी श्रमिक या हृदय की स्थिति। यह केवल जानकारी के लिए है, चिकित्सा या सुरक्षा सलाह के लिए नहीं; आधिकारिक चेतावनियों के लिए, NDMA और IMD से परामर्श करें।",
      kn: "mugilu ನಿಮ್ಮ ನಿಖರವಾದ ಸ್ಥಳದ ಮೇಲೆ ಅತ್ಯಂತ ಕೆಟ್ಟ ಅಪಾಯವನ್ನು ಹೆಸರಿಸಿ, ಏನು ಮಾಡಬೇಕು ಎಂಬುದನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳುತ್ತಾನೆ, ನೀವು ಯಾರು ಎಂಬುದರ ಆಧಾರದ ಮೇಲೆ: ಆಸ್ತಮಾ, ಹಿರಿಯ ವಯಸ್ಕರು, ಮಕ್ಕಳು, ಹೊರಾಂಗಣ ಕೆಲಸಗಾರರು ಅಥವಾ ಹೃದಯ ಸ್ಥಿತಿ. ಇದು ಕೇವಲ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ, ವೈದ್ಯಕೀಯ ಅಥವಾ ಸುರಕ್ಷತಾ ಸಲಹೆಗಳಿಗಾಗಿ ಅಲ್ಲ; ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ, NDMA ಮತ್ತು IMDಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    },
  "mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: CPCB, Airnet, Aurassure and Google AirView+ (via the OAQ broker) for air, Open-Meteo for weather, NDMA and IMD (via SACHET) for warnings, NASA FIRMS for fire smoke, OpenStreetMap, GeoNames and bharatlas for places and the map of India, and the AQLI method for years of life lost. The code is open under the MIT licence; the data keeps each source's own terms.":
    {
      hi: "mugilu के पास कोई सेंसर नहीं है और वह कोई पूर्वानुमान नहीं चलाता है। यह दूसरों के काम पर खड़ा है और उन्हें श्रेय देता हैः वायु गुणवत्ता के लिए CPCB, Airnet, Aurassure और Google AirView+ (OAQ ब्रोकर के माध्यम से), मौसम के लिए Open-Meteo, चेतावनियों के लिए NDMA और IMD (SACHET के माध्यम से), आग के धुएं के लिए NASA FIRMS, स्थानों और भारत के मानचित्र के लिए OpenStreetMap, GeoNames और bharatlas, और जीवन के खोए वर्षों के लिए AQLI विधि। कोड MIT लाइसेंस के तहत खुला है; डेटा प्रत्येक स्रोत के अपने नियमों को बनाए रखता है।",
      kn: "mugilu ಯಾವುದೇ ಸಂವೇದಕಗಳನ್ನು ಹೊಂದಿಲ್ಲ ಮತ್ತು ಯಾವುದೇ ಮುನ್ಸೂಚನೆಗಳನ್ನು ನೀಡುವುದಿಲ್ಲ. ಇದು ಇತರರ ಕೆಲಸವನ್ನು ಆಧರಿಸಿದೆ ಮತ್ತು ಅವರಿಗೆ ಮನ್ನಣೆ ನೀಡುತ್ತದೆ: ವಾಯು ಗುಣಮಟ್ಟಕ್ಕಾಗಿ CPCB, Airnet, Aurassure ಮತ್ತು Google AirView+ (OAQ ಬ್ರೋಕರ್ ಮೂಲಕ), ಹವಾಮಾನಕ್ಕಾಗಿ Open-Meteo, ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ NDMA ಮತ್ತು IMD (SACHET ಮೂಲಕ), ಬೆಂಕಿಯ ಹೊಗೆಗಾಗಿ NASA FIRMS, ಸ್ಥಳಗಳು ಮತ್ತು ಭಾರತದ ನಕ್ಷೆಗಾಗಿ OpenStreetMap, GeoNames ಮತ್ತು bharatlas, ಮತ್ತು ಕಳೆದುಹೋದ ಜೀವನದ ವರ್ಷಗಳಿಗಾಗಿ AQLI ವಿಧಾನ. ಕೋಡ್ MIT ಪರವಾನಗಿ ಅಡಿಯಲ್ಲಿ ತೆರೆದಿರುತ್ತದೆ; ದತ್ತಾಂಶವು ಪ್ರತಿ ಮೂಲದ ಸ್ವಂತ ನಿಯಮಗಳನ್ನು ಹೊಂದಿರುತ್ತದೆ.",
    },
  none: {
    hi: "कोई नहीं",
    kn: "ಅಪಾಯವಿಲ್ಲ",
  },
  "official NDMA / IMD alerts across India, right now.": {
    hi: "भारत भर में आधिकारिक NDMA / IMD अलर्ट, अभी।",
    kn: "ಭಾರತದಾದ್ಯಂತ ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಎಚ್ಚರಿಕೆಗಳು, ಈಗಲೇ.",
  },
  rain: {
    hi: "बारिश",
    kn: "ಮಳೆ",
  },
  "rain chance": {
    hi: "बारिश की संभावना",
    kn: "ಮಳೆ ಸಾಧ್ಯತೆ",
  },
  safe: {
    hi: "सुरक्षित",
    kn: "ಸುರಕ್ಷಿತ",
  },
  "scan for this on your phone": {
    hi: "अपने फ़ोन पर देखने के लिए इसे स्कैन करें",
    kn: "ನಿಮ್ಮ ಫೋನಿನಲ್ಲಿ ನೋಡಲು ಇದನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.",
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
    kn: "ಚಂಡಮಾರುತ",
  },
  strong: {
    hi: "तेज हवा",
    kn: "ಜೋರು ಗಾಳಿ",
  },
  sun: {
    hi: "सूर्य",
    kn: "ಸೂರ್ಯ",
  },
  terms: {
    hi: "शर्तें",
    kn: "ಷರತ್ತುಗಳು",
  },
  "the sky over this spot": {
    hi: "इस स्थान पर आकाश",
    kn: "ಆಕಾಶ ಈ ಸ್ಥಳದ ಮೇಲೆ",
  },
  "thick fog": {
    hi: "घना कोहरा",
    kn: "ದಟ್ಟವಾದ ಮಂಜು",
  },
  "to see its sky: air, heat, rain, dust.": {
    hi: "इसका आकाश देखने के लिए: वायु, गर्मी, बारिश, धूल।",
    kn: "ಅದರ ಆಕಾಶವನ್ನು ನೋಡಲು: ಗಾಳಿ, ಬಿಸಿಲು, ಮಳೆ, ಧೂಳು.",
  },
  updated: {
    hi: "अपडेट किया गया",
    kn: "ಕೊನೆಯದಾಗಿ ಪರಿಷ್ಕೃತ",
  },
  "very cold": {
    hi: "बहुत ठंड",
    kn: "ಶೀತಲ ವಾತಾವರಣ",
  },
  "very high": {
    hi: "बहुत अधिक",
    kn: "ಅತಿಹೆಚ್ಚು",
  },
  "very hot": {
    hi: "बहुत गर्म",
    kn: "ತುಂಬಾ ಬಿಸಿಲು",
  },
  warm: {
    hi: "गर्म",
    kn: "ಬಿಸಿಲು",
  },
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
    kn: "ವರ್ಷಗಳ ಜೀವನ ಕಳೆದುಹೋಗಿದೆ",
  },
  // Persona exposure steps + short disclaimer (Sarvam draft, glossary-fixed; native review pending).
  "Cut down time and hard exercise outdoors today.": {
    hi: "आज, बाहर कम समय बिताएं और बाहर कठिन व्यायाम करने से बचें।",
    kn: "ಇಂದು, ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ಕಠಿಣ ವ್ಯಾಯಾಮವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Limit time outdoors, and cover your nose and mouth if you go out.": {
    hi: "बाहर कम समय बिताएं और बाहर जाते समय अपना नाक और मुंह ढकें।",
    kn: "ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ, ಮತ್ತು ನೀವು ಹೊರಗೆ ಹೋದರೆ ನಿಮ್ಮ ಮೂಗು ಮತ್ತು ಬಾಯಿಯನ್ನು ಮುಚ್ಚಿಕೊಳ್ಳಿ.",
  },
  "Keep windows shut and limit time outdoors.": {
    hi: "खिड़कियाँ बंद रखें और बाहर कम समय बिताएँ।",
    kn: "ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ.",
  },
  "Cover your nose and mouth when you go out in the cold.": {
    hi: "ठंड के मौसम में जब आप बाहर जाएँ तो अपने नाक और मुँह को कपड़े से ढकें।",
    kn: "ಚಳಿಯಲ್ಲಿ ಹೊರಗೆ ಹೋದಾಗ ನಿಮ್ಮ ಮೂಗು ಮತ್ತು ಬಾಯಿಯನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ.",
  },
  "Hot homes are risky too: stay somewhere cool, drink water regularly, and have someone check on you.": {
    hi: "गर्म घर भी जोखिम भरा है: किसी ठंडी जगह पर रहें, नियमित रूप से पानी पिएँ, और किसी से कहें कि वह आपका हालचाल लेता रहे।",
    kn: "ಬಿಸಿಯಾದ ಮನೆಯೂ ಅಪಾಯಕಾರಿ: ತಂಪಾದ ಸ್ಥಳದಲ್ಲಿ ಇರಿ, ನಿಯಮಿತವಾಗಿ ನೀರು ಕುಡಿಯಿರಿ, ಮತ್ತು ಯಾರಾದರೂ ನಿಮ್ಮ ಯೋಗಕ್ಷೇಮ ವಿಚಾರಿಸುತ್ತಿರುವಂತೆ ನೋಡಿಕೊಳ್ಳಿ.",
  },
  "Keep your home warm, wear layers indoors too, and have someone check on you.": {
    hi: "अपने घर को गर्म रखें, घर के अंदर भी कई परतों के कपड़े पहनें, और किसी से कहें कि वह आपका हालचाल लेता रहे।",
    kn: "ನಿಮ್ಮ ಮನೆಯನ್ನು ಬೆಚ್ಚಗಿಡಿ, ಮನೆಯ ಒಳಗೆ ಸಹ ಹಲವಾರು ಪದರಗಳ ಬಟ್ಟೆಗಳನ್ನು ಧರಿಸಿ, ಮತ್ತು ಯಾರಾದರೂ ನಿಮ್ಮ ಯೋಗಕ್ಷೇಮ ವಿಚಾರಿಸುತ್ತಿರುವಂತೆ ನೋಡಿಕೊಳ್ಳಿ.",
  },
  "Limit time and exertion outdoors today.": {
    hi: "आज, बाहर कम समय बिताएं और बाहर शारीरिक श्रम करने से बचें।",
    kn: "ಇಂದು, ಹೊರಾಂಗಣದಲ್ಲಿ ಕಡಿಮೆ ಸಮಯ ಕಳೆಯಿರಿ ಮತ್ತು ಹೊರಾಂಗಣದಲ್ಲಿ ದೈಹಿಕ ಪರಿಶ್ರಮವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Hat, shade and sunscreen, and keep midday play short.": {
    hi: "बच्चे को टोपी, छाया और सनस्क्रीन दें और बच्चे के बाहरी खेल को दोपहर में छोटा रखें।",
    kn: "ಮಗುವಿಗೆ ಟೋಪಿ, ನೆರಳು ಮತ್ತು ಸನ್‌ಸ್ಕ್ರೀನ್ ನೀಡಿ, ಮತ್ತು ಮಧ್ಯಾಹ್ನದ ಹೊತ್ತು ಹೊರಾಂಗಣ ಆಟವನ್ನು ಕಡಿಮೆ ಮಾಡಿ.",
  },
  "Keep outdoor play short and gentle today.": {
    hi: "आज बच्चे का बाहर का खेल छोटा और हल्का रखें।",
    kn: "ಇಂದು, ಮಗುವಿನ ಹೊರಾಂಗಣ ಆಟವನ್ನು ಚಿಕ್ಕದಾಗಿ ಮತ್ತು ಸೌಮ್ಯವಾಗಿರಿಸಿ.",
  },
  "Keep outdoor play short today.": {
    hi: "आज बच्चे का बाहर का खेल छोटा रखें।",
    kn: "ಇಂದು, ಮಗುವಿನ ಹೊರಾಂಗಣ ಆಟವನ್ನು ಚಿಕ್ಕದಾಗಿರಿಸಿ.",
  },
  "Give extra water, keep play in the shade, and never leave a child in a parked vehicle.": {
    hi: "बच्चे को अतिरिक्त पानी दें, बच्चे का खेल छाया में रखें और कभी भी बच्चे को पार्क की गई गाड़ी में अकेला न छोड़ें।",
    kn: "ಮಗುವಿಗೆ ಹೆಚ್ಚುವರಿ ನೀರು ಕೊಡಿ, ಮಗುವಿನ ಆಟವನ್ನು ನೆರಳು ಇರುವ ಜಾಗದಲ್ಲಿ ಇಡಿ, ಮತ್ತು ನಿಲ್ಲಿಸಿದ ವಾಹನದಲ್ಲಿ ಮಗುವನ್ನು ಎಂದಿಗೂ ಒಬ್ಬಂಟಿಯಾಗಿ ಬಿಡಬೇಡಿ.",
  },
  "Dress them in layers and cover their head and hands.": {
    hi: "बच्चों को कई परतों के कपड़े पहनाएं और उनके सिर और हाथों को ढकें।",
    kn: "ಮಕ್ಕಳಿಗೆ ಹಲವಾರು ಪದರಗಳ ಬಟ್ಟೆ ತೊಡಿಸಿ ಮತ್ತು ಅವರ ತಲೆ ಮತ್ತು ಕೈಗಳನ್ನು ಮುಚ್ಚಿ.",
  },
  "Keep them indoors with windows shut.": {
    hi: "खिड़कियाँ बंद करके बच्चों को घर के अंदर रखें।",
    kn: "ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಮಕ್ಕಳನ್ನು ಮನೆಯೊಳಗೆ ಇರಿಸಿ.",
  },
  "Drink water often, take regular breaks in the shade, and move heavy work out of 12-3 pm.": {
    hi: "बार-बार पानी पिएँ, छाया में नियमित रूप से आराम करें, और दोपहर 12 बजे से 3 बजे के बीच भारी काम न करें।",
    kn: "ಆಗಾಗ್ಗೆ ನೀರು ಕುಡಿಯಿರಿ, ನೆರಳಿನಲ್ಲಿ ನಿಯಮಿತವಾಗಿ ವಿಶ್ರಾಂತಿ ತೆಗೆದುಕೊಳ್ಳಿ, ಮತ್ತು ಮಧ್ಯಾಹ್ನ 12 ರಿಂದ 3 ಗಂಟೆಯವರೆಗೆ ಭಾರವಾದ ಕೆಲಸಗಳನ್ನು ಮಾಡಬೇಡಿ.",
  },
  "Wear layers, keep dry, and take warm breaks.": {
    hi: "कई परतों के कपड़े पहनें, सूखे रहें और गर्म जगह पर आराम करें।",
    kn: "ಹಲವಾರು ಪದರಗಳ ಬಟ್ಟೆಗಳನ್ನು ಧರಿಸಿ, ಒಣಗಿರಿ ಮತ್ತು ಬೆಚ್ಚಗಿನ ಸ್ಥಳದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ವಿರಾಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.",
  },
  "Cover up, wear a hat, and take shade breaks around midday.": {
    hi: "अपनी त्वचा को कपड़ों से ढकें, टोपी पहनें, और दोपहर के आसपास छाया में आराम करें।",
    kn: "ನಿಮ್ಮ ಚರ್ಮವನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ, ಟೋಪಿ ಧರಿಸಿ ಮತ್ತು ಮಧ್ಯಾಹ್ನದ ಸುಮಾರಿಗೆ ನೆರಳು ಇರುವ ಜಾಗದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ತೆಗೆದುಕೊಳ್ಳಿ.",
  },
  "Swap heavy work for lighter tasks and take breaks indoors.": {
    hi: "भारी काम की जगह हल्के काम करें, और बीच-बीच में अंदर आराम करें।",
    kn: "ಭಾರವಾದ ಕೆಲಸಗಳ ಬದಲಿಗೆ ಹಗುರವಾದ ಕೆಲಸಗಳನ್ನು ಮಾಡಿ ಮತ್ತು ಒಳಾಂಗಣದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ವಿರಾಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.",
  },
  "Cover your nose and mouth, and protect your eyes.": {
    hi: "अपने नाक और मुंह को कपड़े से ढकें और अपनी आँखों को धूल से बचाएं।",
    kn: "ನಿಮ್ಮ ಮೂಗು ಮತ್ತು ಬಾಯಿಯನ್ನು ಬಟ್ಟೆಯಿಂದ ಮುಚ್ಚಿಕೊಳ್ಳಿ ಮತ್ತು ಧೂಳಿನಿಂದ ನಿಮ್ಮ ಕಣ್ಣುಗಳನ್ನು ರಕ್ಷಿಸಿಕೊಳ್ಳಿ.",
  },
  "Take breaks indoors and keep heavy work short.": {
    hi: "बीच-बीच में अंदर आराम करें, और भारी काम थोड़े समय के लिए ही करें।",
    kn: "ಒಳಾಂಗಣದಲ್ಲಿ ವಿಶ್ರಾಂತಿ ವಿರಾಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ ಮತ್ತು ಸ್ವಲ್ಪ ಸಮಯದವರೆಗೆ ಮಾತ್ರ ಭಾರವಾದ ಕೆಲಸ ಮಾಡಿ.",
  },
  "Avoid exertion and stay somewhere cool.": {
    hi: "शारीरिक श्रम से बचें और ठंडी जगह पर रहें।",
    kn: "ದೈಹಿಕ ಪರಿಶ್ರಮವನ್ನು ತಪ್ಪಿಸಿ ಮತ್ತು ತಂಪಾದ ಸ್ಥಳದಲ್ಲಿ ಇರಿ.",
  },
  "Keep warm and avoid sudden exertion in the cold.": {
    hi: "अपने शरीर को गर्म रखें और ठंड के मौसम में अचानक शारीरिक श्रम करने से बचें।",
    kn: "ನಿಮ್ಮ ದೇಹವನ್ನು ಬೆಚ್ಚಗಿಟ್ಟುಕೊಳ್ಳಿ ಮತ್ತು ಚಳಿಯಲ್ಲಿ ಹಠಾತ್ ದೈಹಿಕ ಪರಿಶ್ರಮವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Avoid exertion outdoors today.": {
    hi: "आज, बाहर शारीरिक श्रम करने से बचें।",
    kn: "ಇಂದು, ಹೊರಾಂಗಣದಲ್ಲಿ ದೈಹಿಕ ಪರಿಶ್ರಮವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Stay indoors with windows shut and avoid exertion.": {
    hi: "खिड़कियाँ बंद करके घर के अंदर रहें और शारीरिक श्रम से बचें।",
    kn: "ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ ಮನೆಯೊಳಗೆ ಇರಿ ಮತ್ತು ದೈಹಿಕ ಪರಿಶ್ರಮವನ್ನು ತಪ್ಪಿಸಿ.",
  },
  "Dangerous heat. Get somewhere cool, out of the sun, and drink water.": {
    hi: "गर्मी खतरनाक है। धूप से दूर एक ठंडी जगह पर जाएं और पानी पिएं।",
    kn: "ಬಿಸಿಲು ಅಪಾಯಕಾರಿಯಾಗಿದೆ. ಬಿಸಿಲಿನಿಂದ ದೂರ, ತಂಪಾದ ಸ್ಥಳಕ್ಕೆ ಹೋಗಿ, ನೀರು ಕುಡಿಯಿರಿ.",
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
  "No connection. This is the last reading saved on this device, from X. Conditions and warnings may have changed since.":
    {
      hi: "कनेक्शन नहीं है। यह इस डिवाइस पर सहेजी गई आख़िरी रीडिंग है, X की। तब से हालात और चेतावनियाँ बदल चुकी हो सकती हैं।",
      kn: "ಸಂಪರ್ಕವಿಲ್ಲ. ಇದು ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಿದ ಕೊನೆಯ ರೀಡಿಂಗ್, X ರದ್ದು. ಅಂದಿನಿಂದ ಪರಿಸ್ಥಿತಿ ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳು ಬದಲಾಗಿರಬಹುದು.",
    },
  "You are offline": { hi: "आप ऑफ़लाइन हैं", kn: "ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ" },
  "mugilu shows the sky right now, so it needs a connection. Places you have opened on this device keep their last reading.":
    {
      hi: "mugilu अभी का आसमान दिखाता है, इसलिए इसे इंटरनेट कनेक्शन चाहिए। इस डिवाइस पर पहले खोली गई जगहों की आख़िरी रीडिंग सहेजी रहती है।",
      kn: "mugilu ಈಗಿನ ಆಕಾಶವನ್ನು ತೋರಿಸುತ್ತದೆ, ಆದ್ದರಿಂದ ಇದಕ್ಕೆ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಬೇಕು. ಈ ಸಾಧನದಲ್ಲಿ ಹಿಂದೆ ತೆರೆದ ಸ್ಥಳಗಳ ಕೊನೆಯ ರೀಡಿಂಗ್ ಉಳಿದಿರುತ್ತದೆ.",
    },
  "Nearby, not over this spot:": { hi: "पास में, इस जगह पर नहीं:", kn: "ಹತ್ತಿರದಲ್ಲಿ, ಈ ಸ್ಥಳದ ಮೇಲೆ ಅಲ್ಲ:" },
  "See your places": { hi: "अपनी जगहें देखें", kn: "ನಿಮ್ಮ ಸ್ಥಳಗಳನ್ನು ನೋಡಿ" },
  // Opt-in alerts (alerts.ts, alerts-ui.ts): drafted here, native review pending.
  "Official warning for X, until Y.": { hi: "X के लिए आधिकारिक चेतावनी, Y तक।", kn: "X ಗೆ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ, Y ವರೆಗೆ." },
  "Official warning for X.": { hi: "X के लिए आधिकारिक चेतावनी।", kn: "X ಗೆ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ." },
  "Official warnings for this place": { hi: "इस जगह के लिए आधिकारिक चेतावनियाँ", kn: "ಈ ಸ್ಥಳಕ್ಕೆ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು" },
  "Alert me about official warnings here": {
    hi: "यहाँ की आधिकारिक चेतावनियों के बारे में मुझे सूचित करें",
    kn: "ಇಲ್ಲಿನ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳ ಬಗ್ಗೆ ನನಗೆ ತಿಳಿಸಿ",
  },
  "Alerts are on for this place.": { hi: "इस जगह के लिए अलर्ट चालू हैं।", kn: "ಈ ಸ್ಥಳಕ್ಕೆ ಅಲರ್ಟ್‌ಗಳು ಆನ್ ಆಗಿವೆ." },
  "Turn off": { hi: "बंद करें", kn: "ಆಫ್ ಮಾಡಿ" },
  "Notifications are blocked for mugilu. Allow them in your browser's site settings, then try again.": {
    hi: "mugilu के लिए सूचनाएँ बंद हैं। अपने ब्राउज़र की साइट सेटिंग में इन्हें अनुमति दें, फिर दोबारा कोशिश करें।",
    kn: "mugilu ಗೆ ಅಧಿಸೂಚನೆಗಳನ್ನು ತಡೆಯಲಾಗಿದೆ. ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಸೈಟ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅನುಮತಿಸಿ, ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  "Alerts are on for 12 places already. Turn one off first.": {
    hi: "12 जगहों के लिए अलर्ट पहले से चालू हैं। पहले किसी एक को बंद करें।",
    kn: "ಈಗಾಗಲೇ 12 ಸ್ಥಳಗಳಿಗೆ ಅಲರ್ಟ್‌ಗಳು ಆನ್ ಆಗಿವೆ. ಮೊದಲು ಒಂದನ್ನು ಆಫ್ ಮಾಡಿ.",
  },
  "Alerts could not be turned on. Try again.": {
    hi: "अलर्ट चालू नहीं हो सके। दोबारा कोशिश करें।",
    kn: "ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  "On iPhone and iPad, add mugilu to your Home Screen first (Share, then Add to Home Screen), open it from there, and turn alerts on here.":
    {
      hi: "iPhone और iPad पर, पहले mugilu को अपनी होम स्क्रीन पर जोड़ें (शेयर करें, फिर होम स्क्रीन में जोड़ें), उसे वहीं से खोलें, और यहाँ अलर्ट चालू करें।",
      kn: "iPhone ಮತ್ತು iPad ನಲ್ಲಿ, ಮೊದಲು mugilu ಅನ್ನು ನಿಮ್ಮ ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ (ಹಂಚಿಕೊಳ್ಳಿ, ನಂತರ ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ), ಅಲ್ಲಿಂದ ತೆರೆಯಿರಿ, ಮತ್ತು ಇಲ್ಲಿ ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಿ.",
    },
  "Opt-in. When you turn alerts on, mugilu keeps this place (to about 1 km) and your browser's push address, only to send you official NDMA/IMD warnings for it, and deletes them when you turn alerts off.":
    {
      hi: "आपकी मर्ज़ी से। अलर्ट चालू करने पर mugilu यह जगह (लगभग 1 किमी तक) और आपके ब्राउज़र का पुश पता रखता है, केवल इस जगह की आधिकारिक NDMA/IMD चेतावनियाँ भेजने के लिए, और अलर्ट बंद करने पर इन्हें मिटा देता है।",
      kn: "ನಿಮ್ಮ ಆಯ್ಕೆ. ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಿದಾಗ, mugilu ಈ ಸ್ಥಳವನ್ನು (ಸುಮಾರು 1 ಕಿಮೀ ವರೆಗೆ) ಮತ್ತು ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಪುಶ್ ವಿಳಾಸವನ್ನು ಇಟ್ಟುಕೊಳ್ಳುತ್ತದೆ, ಈ ಸ್ಥಳದ ಅಧಿಕೃತ NDMA/IMD ಎಚ್ಚರಿಕೆಗಳನ್ನು ಕಳುಹಿಸಲು ಮಾತ್ರ, ಮತ್ತು ಅಲರ್ಟ್‌ಗಳನ್ನು ಆಫ್ ಮಾಡಿದಾಗ ಅವುಗಳನ್ನು ಅಳಿಸುತ್ತದೆ.",
    },
  "If you turn on alerts for a place, mugilu keeps that place (to about 1 km) and your browser's push address, only to send you official warnings for it, and deletes them when you turn alerts off.":
    {
      hi: "अगर आप किसी जगह के लिए अलर्ट चालू करते हैं, तो mugilu वह जगह (लगभग 1 किमी तक) और आपके ब्राउज़र का पुश पता रखता है, केवल उस जगह की आधिकारिक चेतावनियाँ भेजने के लिए, और अलर्ट बंद करने पर इन्हें मिटा देता है।",
      kn: "ನೀವು ಒಂದು ಸ್ಥಳಕ್ಕೆ ಅಲರ್ಟ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಿದರೆ, mugilu ಆ ಸ್ಥಳವನ್ನು (ಸುಮಾರು 1 ಕಿಮೀ ವರೆಗೆ) ಮತ್ತು ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನ ಪುಶ್ ವಿಳಾಸವನ್ನು ಇಟ್ಟುಕೊಳ್ಳುತ್ತದೆ, ಆ ಸ್ಥಳದ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಕಳುಹಿಸಲು ಮಾತ್ರ, ಮತ್ತು ಅಲರ್ಟ್‌ಗಳನ್ನು ಆಫ್ ಮಾಡಿದಾಗ ಅವುಗಳನ್ನು ಅಳಿಸುತ್ತದೆ.",
    },
};
export function t(en: string, lang: Lang): string {
  if (lang === "en") return en;
  const e = TR[en];
  return (e && e[lang]) || en;
}
