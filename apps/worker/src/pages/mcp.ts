import { esc } from "../html";
import { lp, t, type Lang } from "../i18n";
import { HAZARDS, HAZARDS_SHORT } from "../hazards";
import { TOOLS } from "../mcptools";
import { HOME_OG, SITE, shell, withToc } from "../ui/shell";
import { icon } from "./read";
import { ABOUT_CSS } from "./about";

/** Glass-box methodology: how the Ambient read is computed, with the public
 *  thresholds (the "Algorithmic transparency" PDGI commitment, made auditable). */
/** /mcp in a browser (the about page links it): how to connect an AI assistant, and the tools. MCP clients
 *  POST to the same address; mcp.ts sends only a GET that asks for HTML here. English, like /display. */
export function renderMcpPage(lang: Lang = "en"): string {
  const endpoint = `${SITE}/mcp`;
  // each tool's first sentence, from the list the server itself answers with, so this page can't drift from it
  const lead = (d: string) => {
    const first = d.split(". ")[0].replace(/\.$/, "");
    return first.length > 120 ? first.split(": ")[0] : first; // a long first sentence: just its opening clause
  };
  const tools = TOOLS.map(
    (x) => `<li><span class="t"><code>${x.name}</code>: ${esc(lead(x.description))}.</span></li>`,
  ).join("\n    ");
  const body = `<article class="ax">
  <h1 class="ahero">mugilu MCP server for AI assistants</h1>
  <p class="alead">Ask Claude, Cursor or any MCP client what the sky over a place in India is doing right now: ${HAZARDS}. No key, no install, read only.</p>

  <p class="ah">${icon("code")}<span>Connect</span></p>
  <p class="atext">The server address (JSON-RPC 2.0 over Streamable HTTP, protocol 2025-06-18):</p>
  <p class="abuild"><code>${endpoint}</code></p>
  <ul class="alist">
    <li><span class="t"><b>Claude or Cursor:</b> add <code>${endpoint}</code> as a custom connector.</span></li>
    <li><span class="t"><b>Claude Code:</b> <code>claude mcp add --transport http mugilu ${endpoint}</code></span></li>
    <li><span class="t"><b>MCP Inspector:</b> <code>npx @modelcontextprotocol/inspector --cli ${endpoint} --transport http --method tools/list</code></span></li>
  </ul>
  <p class="atext">Then ask, for example, "is it safe for my asthmatic kid to play outside in Indiranagar right now?"</p>

  <p class="ah">${icon("layers")}<span>Tools</span></p>
  <ul class="alist">
    ${tools}
  </ul>
  <p class="atext">Every answer carries its sources and a disclaimer; please show them. It is listed in the official MCP Registry as <code>io.github.sathya-sankaran/mugilu</code>. Machine-readable: <a href="/.well-known/mcp.json">/.well-known/mcp.json</a> and <a href="/llms.txt">llms.txt</a>; the code is on <a href="https://github.com/urbanmorph/mugilu">GitHub</a>.</p>

  <p class="adisc">${t("Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.", lang)}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>`;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: "mugilu MCP server",
    description:
      "A remote MCP server (Streamable HTTP, no key, read only) for what the sky over a place in India is doing right now.",
    url: endpoint,
    documentation: endpoint,
    isAccessibleForFree: true,
    provider: { "@type": "Organization", name: "Urban Morph", url: "https://urbanmorph.com" },
  });
  return shell("MCP server for AI assistants: mugilu", withToc(body, lang), ABOUT_CSS, {
    desc: `Connect Claude, Cursor or any MCP client to mugilu: live ${HAZARDS_SHORT} for any place in India. No key, read only.`,
    canonical: endpoint,
    jsonLd,
    ogImage: HOME_OG,
    lang,
    wide: true,
  });
}
