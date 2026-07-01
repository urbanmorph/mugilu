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
  "A place in India, or lat,lon": {
    hi: "भारत में एक स्थान, या अक्षांश, देशांतर",
    kn: "ಭಾರತದಲ್ಲಿ ಒಂದು ಸ್ಥಳ, ಅಥವಾ ಅಕ್ಷಾಂಶ, ರೇಖಾಂಶ",
  },
  "A serious warning is active. Follow official guidance.": {
    hi: "एक गंभीर चेतावनी सक्रिय है। आधिकारिक मार्गदर्शन का पालन करें।",
    kn: "ಗಂಭೀರ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯವಾಗಿದೆ. ಅಧಿಕೃತ ಮಾರ್ಗದರ್ಶನವನ್ನು ಅನುಸರಿಸಿ.",
  },
  "Active warnings": {
    hi: "सक्रिय चेतावनियाँ",
    kn: "ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು",
  },
  Air: {
    hi: "वायु",
    kn: "ವಾಯುಗುಣ",
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
  Children: {
    hi: "बच्चे",
    kn: "ಮಕ್ಕಳು",
  },
  "Cold conditions. Cover up and limit time outside.": {
    hi: "ठंडी परिस्थितियाँ। बाहर समय सीमित करें और ढक कर रखें।",
    kn: "ಶೀತಲ ಪರಿಸ್ಥಿತಿಗಳು. ಹೊರಾಂಗಣದಲ್ಲಿ ಕಳೆಯುವ ಸಮಯವನ್ನು ಮಿತಿಗೊಳಿಸಿ ಮತ್ತು ಮುಚ್ಚಿಕೊಳ್ಳಿ.",
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
  "Dangerous heat. Avoid being outdoors.": {
    hi: "खतरनाक गर्मी। बाहर जाने से बचें।",
    kn: "ಅಪಾಯಕಾರಿ ಬಿಸಿಲು. ಹೊರಾಂಗಣದಲ್ಲಿ ಇರಬೇಡಿ.",
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
  Embed: {
    hi: "एम्बेड",
    kn: "ಎಂಬೆಡ್",
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
  "For an always-on unattended screen, point a kiosk-browser app at the same link so it auto-starts.": {
    hi: "हमेशा चालू रहने वाली, बिना निगरानी वाली स्क्रीन के लिए, किसी कियोस्क-ब्राउज़र ऐप (उदाहरण के लिए Android पर Fully Kiosk) को उसी लिंक पर सेट करें ताकि यह अपने आप शुरू हो जाए।",
    kn: "ಸದಾ-ಆನ್, ಮೇಲ್ವಿಚಾರಣೆಯಿಲ್ಲದ ಸ್ಕ್ರೀನ್‌ಗೆ, ಅದೇ ಕೊಂಡಿಗೆ ಕಿಒಸ್ಕ್-ಬ್ರೌಸರ್ ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ಹೊಂದಿಸಿ, ಆದ್ದರಿಂದ ಅದು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.",
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
  JSON: {
    hi: "जेसन",
    kn: "ಜೇಸನ್",
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
  Markdown: {
    hi: "मार्कडाउन",
    kn: "ಮಾರ್ಕ್‌ಡೌನ್",
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
  PNG: {
    hi: "पीएनजी",
    kn: "ಪಿಎನ್‌ಜಿ",
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
  "That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate.": {
    hi: "उस पृष्ठ का mugilu पर अस्तित्व नहीं है। इसके बजाय किसी जगह को देखें या निर्देशांक दें।",
    kn: "ಆ ಪುಟ ಇಲ್ಲಿ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ. ಬದಲಿಗೆ, ಒಂದು ಸ್ಥಳವನ್ನು ಹುಡುಕಿ ಅಥವಾ ನಿರ್ದೇಶಾಂಕವನ್ನು ನೀಡಿ.",
  },
  "The open sky of India, one coordinate at a time.": {
    hi: "भारत का खुला आकाश, एक बार में एक निर्देशांक।",
    kn: "ಭಾರತದ ಮುಕ್ತ ಆಕಾಶ, ನಿರ್ದೇಶಾಂಕ ಒಂದೊಂದಾಗಿ.",
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
  "What's it like outside, right now?": {
    hi: "बाहर अभी कैसा है?",
    kn: "ಈಗ ಹೊರಗೆ ಹೇಗಿದೆ?",
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
  "mugilu mirrors the SACHET feed and keeps an archive of every alert.": {
    hi: "mugilu हर चेतावनी का अभिलेख रखते हुए SACHET फ़ीड को दर्शाता है।",
    kn: "ಇದು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಫೀಡ್ ಅನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ ಮತ್ತು ಪ್ರತಿ ಎಚ್ಚರಿಕೆಯ ಆರ್ಕೈವ್ ಅನ್ನು ಇಡುತ್ತದೆ.",
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
};
export function t(en: string, lang: Lang): string {
  if (lang === "en") return en;
  const e = TR[en];
  return (e && e[lang]) || en;
}
