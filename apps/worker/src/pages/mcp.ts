import { esc } from "../html";
import { t, type Lang } from "../i18n";
import { HAZARDS, HAZARDS_SHORT } from "../hazards";
import { TOOLS } from "../mcptools";
import { SITE } from "../ui/shell";
import { cardGrid, cardStack, ico, pull, type IconName } from "../ui/components";
import { P, textPage } from "./text";

// /mcp in a browser (the about page links it): how to connect an AI assistant, and the tools.
// MCP clients POST to the same address; mcp.ts sends only a GET that asks for HTML here.
// The copy is English (like the tool descriptions it shows); the frame is localised.

/** Each tool's pictogram. */
const TOOL_ICON: Record<string, IconName> = {
  conditions_at: "cloud",
  search_place: "question",
  nearest_stations: "target",
  active_warnings: "warn",
  national_now: "ruler",
};

/** A tool's first sentence, from the list the server answers with, so this page can't drift
 *  from it (a long first sentence: just its opening clause). */
const lead = (d: string) => {
  const first = d.split(". ")[0].replace(/\.$/, "");
  return first.length > 120 ? first.split(": ")[0] : first;
};

export function renderMcpPage(lang: Lang = "en"): string {
  const endpoint = `${SITE}/mcp`;
  const code = (s: string) => `<code class="code">${esc(s)}</code>`;
  const setup = cardStack(
    [
      `<p><b>Claude or Cursor:</b></p><p>add <code>${endpoint}</code> as a custom connector.</p>`,
      `<p><b>Claude Code:</b></p>${code(`claude mcp add --transport http mugilu ${endpoint}`)}`,
      `<p><b>MCP Inspector:</b></p>${code(`npx @modelcontextprotocol/inspector --cli ${endpoint} --transport http --method tools/list`)}`,
    ],
    { c1: true },
  );
  const tools = cardGrid(
    TOOLS.map(
      (x) =>
        `<p class="t-value">${ico(TOOL_ICON[x.name] ?? "tool")}<code>${esc(x.name)}</code></p>${P(`${esc(lead(x.description))}.`)}`,
    ),
  );
  const listed = cardGrid(
    [
      P("Every answer carries its sources and a disclaimer; please show them."),
      P("It is listed in the official MCP Registry as <code>io.github.sathya-sankaran/mugilu</code>."),
      P(
        `Machine-readable: <a href="/.well-known/mcp.json">/.well-known/mcp.json</a> and <a href="/llms.txt">llms.txt</a>; the code is on <a href="https://github.com/urbanmorph/mugilu">GitHub</a>.`,
      ),
    ],
    3,
    true,
  );
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
  return textPage({
    path: "/mcp",
    lang,
    title: `${t("MCP server for AI assistants", lang)}: mugilu`,
    desc: t(
      "Connect Claude, Cursor or any MCP client to mugilu: live {hazards} for any place in India. No key, read only.",
      lang,
    ).replace("{hazards}", t(HAZARDS_SHORT, lang)),
    contentLang: "en",
    canonical: endpoint,
    jsonLd,
    kicker: t("MCP server", lang),
    h1: "mugilu MCP server for AI assistants",
    lead: `Ask Claude, Cursor or any MCP client what the sky over a place in India is doing right now: ${HAZARDS}. No key, no install, read only.`,
    sections: [
      {
        id: "connect",
        title: "Connect",
        icon: "plug",
        body:
          P("The server address (JSON-RPC 2.0 over Streamable HTTP, protocol 2025-06-18):") +
          `<div class="addr"><code>${endpoint}</code></div>` +
          setup +
          pull('Then ask, for example, "is it safe for my asthmatic kid to play outside in Indiranagar right now?"'),
      },
      { id: "tools", title: "Tools", icon: "tool", body: tools + listed },
    ],
  });
}
