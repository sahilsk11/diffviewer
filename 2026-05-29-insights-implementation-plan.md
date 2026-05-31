# Insights Implementation Plan

## Goal

Wire file summaries and on-demand code explanations through real backend endpoints, cached by pull request revision, and replace the current frontend placeholder insight text.

## Phase 1: Backend Insight Contracts And Service

Status: DONE

- Add Pydantic models for file insight generation and code explanation requests/responses.
- Add an `InsightService` that validates pull request revisions, loads changed files, generates all file summaries concurrently, and caches completed results by owner/repo/pull number/base SHA/head SHA.
- Add explainer caching by owner/repo/pull number/base SHA/head SHA/path/side/start/end/selected code hash.
- Add an AI provider boundary with deterministic local fallback when no `OPENAI_API_KEY` is configured, so local tests and development still work without credentials.
- Use OpenAI Responses API structured outputs when credentials are present.

Notes:

- `InsightService` uses existing `PullRequestService` and `FileService` dependencies.
- A deterministic local provider is used when `OPENAI_API_KEY` is absent, so tests and local development do not require AI credentials.
- OpenAI integration is a raw HTTP Responses API provider with strict structured output.

## Phase 2: Backend Routes And Tests

Status: DONE

- Add `/api/repos/{owner}/{repo}/pulls/{pull_number}/insights/files`.
- Add `/api/repos/{owner}/{repo}/pulls/{pull_number}/insights/explain`.
- Register the route in the FastAPI app and dependency graph.
- Test stale revision rejection, cache reuse, parallel file generation, line-side content resolution, and selected-code fallback.

Notes:

- Route response uses `insights` as the file insight array.
- Backend tests cover cached batch generation, stale revision errors, selected-code explain requests, contents-derived explain requests, and service-level parallel generation.

## Phase 3: Frontend API And State Wiring

Status: DONE

- Add typed frontend insight contracts and API client methods.
- Replace placeholder file insight derivation with React Query-backed batch generation.
- Replace placeholder code explanations with the on-demand explainer endpoint.
- Preserve current selected-line UX and side mapping from additions/deletions to RIGHT/LEFT.

Notes:

- Frontend API client now has `generateFileInsights` and `explainCodeSelection`.
- Home page uses a disabled React Query for batch file insight generation, so summaries are generated only from the panel action and cached by PR revision.
- Explain uses the existing line action target and maps additions/deletions through the existing RIGHT/LEFT helper.

## Phase 4: Frontend UI States And Tests

Status: DONE

- Add generate, loading, ready, retry, and error states in the insights panel.
- Update interaction tests for generated file insights and backend-backed explanations.
- Keep existing keyboard/sidebar behavior intact.

Notes:

- Insights panel now has generate, loading, rendered, retry, and error paths.
- `HomePage.tsx` was split to keep the repo line-limit gate passing after the new state wiring.
- Focused frontend typecheck, lint, and interaction/API tests pass.

## Phase 5: Final Verification

Status: DONE

- Run backend tests.
- Run frontend typecheck, lint, tests, and build.
- Exercise the new backend endpoints through a local API client or server.
- Exercise the frontend flow in a browser or equivalent UI harness.

## Final Self-Verification

- Backend: `uv run ruff check .`, `uv run pyright src tests`, and `uv run pytest` passed with 28 tests.
- Frontend: `npm run typecheck -- --pretty false`, `npm run lint`, `npm run test`, and `npm run build` passed with 42 tests.
- API probe: local uvicorn server handled `/healthz`, PR load for `sahilsk11/diffviewer#2`, `/insights/files`, and `/insights/explain`; local fallback provider returned structured JSON.
- Browser probe: desktop 1440x1000 and mobile 390x844 opened `/diff?pr=https%3A%2F%2Fgithub.com%2Fsahilsk11%2Fdiffviewer%2Fpull%2F2`, generated file summaries from the UI, rendered the summary panel, and reported no browser page errors.
