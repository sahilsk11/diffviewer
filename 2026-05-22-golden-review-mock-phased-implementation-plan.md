# Golden Review Mock Phased Implementation Plan

## Context

Implement Layer 0 for diffviewer: a static reviewer-first PR workspace using real fixture data. The repository has no commits yet, so the work will proceed in place at `/home/sahil/projects/diffviewer` instead of a separate worktree.

Primary fixture: `sahilsk11/friday#37`.
Secondary fixture: `sahilsk11/overwatch#9`.

## Phase 1: Project Scaffold And Fixture Pipeline

Status: DONE

Create a maintainable frontend scaffold and a fixture generation path that can export GitHub PR data without runtime token handling.

Expected work:

- Add a Vite React TypeScript app with basic scripts.
- Add a fixture generation script that shells through `gh` to capture PR JSON metadata and raw diff text.
- Generate fixtures for `friday#37` and `overwatch#9`.
- Keep generated data under source control-friendly fixture files.
- Document the fixture workflow in the README.

Validation:

- Install dependencies.
- Generate fixtures successfully with local `gh` auth.
- Run type/build checks available after scaffold.

Result:

- Added Vite React TypeScript scaffold, fixture generator, and generated `friday#37` / `overwatch#9` fixtures.
- `npm install`, `npm run fixtures:generate:golden`, and `npm run build` passed.
- Discovery: repository has no base commit; work is proceeding in place.

## Phase 2: Review Data Model And Curated Analysis

Status: DONE

Create a typed data layer that separates raw GitHub facts from curated reviewer analysis.

Expected work:

- Define TypeScript types for PR fixtures, changed files, evidence references, review areas, reviewer questions, risk callouts, rationale blocks, and confidence/fact/inference states.
- Add curated analysis for `friday#37` with claim-to-evidence links.
- Add lighter curated analysis for `overwatch#9` to prove the design handles small PRs.
- Add helpers that combine raw fixtures and analysis fixtures into a view model for the app.

Validation:

- Typecheck the data model and fixtures.
- Ensure evidence references resolve to known files/comments/diff anchors where practical.

Result:

- Added typed raw fixture, diff, analysis, and view-model data modules.
- Added curated analysis for `friday#37` and a smaller `overwatch#9` analysis fixture.
- Added `npm run validate:data`; `npm run validate:data` and `npm run build` passed.
- Limitation: evidence validation checks files, exact hunk headers, comment IDs, commit OIDs, and analysis evidence IDs; it does not yet validate exact changed-line positions.

## Phase 3: Static Review Workspace UI

Status: DONE

Build the static reviewer workspace that prioritizes review intent over raw file order.

Expected work:

- Implement a dense app shell with PR switcher, PR status, changed area navigation, reviewer questions, rationale/evidence panels, risk/test gaps, and raw diff access.
- Present fact, inference, and unknown states clearly.
- Keep raw diff inspectable but secondary.
- Make the layout responsive enough for desktop and mobile inspection.
- Use icons for controls where helpful and avoid marketing-style landing page treatment.

Validation:

- Typecheck and build.
- Manual browser inspection of the running app.

Result:

- Replaced the Phase 2 summary page with a dense static reviewer workspace.
- Added PR switching, status metrics, changed-area navigation, reviewer questions, rationale/evidence, risk/test-gap panels, evidence health, and secondary raw diff inspection.
- Exposed raw diff text through the typed review view model so the UI can inspect complete fixture patches.
- Added `lucide-react` for lightweight control and panel icons.
- `npm run validate:data` and `npm run build` passed.
- Browser inspection passed on desktop 1440x1000 and mobile 390x844 via the running Vite app at `http://127.0.0.1:5173/`; both fixtures rendered, PR switching worked, raw diff text opened, no console/page errors were reported, and no horizontal overflow was detected.

## Phase 4: Integrated Verification And Polish

Status: DONE

Verify the actual Layer 0 behavior and clean up rough edges found during use.

Expected work:

- Run lint/type/build checks.
- Start the dev server.
- Use browser verification against desktop and mobile viewports.
- Fix visual overlap, broken navigation, missing evidence links, and any blank or unusable states.
- Record final verification results in this plan.

Validation:

- Build passes.
- Browser checks prove the golden review mock renders and is navigable for both fixtures.

Result:

- `npm run validate:data` passed.
- `npm run build` passed.
- Confirmed the Vite dev server is available at `http://127.0.0.1:5173/`.
- Used `agent-browser` desktop viewport 1440x1000 and mobile viewport 390x844.
- Exercised PR switching from `friday#37` to `overwatch#9`.
- Verified the changed-area navigation, reviewer workspace, risk/test-gap panel, evidence health panel, and raw diff section render for both fixtures.
- Captured screenshots:
  - `/tmp/diffviewer-desktop-final.png`
  - `/tmp/diffviewer-mobile-final.png`
- Checked document width against viewport width on desktop and mobile; no horizontal overflow detected.
- Browser console contained only Vite/React development informational messages; no page errors were reported.

## Final Verification

Status: DONE

Record the commands and browser checks used after all phases are complete.

Final result:

- Layer 0 product scope is implemented: a static golden PR review mock backed by real GitHub fixture data and curated reviewer analysis.
- This implementation intentionally does not include later product layers: live GitHub fetching, token entry, server-held authentication, hosting, GitHub comment publishing, persistent accounts, or AI analysis automation.
- Verification commands:
  - `npm run validate:data`
  - `npm run build`
  - `agent-browser` desktop and mobile sessions against `http://127.0.0.1:5173/`
