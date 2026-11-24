import { AQI_BAND_LABEL } from "./aqi";
import { facts, type Fact, type Provenance } from "./facts";
import { placeLabel } from "./readings";
import { localName, placeBySlug, slugForName } from "./slugs";
import type { Conditions } from "./types";
import { periodText } from "./heatnormals";
import { t, type Lang } from "./i18n";
import { istClock, istDay } from "./ist";
import { HISTORY_FROM, warnedDays, type Colour, type PastAlert } from "./warnhistory";
import { issuerName, warningLabel } from "./pages/warnings";
import type { ProviderId } from "./types";
import { LEVEL_WORD } from "./ui/components";
import { ADVICE, PERSONA_ACTION, RISK_BANDS } from "./score";

// The phrasebook (supporting-docs/READING_SENTENCES_SPEC.md): every sentence mugilu writes
// about a reading, in English, Hindi and Kannada, from the facts in facts.ts.
//
// Rules the templates keep (about 70% of ASD-STE100, checked by test/phrases.test.ts):
// one topic and at most 20 words a sentence, active voice when the actor is known, present
// tense for now and past for a measurement made, one word for one meaning, no -ing openers,
// no em-dashes. Each template is a whole sentence: never join pieces of two templates, since
// the word order differs between the languages. Every form a template needs is stored here
// (lexicon below); code never adds an ending to a word. A place name never takes an ending:
// Hindi has separate postpositions, and Kannada puts the case ending on ಪ್ರದೇಶ (area).

type ByLang = Record<Lang, string>;
type Variants = Record<Lang, string[]>;

