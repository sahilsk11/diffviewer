# frontend

Opinionated React SPA template. Distilled from the `factorbacktest/frontend-v2`
scaffolding so a new project starts with the lint/structure posture instead of
growing into it.

## Stack

- Vite + React 19 + TypeScript (strict, project references, `@/*` path alias)
- Tailwind v4 with design tokens in `src/styles/globals.css` via `@theme`
- Geist Sans + Geist Mono via `@fontsource-variable`
- React Router v7
- TanStack Query for data fetching, behind a typed `apiClient` (`src/lib/api.ts`)
- Local UI primitives shaped like shadcn components (`cn()`, CVA variants, Radix Slot)
- Lucide icons for UI actions and status
- ESLint flat config (strict bug-class rules) + Prettier
- Vitest + Testing Library for component and integration tests

## Folder layout

```
src/
  components/
    ui/        # Reusable primitives (Button, Card, Input, ...)
    layout/    # App shell (RootLayout, Navbar, ...)
  lib/         # Cross-cutting code: api client, env, format, theme, utils
  pages/
    <Page>/    # One folder per route. Page-local components live here.
  styles/      # Global CSS + design tokens
  test/        # Test setup and provider-aware render helpers
  types/       # Hand-written types (e.g. API contracts)
  App.tsx      # Route table
  main.tsx     # App bootstrap (providers + render)
```

Page-local components live next to the page that owns them; promote to
`components/ui` only when a second page reuses them. This keeps the shared
component dir small and discoverable.

## Component posture

This template is local-primitives first. It borrows the parts of the shadcn
model that help agents produce consistent React code, but shadcn is not the
default workflow:

- Shared primitives live in `src/components/ui` and use the same conventions
  many agents already know: `cn()`, `class-variance-authority`, `forwardRef`,
  `asChild` where useful, and small variant sets.
- Prefer extending the local primitives over generating a component dump.
- `components.json` is present only as an escape hatch. Use
  `npx shadcn@latest add <component>` when a downstream app needs a complex
  accessible primitive such as a dialog, popover, menu, combobox, or tabs.
- Icons come from `lucide-react`. Do not hand-roll SVG icons unless a product
  mark or custom visualization requires it.
- Keep screen-specific composition under `src/pages/<Page>/`. Promote to
  `components/ui` only after a second real use.
- Avoid nested cards, decorative gradients, and oversized marketing sections for
  operational apps. Start with the actual app surface.

## Configuration

| Variable            | Purpose                                                                               | Default |
| ------------------- | ------------------------------------------------------------------------------------- | ------- |
| `VITE_API_BASE_URL` | Optional absolute backend URL override. Leave empty for same-origin `/api` calls.     | empty   |
| `PORT`              | Port the dev / preview server binds to. `strictPort: true` — taken ports fail loudly. | `3000`  |

Resolution order: per-process env → `.env.local` → `.env` → same-origin
defaults in `src/lib/env.ts`. Both `.env*` files are gitignored; copy
`.env.example` to opt in.

Because Vite exposes `VITE_*` values to browser code, never put secrets in them.
Changing `VITE_API_BASE_URL` in production requires rebuilding the frontend.
Keep it empty when the app is served behind the same host as the backend.

## Scripts

```bash
npm run dev           # local dev server on :3000; proxies /api to :8000
npm run build         # tsc -b && vite build → dist/
npm run preview       # serve the production build
npm run typecheck     # tsc project-references
npm run lint          # eslint, fails on any warning (--max-warnings 0)
npm run lint:fix      # auto-fix what ESLint can
npm test              # Vitest + Testing Library once
npm run test:watch    # Vitest watch mode
npm run format        # prettier --write .
npm run format:check  # prettier --check . (CI uses this)
```

CI runs install, typecheck, lint, format check, tests, and build against the
Node version pinned in `.node-version`.

## Deployment

Production deploys are handled by `.github/workflows/deploy.yml`. The workflow
runs after the `frontend` workflow succeeds on `main`, and it can also be run
manually with `workflow_dispatch`.

The deploy workflow creates the GitHub Deployment record with the built-in
`GITHUB_TOKEN`, then calls the SAS DiffViewer deployment API with a repo-scoped
bearer token. SAS owns the host-side deploy and returns job status for polling;
this repo does not shell into SAS or depend on SAS implementation details beyond
the two API endpoints.

