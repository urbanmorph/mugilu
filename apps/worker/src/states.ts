import type { Lang } from "./i18n";
import { slugify, slugPlacesByState, type SlugPlace } from "./slugs";

// The states and Union Territories, each with a hub page at /state/{slug} (pages/state.ts). The
// names are as the place grid spells them (LGD via bharatlas), and in Hindi and Kannada as
// their governments and the national press write them.

const NAMES: Record<string, { hi: string; kn: string }> = {
  "Andaman & Nicobar": { hi: "अंडमान और निकोबार", kn: "ಅಂಡಮಾನ್ ಮತ್ತು ನಿಕೋಬಾರ್" },
  "Andhra Pradesh": { hi: "आंध्र प्रदेश", kn: "ಆಂಧ್ರ ಪ್ರದೇಶ" },
  "Arunachal Pradesh": { hi: "अरुणाचल प्रदेश", kn: "ಅರುಣಾಚಲ ಪ್ರದೇಶ" },
  Assam: { hi: "असम", kn: "ಅಸ್ಸಾಂ" },
  Bihar: { hi: "बिहार", kn: "ಬಿಹಾರ" },
  Chandigarh: { hi: "चंडीगढ़", kn: "ಚಂಡೀಗಢ" },
  Chhattisgarh: { hi: "छत्तीसगढ़", kn: "ಛತ್ತೀಸಗಢ" },
  "Dadra,Nagar Haveli,Daman & Diu": {
    hi: "दादरा और नगर हवेली और दमन और दीव",
    kn: "ದಾದ್ರಾ ಮತ್ತು ನಗರ ಹವೇಲಿ ಮತ್ತು ದಮನ್ ಮತ್ತು ದಿಯು",
  },
  Delhi: { hi: "दिल्ली", kn: "ದೆಹಲಿ" },
  Goa: { hi: "गोवा", kn: "ಗೋವಾ" },
  Gujarat: { hi: "गुजरात", kn: "ಗುಜರಾತ್" },
  Haryana: { hi: "हरियाणा", kn: "ಹರಿಯಾಣ" },
  "Himachal Pradesh": { hi: "हिमाचल प्रदेश", kn: "ಹಿಮಾಚಲ ಪ್ರದೇಶ" },
  "Jammu & Kashmir": { hi: "जम्मू और कश्मीर", kn: "ಜಮ್ಮು ಮತ್ತು ಕಾಶ್ಮೀರ" },
  Jharkhand: { hi: "झारखंड", kn: "ಜಾರ್ಖಂಡ್" },
  Karnataka: { hi: "कर्नाटक", kn: "ಕರ್ನಾಟಕ" },
  Kerala: { hi: "केरल", kn: "ಕೇರಳ" },
  Ladakh: { hi: "लद्दाख", kn: "ಲಡಾಖ್" },
  Lakshadweep: { hi: "लक्षद्वीप", kn: "ಲಕ್ಷದ್ವೀಪ" },
  "Madhya Pradesh": { hi: "मध्य प्रदेश", kn: "ಮಧ್ಯ ಪ್ರದೇಶ" },
  Maharashtra: { hi: "महाराष्ट्र", kn: "ಮಹಾರಾಷ್ಟ್ರ" },
  Manipur: { hi: "मणिपुर", kn: "ಮಣಿಪುರ" },
  Meghalaya: { hi: "मेघालय", kn: "ಮೇಘಾಲಯ" },
  Mizoram: { hi: "मिज़ोरम", kn: "ಮಿಜೋರಾಂ" },
  Nagaland: { hi: "नागालैंड", kn: "ನಾಗಾಲ್ಯಾಂಡ್" },
  Odisha: { hi: "ओडिशा", kn: "ಒಡಿಶಾ" },
  Puducherry: { hi: "पुडुचेरी", kn: "ಪುದುಚೇರಿ" },
  Punjab: { hi: "पंजाब", kn: "ಪಂಜಾಬ್" },
  Rajasthan: { hi: "राजस्थान", kn: "ರಾಜಸ್ಥಾನ" },
  Sikkim: { hi: "सिक्किम", kn: "ಸಿಕ್ಕಿಂ" },
  "Tamil Nadu": { hi: "तमिलनाडु", kn: "ತಮಿಳುನಾಡು" },
  Telangana: { hi: "तेलंगाना", kn: "ತೆಲಂಗಾಣ" },
  Tripura: { hi: "त्रिपुरा", kn: "ತ್ರಿಪುರಾ" },
  "Uttar Pradesh": { hi: "उत्तर प्रदेश", kn: "ಉತ್ತರ ಪ್ರದೇಶ" },
  Uttarakhand: { hi: "उत्तराखंड", kn: "ಉತ್ತರಾಖಂಡ" },
  "West Bengal": { hi: "पश्चिम बंगाल", kn: "ಪಶ್ಚಿಮ ಬಂಗಾಳ" },
};

export interface State {
  slug: string;
  name: string;
  places: SlugPlace[];
}

let memo: Map<string, State> | undefined;
const states = () =>
  (memo ??= new Map(
    slugPlacesByState()
      .filter((g) => g.state !== "Other")
      .map((g) => [slugify(g.state), { slug: slugify(g.state), name: g.state, places: g.places }]),
  ));

/** Every state and UT with places, A to Z. */
export const allStates = (): State[] => [...states().values()];
export const stateBySlug = (slug: string): State | undefined => states().get(slug);
/** The hub of the state a place is in. */
export const stateOf = (name: string | undefined): State | undefined =>
  name ? states().get(slugify(name)) : undefined;
/** A state's name in the page's language. */
export const stateName = (name: string, lang: Lang): string => (lang === "en" ? name : (NAMES[name]?.[lang] ?? name));

/** The states with a hub page: more than one place (one place: its own page is the hub). */
export const allHubs = (): State[] => allStates().filter((s) => s.places.length > 1);
/** The hub of a state, by its name, when it has one. */
export const hubOf = (name: string | undefined): State | undefined => {
  const st = stateOf(name);
  return st && st.places.length > 1 ? st : undefined;
};