export const PHRASES = {
  "air.value": {
    en: "The air quality is {band}, AQI {aqi}.",
    hi: "वायु गुणवत्ता {band} है, AQI {aqi}।",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ {band}, AQI {aqi}.",
  },
  "air.measured": {
    en: "The {network} station {station}, {km} km away, measured it at {at}.",
    hi: "{network} के {station} स्टेशन ने इसे {at} पर मापा। स्टेशन {km} km दूर है।",
    kn: "{network} ಜಾಲದ {station} ನಿಲ್ದಾಣ ಇದನ್ನು {at} ಕ್ಕೆ ಅಳೆದಿದೆ. ನಿಲ್ದಾಣ {km} km ದೂರದಲ್ಲಿದೆ.",
  },
  "air.modelled": {
    en: "Open-Meteo models this value. No air station is within {radius} km.",
    hi: "यह Open-Meteo का अनुमान है। {radius} km के भीतर कोई वायु स्टेशन नहीं है।",
    kn: "ಇದು Open-Meteo ಅಂದಾಜು. {radius} km ಒಳಗೆ ಯಾವುದೇ ವಾಯು ನಿಲ್ದಾಣವಿಲ್ಲ.",
  },
  "temp.now": {
    en: "The temperature is {t}°C. It feels like {f}°C.",
    hi: "तापमान {t}°C है। यह {f}°C जैसा महसूस होता है।",
    kn: "ತಾಪಮಾನ {t}°C. ಇದು {f}°C ನಂತೆ ಅನಿಸುತ್ತದೆ.",
  },
  "temp.above": {
    en: "The high today is {max}°C, {d}°C above normal for {period}.",
    hi: "आज का अधिकतम {max}°C है। यह {period} सामान्य से {d}°C अधिक है।",
    kn: "ಇಂದಿನ ಗರಿಷ್ಠ {max}°C. ಇದು {period} ಸಾಮಾನ್ಯಕ್ಕಿಂತ {d}°C ಹೆಚ್ಚು.",
  },
  "temp.below": {
    en: "The high today is {max}°C, {d}°C below normal for {period}.",
    hi: "आज का अधिकतम {max}°C है। यह {period} सामान्य से {d}°C कम है।",
    kn: "ಇಂದಿನ ಗರಿಷ್ಠ {max}°C. ಇದು {period} ಸಾಮಾನ್ಯಕ್ಕಿಂತ {d}°C ಕಡಿಮೆ.",
  },
  "temp.same": {
    en: "The high today is {max}°C, the same as normal for {period}.",
    hi: "आज का अधिकतम {max}°C है। यह {period} सामान्य के बराबर है।",
    kn: "ಇಂದಿನ ಗರಿಷ್ಠ {max}°C. ಇದು {period} ಸಾಮಾನ್ಯಕ್ಕೆ ಸಮ.",
  },
  "rain.none": { en: "There is no rain now.", hi: "अभी बारिश नहीं हो रही है।", kn: "ಈಗ ಮಳೆ ಇಲ್ಲ." },
  "rain.some": {
    en: "{mm} mm of rain fell in the last hour.",
    hi: "पिछले एक घंटे में {mm} mm बारिश हुई।",
    kn: "ಕಳೆದ ಒಂದು ಗಂಟೆಯಲ್ಲಿ {mm} mm ಮಳೆ ಬಿದ್ದಿದೆ.",
  },
  "wind.now": {
    en: "The wind speed is {s} km/h, {from}. Gusts reach {g} km/h.",
    hi: "हवा की गति {s} km/h है, {from}। झोंके {g} km/h तक पहुंचते हैं।",
    kn: "ಗಾಳಿ {from} {s} km/h ವೇಗದಲ್ಲಿ ಬೀಸುತ್ತಿದೆ. ರಭಸ {g} km/h ವರೆಗೆ ತಲುಪುತ್ತದೆ.",
  },
  "fog.clear": {
    en: "The visibility is {v}. There is no fog: IMD uses the word fog below 1 km.",
    hi: "दृश्यता {v} है। कोहरा नहीं है। IMD 1 km से कम दृश्यता को कोहरा कहता है।",
    kn: "ಗೋಚರತೆ {v}. ಮಂಜು ಇಲ್ಲ. ಗೋಚರತೆ 1 km ಗಿಂತ ಕಡಿಮೆಯಾದಾಗ IMD ಅದನ್ನು ಮಂಜು ಎನ್ನುತ್ತದೆ.",
  },
  "fog.fog": {
    en: "The visibility is {v}. This is fog: the visibility is below 1 km.",
    hi: "दृश्यता {v} है। यह कोहरा है। दृश्यता 1 km से कम है।",
    kn: "ಗೋಚರತೆ {v}. ಇದು ಮಂಜು. ಗೋಚರತೆ 1 km ಗಿಂತ ಕಡಿಮೆ.",
  },
  "smoke.none": {
    en: "A satellite saw no fires within {r} km in the last {h} hours.",
    hi: "पिछले {h} घंटों में उपग्रह ने {r} km के भीतर कोई आग नहीं देखी।",
    kn: "ಕಳೆದ {h} ಗಂಟೆಗಳಲ್ಲಿ ಉಪಗ್ರಹ {r} km ಒಳಗೆ ಯಾವುದೇ ಬೆಂಕಿಯನ್ನು ಕಂಡಿಲ್ಲ.",
  },
  "smoke.one": {
    en: "A satellite saw 1 fire within {r} km in the last {h} hours. The nearest is {km} km away.",
    hi: "पिछले {h} घंटों में उपग्रह ने {r} km के भीतर 1 आग देखी। वह {km} km दूर है।",
    kn: "ಕಳೆದ {h} ಗಂಟೆಗಳಲ್ಲಿ ಉಪಗ್ರಹ {r} km ಒಳಗೆ 1 ಬೆಂಕಿಯನ್ನು ಕಂಡಿದೆ. ಅದು {km} km ದೂರದಲ್ಲಿದೆ.",
  },
  "smoke.clear": {
    en: "The air here is {band}, so their smoke is not showing in it now.",
    hi: "यहाँ वायु गुणवत्ता {band} है, इसलिए उनका धुआँ अभी इसमें नहीं दिख रहा।",
    kn: "ಇಲ್ಲಿನ ವಾಯು ಗುಣಮಟ್ಟ {band}, ಆದ್ದರಿಂದ ಅವುಗಳ ಹೊಗೆ ಈಗ ಇದರಲ್ಲಿ ಕಾಣುತ್ತಿಲ್ಲ.",
  },
  "smoke.many": {
    en: "A satellite saw {n} fires within {r} km in the last {h} hours. The nearest is {km} km away.",
    hi: "पिछले {h} घंटों में उपग्रह ने {r} km के भीतर {n} आग देखीं। सबसे नज़दीकी {km} km दूर है।",
    kn: "ಕಳೆದ {h} ಗಂಟೆಗಳಲ್ಲಿ ಉಪಗ್ರಹ {r} km ಒಳಗೆ {n} ಬೆಂಕಿಗಳನ್ನು ಕಂಡಿದೆ. ಹತ್ತಿರದ್ದು {km} km ದೂರದಲ್ಲಿದೆ.",
  },
  "uv.now": { en: "The UV index is {uv}, {level}.", hi: "UV सूचकांक {uv} है, {level}।", kn: "UV ಸೂಚ್ಯಂಕ {uv}, {level}." },
  "dust.now": {
    en: "The dust is {d} µg/m³, {level}. Open-Meteo models this value.",
    hi: "धूल {d} µg/m³ है, {level}। यह Open-Meteo का अनुमान है।",
    kn: "ಧೂಳು {d} µg/m³, {level}. ಇದು Open-Meteo ಅಂದಾಜು.",
  },
  "fallback.grid": {
    en: "This value is from the district grid at {at}, because the live reading failed.",
    hi: "यह मान {at} के जिला ग्रिड से है, क्योंकि ताज़ा रीडिंग नहीं मिली।",
    kn: "ತಾಜಾ ಮಾಹಿತಿ ಸಿಗದ ಕಾರಣ, ಈ ಮೌಲ್ಯ {at} ರ ಜಿಲ್ಲಾ ಗ್ರಿಡ್‌ನಿಂದ ಬಂದಿದೆ.",
  },
  "warn.none": {
    en: "No IMD or NDMA warning covers {place} now.",
    hi: "अभी {place} पर कोई IMD या NDMA चेतावनी नहीं है।",
    kn: "ಈಗ {place} ಪ್ರದೇಶಕ್ಕೆ ಯಾವುದೇ IMD ಅಥವಾ NDMA ಎಚ್ಚರಿಕೆ ಇಲ್ಲ.",
  },
  "warn.here": {
    en: "{issuer} issued {colour} warning for {place}: {type}.",
    hi: "{issuer} ने {place} के लिए {colour} चेतावनी जारी की है: {type}।",
    kn: "{issuer} {place} ಪ್ರದೇಶಕ್ಕೆ {colour} ಎಚ್ಚರಿಕೆ ನೀಡಿದೆ: {type}.",
  },
  "warn.near.one": {
    en: "1 warning covers an area near {place}.",
    hi: "{place} के पास के एक क्षेत्र पर 1 चेतावनी है।",
    kn: "{place} ಹತ್ತಿರದ ಒಂದು ಪ್ರದೇಶಕ್ಕೆ 1 ಎಚ್ಚರಿಕೆ ಇದೆ.",
  },
  "warn.near.many": {
    en: "{n} warnings cover areas near {place}.",
    hi: "{place} के पास के क्षेत्रों पर {n} चेतावनियाँ हैं।",
    kn: "{place} ಹತ್ತಿರದ ಪ್ರದೇಶಗಳಿಗೆ {n} ಎಚ್ಚರಿಕೆಗಳಿವೆ.",
  },
  "answer.air": {
    en: "In {place} now, the air quality is {band}, AQI {aqi}.",
    hi: "{place} में अभी वायु गुणवत्ता {band} है, AQI {aqi}।",
    kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ ಈಗ ವಾಯು ಗುಣಮಟ್ಟ {band}, AQI {aqi}.",
  },
  "answer.calm": {
    en: "It is {t}°C, with no rain and no official warning.",
    hi: "तापमान {t}°C है। बारिश नहीं है और कोई आधिकारिक चेतावनी नहीं है।",
    kn: "ತಾಪಮಾನ {t}°C. ಮಳೆ ಇಲ್ಲ, ಯಾವುದೇ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಯೂ ಇಲ್ಲ.",
  },
  "answer.rain": {
    en: "It is {t}°C, and {mm} mm of rain fell in the last hour.",
    hi: "तापमान {t}°C है। पिछले एक घंटे में {mm} mm बारिश हुई।",
    kn: "ತಾಪಮಾನ {t}°C. ಕಳೆದ ಒಂದು ಗಂಟೆಯಲ್ಲಿ {mm} mm ಮಳೆ ಬಿದ್ದಿದೆ.",
  },
  "answer.warned": {
    en: "It is {t}°C. An official warning is active.",
    hi: "तापमान {t}°C है। एक आधिकारिक चेतावनी लागू है।",
    kn: "ತಾಪಮಾನ {t}°C. ಒಂದು ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಜಾರಿಯಲ್ಲಿದೆ.",
  },
  "desc.measured": {
    en: "{place} AQI {aqi} ({band}) at {at}, measured by {network} at {station}.",
    hi: "{place} में AQI {aqi} ({band}), {at} पर {network} के {station} स्टेशन से।",
    kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ AQI {aqi} ({band}), {at} ಕ್ಕೆ {network} ಜಾಲದ {station} ನಿಲ್ದಾಣದಿಂದ.",
  },
  "desc.modelled": {
    en: "{place} AQI {aqi} ({band}), modelled: no air station within {radius} km.",
    hi: "{place} में AQI {aqi} ({band}), अनुमानित: {radius} km के भीतर कोई वायु स्टेशन नहीं।",
    kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ AQI {aqi} ({band}), ಅಂದಾಜು: {radius} km ಒಳಗೆ ವಾಯು ನಿಲ್ದಾಣವಿಲ್ಲ.",
  },
  "desc.temp": { en: "{t}°C.", hi: "तापमान {t}°C।", kn: "ತಾಪಮಾನ {t}°C." },
  "desc.calm": {
    en: "No rain. Wind {s} km/h. No IMD warning.",
    hi: "बारिश नहीं। हवा {s} km/h। कोई IMD चेतावनी नहीं।",
    kn: "ಮಳೆ ಇಲ್ಲ. ಗಾಳಿ {s} km/h. IMD ಎಚ್ಚರಿಕೆ ಇಲ್ಲ.",
  },
  "title.noair": {
    en: "{place}: weather and IMD warnings now",
    hi: "{place}: मौसम और चेतावनी अभी",
    kn: "{place}: ಹವಾಮಾನ ಮತ್ತು ಎಚ್ಚರಿಕೆ ಈಗ",
  },
  "desc.updated": { en: "Updated {at}.", hi: "{at} पर अपडेट।", kn: "{at} ಕ್ಕೆ ನವೀಕರಿಸಲಾಗಿದೆ." },
  // Headings and labels on the place page.
  "h.sub": { en: "Air quality and weather now", hi: "आज की हवा और मौसम", kn: "ಈಗಿನ ವಾಯು ಗುಣಮಟ್ಟ ಮತ್ತು ಹವಾಮಾನ" },
  "h.warn": {
    en: "IMD and NDMA warnings for {place}",
    hi: "{place} के लिए IMD और NDMA चेतावनियाँ (अलर्ट)",
    kn: "{place}: IMD ಮತ್ತು NDMA ಎಚ್ಚರಿಕೆಗಳು (ಅಲರ್ಟ್)",
  },
  "h.qa": {
    en: "Questions about the air and weather in {place}",
    hi: "{place} की हवा और मौसम पर सवाल",
    kn: "{place}: ವಾಯು ಮತ್ತು ಹವಾಮಾನ ಕುರಿತು ಪ್ರಶ್ನೆಗಳು",
  },
  "warn.source": {
    en: "Warnings come from the national SACHET feed. A new warning shows at the top of this page.",
    hi: "चेतावनियाँ राष्ट्रीय SACHET फ़ीड से आती हैं। नई चेतावनी इस पेज पर सबसे ऊपर दिखती है।",
    kn: "ಎಚ್ಚರಿಕೆಗಳು ರಾಷ್ಟ್ರೀಯ SACHET ಫೀಡ್‌ನಿಂದ ಬರುತ್ತವೆ. ಹೊಸ ಎಚ್ಚರಿಕೆ ಈ ಪುಟದ ಮೇಲ್ಭಾಗದಲ್ಲಿ ಕಾಣುತ್ತದೆ.",
  },
  "warn.past.none": {
    en: "No official warning covered {place} since {since}.",
    hi: "{since} से {place} पर कोई आधिकारिक चेतावनी नहीं रही।",
    kn: "{since} ರಿಂದ {place} ಪ್ರದೇಶಕ್ಕೆ ಯಾವುದೇ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಇರಲಿಲ್ಲ.",
  },
  "warn.past.one": {
    en: "Since {since}, official warnings covered {place} on 1 day: {split}.",
    hi: "{since} से {place} पर 1 दिन आधिकारिक चेतावनी रही: {split}।",
    kn: "{since} ರಿಂದ {place} ಪ್ರದೇಶಕ್ಕೆ 1 ದಿನ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಇತ್ತು: {split}.",
  },
  "warn.past.many": {
    en: "Since {since}, official warnings covered {place} on {n} days: {split}.",
    hi: "{since} से {place} पर {n} दिन आधिकारिक चेतावनी रही: {split}।",
    kn: "{since} ರಿಂದ {place} ಪ್ರದೇಶಕ್ಕೆ {n} ದಿನ ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಇತ್ತು: {split}.",
  },
  "warn.past.on": { en: "{colour} on {n}", hi: "{n} दिन {colour}", kn: "{n} ದಿನ {colour}" },
  "warn.past.last": {
    en: "The last was {colour} warning on {date}: {type}, from {issuer}.",
    hi: "पिछली {colour} चेतावनी {date} को थी: {type}, {issuer} की ओर से।",
    kn: "ಕೊನೆಯದು {date} ರಂದು {colour} ಎಚ್ಚರಿಕೆ: {type}, {issuer} ನೀಡಿದ್ದು.",
  },
  "warn.past.recent": {
    en: "The last {n} warnings",
    hi: "पिछली {n} चेतावनियाँ",
    kn: "ಕೊನೆಯ {n} ಎಚ್ಚರಿಕೆಗಳು",
  },
  "warn.past.all": {
    en: "All {n} alerts since {since}",
    hi: "{since} से सभी {n} अलर्ट",
    kn: "{since} ರಿಂದ ಎಲ್ಲಾ {n} ಅಲರ್ಟ್‌ಗಳು",
  },
  "warn.page.title": {
    en: "{place}: each warning since {since}",
    hi: "{place}: {since} से हर चेतावनी",
    kn: "{place}: {since} ರಿಂದ ಪ್ರತಿ ಎಚ್ಚರಿಕೆ",
  },
  "warn.past.each": { en: "Each warning since {since}", hi: "{since} से हर चेतावनी", kn: "{since} ರಿಂದ ಪ್ರತಿ ಎಚ್ಚರಿಕೆ" },
  "warn.all": { en: "All warnings in India now", hi: "भारत की सभी चेतावनियाँ अभी", kn: "ಭಾರತದ ಎಲ್ಲಾ ಎಚ್ಚರಿಕೆಗಳು ಈಗ" },
  // Questions people ask. The place takes no ending in any language.
  "q.aqi": {
    en: "What is the AQI in {place} now?",
    hi: "{place} में अभी AQI कितना है?",
    kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ ಈಗ AQI ಎಷ್ಟು?",
  },
  "q.warn": {
    en: "Is there a weather warning for {place} today?",
    hi: "क्या आज {place} के लिए मौसम की कोई चेतावनी है?",
    kn: "ಇಂದು {place} ಪ್ರದೇಶಕ್ಕೆ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ ಇದೆಯೇ?",
  },
  "q.temp": {
    en: "How hot or cold is it in {place} now?",
    hi: "{place} में अभी कितनी गर्मी या ठंड है?",
    kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ ಈಗ ಎಷ್ಟು ಬಿಸಿ ಅಥವಾ ಚಳಿ ಇದೆ?",
  },
  "q.rain": {
    en: "Will it rain in {place} today?",
    hi: "क्या आज {place} में बारिश होगी?",
    kn: "ಇಂದು {place} ಪ್ರದೇಶದಲ್ಲಿ ಮಳೆ ಬರುತ್ತದೆಯೇ?",
  },
  "q.child": {
    en: "Can children play outside in {place} now?",
    hi: "क्या बच्चे अभी {place} में बाहर खेल सकते हैं?",
    kn: "ಈಗ {place} ಪ್ರದೇಶದಲ್ಲಿ ಮಕ್ಕಳು ಹೊರಗೆ ಆಡಬಹುದೇ?",
  },
  "a.yes": { en: "Yes.", hi: "हाँ।", kn: "ಹೌದು." },
  "a.no": { en: "No.", hi: "नहीं।", kn: "ಇಲ್ಲ." },
  nowcast: {
    en: "mugilu shows the conditions now. It does not forecast. For a forecast, see IMD.",
    hi: "mugilu अभी के हालात दिखाता है, पूर्वानुमान नहीं। पूर्वानुमान के लिए IMD देखें।",
    kn: "mugilu ಈಗಿನ ಸ್ಥಿತಿಯನ್ನು ತೋರಿಸುತ್ತದೆ, ಮುನ್ಸೂಚನೆಯನ್ನಲ್ಲ. ಮುನ್ಸೂಚನೆಗೆ IMD ನೋಡಿ.",
  },
  "child.calm": {
    en: "The air quality is {band}. Outdoor play can go on as usual.",
    hi: "वायु गुणवत्ता {band} है। बाहर खेलना हमेशा की तरह चल सकता है।",
    kn: "ವಾಯು ಗುಣಮಟ್ಟ {band}. ಹೊರಗಿನ ಆಟ ಎಂದಿನಂತೆ ನಡೆಯಬಹುದು.",
  },
} satisfies Record<string, ByLang>;

