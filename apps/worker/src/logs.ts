// What a failure may say in the logs. Workers Logs keep everything the code prints,
// so a log line or thrown message names the source, the status and a short reason,
// never a URL (ours carry a visitor's coordinate, the OAQ broker signature or a
// browser's push address), a response body or a secret.

const MAX = 160;

/** A short, safe description of a failure: its kind and message, URLs removed. */
export function reason(e: unknown): string {
  const s = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return s.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<url>").slice(0, MAX);
}
