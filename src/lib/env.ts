// Single source of truth for runtime config. Empty means same-origin
// requests, so the browser calls `/api/...` and Vite or the production
// host can proxy that path to the backend.
//
// Resolution order:
//   1. import.meta.env.VITE_API_BASE_URL — inlined at build time, also
//      readable in dev. Set via .env, .env.local, or per-process env.
//   2. Same-origin relative URLs.
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const trimmed = raw.replace(/\/$/, '');

export const apiBaseUrl = trimmed;