/** Each reading's heading on the place page: the words people search, with the place
 *  ("Is it raining in Almora?"). Keyed as readRows keys its rows. */
export const READING_HEADING: Record<string, ByLang> = {
  air: { en: "{place} AQI now", hi: "{place} में AQI अभी", kn: "{place} ಪ್ರದೇಶದ AQI ಈಗ" },
  heat: { en: "Temperature in {place} now", hi: "{place} में तापमान अभी", kn: "{place} ಪ್ರದೇಶದ ತಾಪಮಾನ ಈಗ" },
  sun: { en: "UV index in {place} today", hi: "{place} में UV सूचकांक आज", kn: "{place} ಪ್ರದೇಶದ UV ಸೂಚ್ಯಂಕ ಇಂದು" },
  dust: { en: "Dust in {place}", hi: "{place} में धूल", kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ ಧೂಳು" },
  wind: { en: "Wind in {place} now", hi: "{place} में हवा अभी", kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ ಈಗ ಗಾಳಿ" },
  fog: { en: "Fog in {place} now", hi: "{place} में कोहरा अभी", kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ ಈಗ ಮಂಜು" },
  smoke: { en: "Smoke from fires near {place}", hi: "{place} के पास आग का धुआं", kn: "{place} ಬಳಿ ಬೆಂಕಿಯ ಹೊಗೆ" },
  rain: {
    en: "Is it raining in {place}?",
    hi: "क्या {place} में बारिश हो रही है?",
    kn: "{place} ಪ್ರದೇಶದಲ್ಲಿ ಈಗ ಮಳೆ ಇದೆಯೇ?",
  },
};

/** A reading's heading for a place, or undefined for a row with none. */
export const readingHeading = (key: string, place: string, lang: Lang): string | undefined => {
  const h = READING_HEADING[key]?.[lang];
  return h && put(h, { place });
};

/** The fact behind each reading row (readRows' keys to facts.ts keys). */
export const ROW_FACT: Record<string, Fact["key"]> = {
  air: "air",
  heat: "temp",
  sun: "uv",
  dust: "dust",
  wind: "wind",
  fog: "fog",
  smoke: "smoke",
  rain: "rain",
};

/** Title variants, longest first: the first that fits the limit wins. */
export const TITLES: Variants = {
  en: [
    "{place} AQI today: {aqi} {band}, weather and IMD warnings",
    "{place} AQI today: {aqi} {band}, weather and warnings",
    "{place} AQI today: {aqi} {band} and weather",
    "{place} AQI today: {aqi} {band}",
  ],
  hi: ["{place} AQI आज: {aqi} {band}, मौसम और चेतावनी", "{place} AQI आज: {aqi} {band}"],
  kn: ["{place} AQI ಇಂದು: {aqi} {band}, ಹವಾಮಾನ ಮತ್ತು ಎಚ್ಚರಿಕೆ", "{place} AQI ಇಂದು: {aqi} {band}"],
};
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

// ── Lexicon: each form a template needs, stored whole. ──────────────────────────────
type Band = Extract<Fact, { key: "air" }>["band"];

/** The AQI band as the predicate of "The air quality is ...". Labels ("Very Poor") come
 *  from AQI_BAND_LABEL through i18n. */
const BAND_PRED: Record<Band, ByLang> = {
  good: { en: "good", hi: "अच्छी", kn: "ಉತ್ತಮವಾಗಿದೆ" },
  satisfactory: { en: "satisfactory", hi: "संतोषजनक", kn: "ತೃಪ್ತಿಕರವಾಗಿದೆ" },
  moderate: { en: "moderate", hi: "मध्यम", kn: "ಮಧ್ಯಮವಾಗಿದೆ" },
  poor: { en: "poor", hi: "खराब", kn: "ಕೆಟ್ಟದಾಗಿದೆ" },
  vpoor: { en: "very poor", hi: "बहुत खराब", kn: "ತುಂಬಾ ಕೆಟ್ಟದಾಗಿದೆ" },
  severe: { en: "severe", hi: "गंभीर", kn: "ತೀವ್ರವಾಗಿದೆ" },
  unknown: { en: "not known", hi: "अज्ञात", kn: "ತಿಳಿದಿಲ್ಲ" },
};

/** Air networks as a sentence names them. Brand names are not translated. */
export const NETWORK: Record<ProviderId, string> = {
  cpcb: "CPCB",
  airnet: "Airnet (CSTEP)",
  aurassure: "Aurassure",
  airview: "Google AirView+",
};

/** Where the wind blows from, 8 points from north, the whole "from" phrase stored. */
const FROM: Record<Lang, string[]> = {
  en: [
    "from the north",
    "from the northeast",
    "from the east",
    "from the southeast",
    "from the south",
    "from the southwest",
    "from the west",
    "from the northwest",
  ],
  hi: ["उत्तर से", "उत्तर-पूर्व से", "पूर्व से", "दक्षिण-पूर्व से", "दक्षिण से", "दक्षिण-पश्चिम से", "पश्चिम से", "उत्तर-पश्चिम से"],
  kn: ["ಉತ್ತರದಿಂದ", "ಈಶಾನ್ಯದಿಂದ", "ಪೂರ್ವದಿಂದ", "ಆಗ್ನೇಯದಿಂದ", "ದಕ್ಷಿಣದಿಂದ", "ನೈಋತ್ಯದಿಂದ", "ಪಶ್ಚಿಮದಿಂದ", "ವಾಯವ್ಯದಿಂದ"],
};

/** A warning colour with its article ("an orange"): the article is part of the stored form. */
const COLOUR: Record<string, ByLang> = {
  yellow: { en: "a yellow", hi: "येलो", kn: "ಯೆಲ್ಲೋ" },
  orange: { en: "an orange", hi: "ऑरेंज", kn: "ಆರೆಂಜ್" },
  red: { en: "a red", hi: "रेड", kn: "ರೆಡ್" },
  green: { en: "a green", hi: "ग्रीन", kn: "ಗ್ರೀನ್" },
  "": { en: "a", hi: "एक", kn: "ಒಂದು" },
};
/** A warning colour alone, as a count or a list reads it ("2 yellow"). */
export const colourWord = (c: Colour, lang: Lang): string => COLOUR_WORD[c][lang];
const COLOUR_WORD: Record<Colour, ByLang> = {
  red: { en: "red", hi: "रेड", kn: "ರೆಡ್" },
  orange: { en: "orange", hi: "ऑरेंज", kn: "ಆರೆಂಜ್" },
  yellow: { en: "yellow", hi: "येलो", kn: "ಯೆಲ್ಲೋ" },
  green: { en: "green", hi: "ग्रीन", kn: "ಗ್ರೀನ್" },
};

// ── Filling ─────────────────────────────────────────────────────────────────────────
type Id = keyof typeof PHRASES;
type Slots = Record<string, string | number>;

function put(s: string, v: Slots): string {
  const out = s.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in v)) throw new Error(`phrases: no value for {${k}}`);
    return String(v[k]);
  });
  return out;
}
export const say = (id: Id, lang: Lang, v: Slots = {}) => put(PHRASES[id][lang], v);

