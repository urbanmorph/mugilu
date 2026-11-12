// The same place on mugilu's sister sites, for a named place's page: its ward map on bharatlas (the cities that
// have one) and the species of its state on yellide. Plain links in the page, so readers and search engines follow
// them. Checked against both sites on 12 Nov 2026.
import { placeBySlug } from "./slugs";

/** mugilu city slug -> bharatlas ward layer (bharatlas.com/view/<layer>). */
const WARD_MAPS: Record<string, string> = {
  ahmedabad: "wards_ahmedabad",
  mumbai: "wards_mumbai",
  delhi: "wards_delhi",
  bengaluru: "wards_bengaluru_gba",
  hyderabad: "wards_hyderabad",
  chennai: "wards_chennai",
  kolkata: "wards_kolkata",
  pune: "wards_pune",
  thane: "wards_thane",
  surat: "wards_surat",
  vadodara: "wards_vadodara",
  bhubaneswar: "wards_bhubaneshwar",
  indore: "wards_indore",
  bhopal: "wards_bhopal",
  jaipur: "wards_jaipur",
  gurugram: "wards_gurugram",
  faridabad: "wards_faridabad",
  chandigarh: "wards_chandigarh",
  kochi: "wards_kochi",
  visakhapatnam: "wards_vizag",
  coimbatore: "wards_coimbatore",
  madurai: "wards_madurai",
  guwahati: "wards_guwahati",
  mysuru: "wards_mysuru",
  lucknow: "wards_lucknow",
  kanpur: "wards_kanpur",
  patna: "wards_patna",
};

/** yellide's state and union territory slugs (yellide.com/in/<slug>). */
const YELLIDE_STATES = [
  "andaman-nicobar",
  "andhra-pradesh",
  "arunachal-pradesh",
  "assam",
  "bihar",
  "chandigarh",
  "chhattisgarh",
  "dadra-nagar-haveli-daman-diu",
  "delhi",
  "goa",
  "gujarat",
  "haryana",
  "himachal-pradesh",
  "jammu-kashmir",
  "jharkhand",
  "karnataka",
  "kerala",
  "ladakh",
  "lakshadweep",
  "madhya-pradesh",
  "maharashtra",
  "manipur",
  "meghalaya",
  "mizoram",
  "nagaland",
  "odisha",
  "puducherry",
  "punjab",
  "rajasthan",
  "sikkim",
  "tamil-nadu",
  "telangana",
  "tripura",
  "uttar-pradesh",
  "uttarakhand",
  "west-bengal",
];

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);

/** A state's yellide slug: the one whose words are all in the name ("Andaman and Nicobar Islands" ->
 *  andaman-nicobar, "NCT of Delhi" -> delhi), the longest when several match; null for none. */
export function yellideState(state: string): string | null {
  const have = new Set(words(state));
  let best: string | null = null;
  for (const s of YELLIDE_STATES) {
    if (s.split("-").every((w) => have.has(w)) && (!best || s.length > best.length)) best = s;
  }
  return best;
}

export interface AroundLinks {
  city: string;
  state: string;
  /** the city's ward map on bharatlas, when there is one */
  wards?: string;
  /** the species of the state on yellide */
  species?: string;
}

/** The sister-site links for a named place, or null when the slug is not a named place. */
export function aroundLinks(slug: string): AroundLinks | null {
  const p = placeBySlug(slug);
  if (!p) return null;
  const st = p.state ? yellideState(p.state) : null;
  const out: AroundLinks = { city: p.name, state: p.state ?? "" };
  if (WARD_MAPS[slug]) out.wards = `https://bharatlas.com/view/${WARD_MAPS[slug]}`;
  if (st) out.species = `https://yellide.com/in/${st}`;
  return out;
}
