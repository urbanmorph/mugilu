import { lp, t, type Lang } from "../i18n";
import { SITE_DESC } from "../hazards";
import { HOME_OG, shell } from "../ui/shell";
import { ABOUT_CSS } from "./about";

/** A real 404 page (the catch-all used to return 200 with a debug string). */
export function renderNotFound(lang: Lang = "en"): string {
  const gone = "That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate.";
  const lead =
    lang === "en"
      ? `That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate like <a href="/c/12.97,77.59">/c/12.97,77.59</a>.`
      : `${t(gone, lang)} <a href="${lp("/c/12.97,77.59", lang)}">/c/12.97,77.59</a>`;
  const body = `
  <h1 class="ahero">${t("Not here.", lang)}</h1>
  <p class="alead">${lead}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>`;
  return shell("Not found: mugilu", body, ABOUT_CSS, { desc: SITE_DESC, ogImage: HOME_OG, lang, wide: true });
}