/** Digits as the page shows them: one decimal at most, none when whole. */
const num = (x: number) => String(Math.round(x * 10) / 10);
/** Distances: one decimal below 10 km, whole above. */
export const km = (x: number) => (x < 10 ? num(x) : String(Math.round(x)));
const visibility = (m: number) => (m >= 1000 ? `${num(m / 1000)} km` : `${Math.round(m)} m`);
const fromDir = (deg: number, lang: Lang) => FROM[lang][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const bandLabel = (b: Band, lang: Lang) => t(AQI_BAND_LABEL[b], lang);
const levelWord = (level: number, lang: Lang) => {
  const w = t(LEVEL_WORD[RISK_BANDS[level]], lang);
  return lang === "en" ? w.toLowerCase() : w;
};

/** The provenance sentence a weather value adds when the district grid stood in. */
const fallbackNote = (s: Provenance, lang: Lang) =>
  s.kind === "fallback" ? " " + say("fallback.grid", lang, { at: istClock(s.grid_at) }) : "";

// ── Surfaces ────────────────────────────────────────────────────────────────────────

/** One reading in words: the value, then how mugilu knows it. At most three sentences. */
export function factText(f: Fact, lang: Lang): string {
  switch (f.key) {
    case "air": {
      const value = say("air.value", lang, { band: BAND_PRED[f.band][lang], aqi: f.aqi });
      const s = f.source;
      if (s.kind === "measured")
        return `${value} ${say("air.measured", lang, { network: NETWORK[s.network] ?? s.network, station: s.station, km: km(s.km), at: istClock(s.at) })}`;
      if (s.kind === "modelled") return `${value} ${say("air.modelled", lang, { radius: s.radius_km ?? "" })}`;
      return value;
    }
    case "temp": {
      let out = say("temp.now", lang, { t: Math.round(f.temp_c), f: Math.round(f.feels_c) });
      const n = f.normal;
      if (n) {
        const id = n.delta_c > 0 ? "temp.above" : n.delta_c < 0 ? "temp.below" : "temp.same";
        out += ` ${say(id, lang, { max: n.max_c, d: Math.abs(n.delta_c), period: periodText(n.date, lang) })}`;
      }
      return out + fallbackNote(f.source, lang);
    }
    case "rain":
      return (
        (f.mm > 0 ? say("rain.some", lang, { mm: num(f.mm) }) : say("rain.none", lang)) + fallbackNote(f.source, lang)
      );
    case "wind":
      return say("wind.now", lang, {
        s: Math.round(f.speed_kmh),
        g: Math.round(f.gust_kmh),
        from: f.direction_deg == null ? "" : fromDir(f.direction_deg, lang),
      }).replace(/, ([.।])/, "$1");
    case "fog":
      return say(f.metres < 1000 ? "fog.fog" : "fog.clear", lang, { v: visibility(f.metres) });
    case "smoke": {
      const s = f.source.kind === "satellite" ? f.source : { radius_km: f.radius_km, window_h: 24 };
      const base = { r: s.radius_km, h: s.window_h };
      if (!f.count) return say("smoke.none", lang, base);
      const near = { ...base, km: f.nearest_km == null ? "" : km(f.nearest_km) };
      const seen = f.count === 1 ? say("smoke.one", lang, near) : say("smoke.many", lang, { ...near, n: f.count });
      return f.clean ? `${seen} ${say("smoke.clear", lang, { band: BAND_PRED[f.clean][lang] })}` : seen;
    }
    case "uv":
      return say("uv.now", lang, { uv: num(f.index), level: levelWord(f.level, lang) }) + fallbackNote(f.source, lang);
    case "dust":
      return (
        say("dust.now", lang, { d: Math.round(f.ugm3), level: levelWord(f.level, lang) }) + fallbackNote(f.source, lang)
      );
    case "warnings":
      return ""; // needs the place: warningsText
  }
}

/** The official warnings over a place: none, each one over the spot, and how many are near. */
export function warningsText(f: Extract<Fact, { key: "warnings" }>, place: string, lang: Lang): string {
  const parts = f.here.length
    ? f.here.map((w) =>
        say("warn.here", lang, {
          issuer: issuerName(w.issuer),
          colour: (COLOUR[w.color.toLowerCase()] ?? COLOUR[""])[lang],
          place,
          type: kindOf(w.headline, lang),
        }),
      )
    : [say("warn.none", lang, { place })];
  if (f.nearby.length)
    parts.push(
      f.nearby.length === 1
        ? say("warn.near.one", lang, { place })
        : say("warn.near.many", lang, { place, n: f.nearby.length }),
    );
  return parts.join(" ");
}

/** A warning's kind from its headline, as a sentence reads it ("heavy rain"). */
const kindOf = (headline: string, lang: Lang) =>
  lang === "en" ? t(warningLabel(headline), lang).toLowerCase() : t(warningLabel(headline), lang);

/** A place's past warnings (warnhistory.ts, newest first): how many since the archive began,
 *  by colour, most severe first, and the last one. */
export function pastWarningsText(list: PastAlert[], place: string, lang: Lang, now = Date.now()): string {
  const since = istDay(HISTORY_FROM);
  const days = [...warnedDays(list, now).values()];
  if (!list.length || !days.length) return say("warn.past.none", lang, { place, since });
  const split = (Object.keys(COLOUR_WORD) as Colour[])
    .map((c) => [c, days.filter((d) => d === c).length] as const)
    .filter(([, n]) => n)
    .map(([c, n]) => say("warn.past.on", lang, { colour: COLOUR_WORD[c][lang], n }))
    .join(", ");
  const last = list[0];
  return (
    say(days.length === 1 ? "warn.past.one" : "warn.past.many", lang, { place, since, n: days.length, split }) +
    " " +
    say("warn.past.last", lang, {
      colour: COLOUR[last.colour][lang],
      date: istDay(last.from),
      type: kindOf(last.headline, lang),
      issuer: last.office,
    })
  );
}

const get = <K extends Fact["key"]>(fs: Fact[], key: K) =>
  fs.find((f) => f.key === key) as Extract<Fact, { key: K }> | undefined;

/** The page's answer in two short sentences: the air, then the temperature, rain and warnings. */
export function answerLine(fs: Fact[], place: string, lang: Lang): string {
  const air = get(fs, "air");
  const temp = get(fs, "temp");
  const rain = get(fs, "rain");
  const warned = !!get(fs, "warnings")?.here.length;
  const first = air ? say("answer.air", lang, { place, band: BAND_PRED[air.band][lang], aqi: air.aqi }) : "";
  if (!temp) return first;
  const tc = Math.round(temp.temp_c);
  const second = warned
    ? say("answer.warned", lang, { t: tc })
    : rain && rain.mm > 0
      ? say("answer.rain", lang, { t: tc, mm: num(rain.mm) })
      : say("answer.calm", lang, { t: tc });
  return [first, second].filter(Boolean).join(" ");
}

/** The sentences for the API and MCP (`text`, spec step 5): the answer line and each reading's
 *  sentence, the words the page says, so an agent quoting mugilu quotes the page. */
export function conditionsText(
  c: Conditions,
  lang: Lang,
): { lang: Lang; answer: string; readings: Partial<Record<Fact["key"], string>> } {
  const fs = facts(c);
  // A named place by the name the page gives it: its native-script name on hi/kn, where it has one.
  const latin = placeLabel(c).split(", ")[0];
  const sp = placeBySlug(slugForName(latin) ?? "");
  const place = sp ? localName(sp, lang) : latin;
  const readings = Object.fromEntries(
    fs.map((f) => [f.key, f.key === "warnings" ? warningsText(f, place, lang) : factText(f, lang)]),
  );
  return { lang, answer: answerLine(fs, place, lang), readings };
}

/** The Google title: the place and its AQI, then as much as fits. hi/kn add the Latin name. */
export function placeTitle(fs: Fact[], place: string, latin: string, lang: Lang): string {
  const air = get(fs, "air");
  const tail = lang === "en" || latin === place ? " | mugilu" : ` | ${latin} | mugilu`;
  if (!air) return say("title.noair", lang, { place }) + tail;
  const v = { place, aqi: air.aqi, band: bandLabel(air.band, lang) };
  const fits = TITLES[lang].map((s) => put(s, v)).find((s) => s.length <= TITLE_MAX);
  return (fits ?? put(TITLES[lang].at(-1)!, v)) + tail;
}

/** The search description: the air with its source, the temperature, the calm summary, the
 *  update time. Middle parts drop first to fit DESCRIPTION_MAX. */
export function placeDescription(fs: Fact[], place: string, at: string, lang: Lang): string {
  const air = get(fs, "air");
  const temp = get(fs, "temp");
  const wind = get(fs, "wind");
  const rain = get(fs, "rain");
  const warned = !!get(fs, "warnings")?.here.length;
  const parts: string[] = [];
  if (air) {
    const s = air.source;
    const v = { place, aqi: air.aqi, band: bandLabel(air.band, lang) };
    parts.push(
      s.kind === "measured"
        ? say("desc.measured", lang, {
            ...v,
            at: istClock(s.at),
            network: NETWORK[s.network] ?? s.network,
            station: s.station,
          })
        : say("desc.modelled", lang, { ...v, radius: s.kind === "modelled" ? (s.radius_km ?? "") : "" }),
    );
  }
  if (temp) parts.push(say("desc.temp", lang, { t: Math.round(temp.temp_c) }));
  if (wind && !warned && !(rain && rain.mm > 0)) parts.push(say("desc.calm", lang, { s: Math.round(wind.speed_kmh) }));
  const updated = say("desc.updated", lang, { at: istClock(at) });
  while (parts.length > 1 && [...parts, updated].join(" ").length > DESCRIPTION_MAX) parts.pop();
  const out = [...parts, updated].join(" ");
  return out.length <= DESCRIPTION_MAX ? out : parts[0].slice(0, DESCRIPTION_MAX);
}

// ── The writing rules, as a check ───────────────────────────────────────────────────
export const STE_MAX_WORDS = 20;
const BANNED = /pollution level|\balert\b|—|\b\w+n't\b|\b\w+'(re|ll|ve|d|m)\b/i;

/** What breaks the writing rules in English text: long sentences, banned words, -ing openers. */
export function steProblems(text: string): string[] {
  const bad: string[] = [];
  for (const s of text.split(/(?<=[.?!])\s+/).filter(Boolean)) {
    const words = s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
    if (words > STE_MAX_WORDS) bad.push(`over ${STE_MAX_WORDS} words: ${s}`);
    if (BANNED.test(s)) bad.push(`banned word: ${s}`);
    if (/^\w+ing\b/.test(s) && !/^(During|Morning|Evening|Nothing)\b/.test(s)) bad.push(`-ing opener: ${s}`);
  }
  return bad;
}

// ── Questions ───────────────────────────────────────────────────────────────────────
const firstSentence = (s: string) => s.split(/(?<=[.।])\s+/)[0];

/** The questions people ask about a place, each answered from the facts. The persona answer
 *  uses the site's own advice (score.ts, exposure steps only) and says it is not medical advice. */
export function questions(fs: Fact[], place: string, lang: Lang): [q: string, a: string][] {
  const out: [string, string][] = [];
  const air = get(fs, "air");
  const temp = get(fs, "temp");
  const rain = get(fs, "rain");
  const warns = get(fs, "warnings");
  if (air) out.push([say("q.aqi", lang, { place }), factText(air, lang)]);
  if (warns)
    out.push([
      say("q.warn", lang, { place }),
      `${say(warns.here.length ? "a.yes" : "a.no", lang)} ${warningsText(warns, place, lang)} ${say("warn.source", lang)}`,
    ]);
  if (temp) out.push([say("q.temp", lang, { place }), factText(temp, lang)]);
  out.push([
    say("q.rain", lang, { place }),
    [rain ? factText(rain, lang) : "", say("nowcast", lang)].filter(Boolean).join(" "),
  ]);
  if (air) {
    // The site's persona rule (score.ts ambientMeaning): when the child's own trigger is raised,
    // keep the hazard's first sentence and add the child's exposure step.
    const advice = air.level ? ADVICE.Air[RISK_BANDS[air.level]] : undefined;
    const step = PERSONA_ACTION.child.Air;
    const answer =
      advice && step
        ? `${firstSentence(t(advice, lang))} ${t(step, lang)}`
        : say("child.calm", lang, { band: BAND_PRED[air.band][lang] });
    out.push([say("q.child", lang, { place }), `${answer} ${t("Informational only, not medical advice.", lang)}`]);
  }
  return out;
}
