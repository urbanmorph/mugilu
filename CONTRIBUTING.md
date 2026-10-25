# Contributing

Thanks for your interest. This is a small project; contributions welcome.

## Setup

The product is one Cloudflare Worker in `apps/worker`. (`apps/site` is the retired static site from the OAQ days, kept for reference.)

```bash
pnpm install
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
# fill in OAQ_API_KEY and CLOUDFLARE_API_TOKEN
cd apps/worker
pnpm dev         # wrangler dev on http://localhost:8787
pnpm test        # the test suite
pnpm typecheck   # tsc --noEmit
```

## Ground rules
- Every page is plain HTML that reads without JavaScript. Client JS stays small and optional (the offline worker, install, auto-refresh, alerts).
- No frameworks: pages are rendered by the worker from template strings (`src/page.ts`).
- Copy is plain, short sentences; no em-dashes. Every user-facing string goes through `t()` with Hindi and Kannada in `src/i18n.ts`.
- No medical advice: exposure steps only, with the disclaimer on every surface.
- Write the failing test first. Conventional commits encouraged (`feat:`, `fix:`, `docs:`, `chore:`).

## Before opening a PR
- `pnpm typecheck` and `pnpm test` pass in `apps/worker`.
- `pnpm dlx prettier@3 --check "src/**/*.ts" "test/**/*.ts"` is clean.
- CI enforces all three; merging to `main` deploys automatically once they pass.
