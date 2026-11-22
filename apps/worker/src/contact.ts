// mugilu's public contact for privacy requests and reports of wrong, harmful or illegal content
// (/terms, CODE_OF_CONDUCT.md, SECURITY.md). Empty until the owner sets one: the GitHub issues
// page stands in, so every report still has a route.
export const CONTACT_EMAIL = "";
export const ISSUES_URL = "https://github.com/urbanmorph/mugilu/issues";

/** The contact as a link: the email when there is one, else the issues page. */
export const contactLink = (): string =>
  CONTACT_EMAIL
    ? `<a href="mailto:${CONTACT_EMAIL}" lang="en">${CONTACT_EMAIL}</a>`
    : `<a href="${ISSUES_URL}" lang="en">github.com/urbanmorph/mugilu/issues</a>`;
