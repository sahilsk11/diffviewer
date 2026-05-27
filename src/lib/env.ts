// Single source of truth for runtime config. Always-absolute base URL:
// the same code path runs in `vite dev`, `vite preview`, production
// builds, and any e2e harness. No dev proxy, no NODE_ENV branching.
//
// Resolution order:
//   1. import.meta.env.VITE_API_BASE_URL — inlined at build time, also
//      readable in dev. Set via .env, .env.local, or per-process env.
//   2. http://localhost:8000 — change this default to whatever the
//      typical local backend port is for your app.
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const trimmed = raw.replace(/\/$/, '');

export const apiBaseUrl = trimmed || 'http://localhost:8000';