Required repository configuration:

| Name                            | Type     | Purpose                                              |
| ------------------------------- | -------- | ---------------------------------------------------- |
| `SAS_DIFFVIEWER_DEPLOY_API_URL` | Variable | Base URL for the SAS deploy API.                     |
| `SAS_DIFFVIEWER_DEPLOY_TOKEN`   | Secret   | Bearer token for the `diffviewer-deploy` SAS caller. |

The workflow grants `GITHUB_TOKEN` only `contents: read` and
`deployments: write`. It uses a stable idempotency key of
`diffviewer:production:<sha>` and a `diffviewer-production` concurrency group so
mainline deploy attempts do not overlap.

## Backend

The optional backend lives in `backend/` and exposes the GitHub-backed diff
API used by this template.

```bash
cd backend
uv sync
uv run uvicorn diffviewer_api.main:create_app --factory --reload --port 8000
uv run pytest
uv run ruff check .
uv run pyright
```

Backend configuration is read from environment variables or `backend/.env`.
Copy `backend/.env.example` when local overrides are needed.

| Variable                    | Purpose                                     | Default                            |
| --------------------------- | ------------------------------------------- | ---------------------------------- |
| `GITHUB_TOKEN` / `GH_TOKEN` | Server-side GitHub token for private repos. | local credential fallback          |
| `GITHUB_API_BASE_URL`       | GitHub REST API base URL.                   | `https://api.github.com`           |
| `DIFFVIEWER_DB_PATH`        | SQLite path for per-file review state.      | `~/.diffviewer/diffviewer.sqlite3` |
| `DIFFVIEWER_CORS_ORIGINS`   | Comma-separated allowed frontend origins.   | `http://localhost:3000`            |

Do not expose GitHub tokens as `VITE_*` variables. They belong only in the
backend process. If no token env var is set, local development checks common
machine credentials in this order: `/etc/<user>/secrets.env`,
`/etc/sas/secrets.env`, `/etc/sas-system/secrets.env`,
`~/.config/gh/hosts.yml`, then `~/.git-credentials`.

## Lint posture

The full rule set lives in `eslint.config.js`. Headline rules:

- **`max-lines: 700`** per file — hard structural cap. Combined with
  `import-x/no-cycle`, this is the backbone that prevents 1000-line god
  components.
- **`--max-warnings 0` in CI** — warnings are errors at the pipeline boundary.
  No "warn that nobody reads" tier; if a rule isn't worth blocking on, it isn't
  on.
- **`no-restricted-syntax: fetch`** — raw `fetch` is forbidden outside
  `src/lib/api.ts`. Every call site goes through `apiClient`, which owns
  credentials, JSON parsing, and the error shape.
- **Bug-class rules**: `no-floating-promises`, `no-misused-promises`,
  `consistent-type-imports`, `switch-exhaustiveness-check`,
  `react-hooks/exhaustive-deps`, `import-x/no-cycle`,
  `unused-imports/no-unused-imports`.
- **Style is owned by Prettier** — `eslint-config-prettier` is loaded last
  and disables any ESLint rule that would fight it. Keep formatting concerns
  out of the rule list.

## API pattern

```ts
import { apiClient, isApiError } from '@/lib/api';

const data = await apiClient.get<MyResponse>('/some/path');
```

`apiClient` always sends `credentials: 'include'` for cookie-based sessions —
drop it in `src/lib/api.ts` if your backend uses bearer tokens or doesn't need
cookies. `apiUrl()` enforces leading `/`. Errors are thrown as `ApiError` with
`status` + parsed `body`; narrow with `isApiError(err)`.

## Path alias

`@/*` resolves to `src/*` in both Vite (via `tsconfigPaths`) and `tsc` (via
`tsconfig.app.json`). Prefer `@/lib/foo` over deep relative paths.

## What's intentionally not in here

- Auth — wire to your backend's session/JWT pattern. The legacy
  `factorbacktest/frontend-v2` has a working cookie-session example.
- State management beyond React Query + local state.
- Animation library (was Framer Motion in the source repo).
- E2E runner — add Playwright when a project has real user flows worth
  protecting. Hit `npm run preview` with Playwright's `webServer`.

Add these one at a time when a real use case shows up, not preemptively.
