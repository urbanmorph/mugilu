// How long each load holds up a page built for the edge cache (W5 in
// supporting-docs/platform-audit-tracker-2026-11-24.md): each one's finish time, in ms since
// the build began, as a Server-Timing header and one Workers Logs line. In a Worker the clock
// moves across I/O, which is what these measure.

export class Timings {
  private readonly t0 = Date.now();
  private readonly done = new Map<string, number>();
  private readonly failed = new Set<string>();

  /** Notes when `p` settles; its result or failure passes through unchanged. */
  track<T>(name: string, p: Promise<T> | T): Promise<T> {
    return Promise.resolve(p).then(
      (v) => (this.mark(name), v),
      (e) => {
        this.mark(name);
        this.failed.add(name);
        throw e;
      },
    );
  }

  /** Notes that a step ended now (e.g. the render). */
  mark(name: string): void {
    this.done.set(name, Date.now() - this.t0);
  }

  /** Each step's finish time, in the order they were noted. */
  line(): Record<string, number> {
    return Object.fromEntries(this.done);
  }

  /** The Server-Timing value, with the edge location that built the page. */
  header(colo?: string): string {
    const parts = [...this.done].map(([k, ms]) => `${k};dur=${ms}${this.failed.has(k) ? ';desc="failed"' : ""}`);
    if (colo) parts.push(`edge;desc="${colo.replace(/[^A-Z0-9]/gi, "")}"`);
    return parts.join(", ");
  }
}
