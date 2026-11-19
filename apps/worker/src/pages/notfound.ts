import { esc } from "../html";
import { lp, t, type Lang } from "../i18n";
import { SITE_DESC } from "../hazards";
import { HOME_OG } from "../ui/shell";
import { pageShell } from "../ui/page-shell";
import { backLink, comboboxJs, ico, searchBox, wrap } from "../ui/components";

/** A real 404 page (the catch-all used to return 200 with a debug string), with the place
 *  search, so a wrong link still gets you to a sky. */
export function renderNotFound(lang: Lang = "en"): string {
  const gone = "That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate.";
  const example = `<a href="${lp("/c/12.97,77.59", lang)}">/c/12.97,77.59</a>`;
  const lead =
    lang === "en"
      ? `That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate like ${example}.`
      : `${esc(t(gone, lang))} ${example}`;
  const body = wrap(
    `<section class="nf">${ico("turn")}<h1 class="t-title">${esc(t("Not here.", lang))}</h1><p class="t-lead">${lead}</p>` +
      searchBox({
        id: "nq",
        label: t("Look up a place in India", lang),
        placeholder: t("A place in India, or lat,lon", lang),
        showLabel: true,
        action: lp("/go", lang),
        button: t("Look up a place in India", lang),
        buttonIcon: "arrow",
      }) +
      backLink(lp("/", lang), `← ${t("back to mugilu", lang)}`) +
      `</section>`,
  );
  return pageShell(`${t("Not here.", lang).replace(/\.$/, "")}: mugilu`, body, {
    path: "/404",
    desc: t(SITE_DESC, lang),
    ogImage: HOME_OG,
    lang,
    js: comboboxJs("nq", lang),
  });
}
