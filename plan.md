# Diffviewer V1 Plan

## Decision

Diffviewer V1 is diff-first.

The root artifact is still the code diff. The product should not pull reviewers away from line-by-line review into dashboards, scores, gauges, AI verdicts, or subjective summaries. The first useful version is a high-quality diff viewer with objective, author-supplied explanations attached to exact diff segments.

## Visual Direction

Use `@pierre/diffs` as the rendering foundation and follow the visual language of diffs.com:

- Sparse page chrome around the review.
- Pitch-black diff surfaces.
- Dense, readable code.
- Red and green change regions.
- Small controls.
- Inline comments and annotations that augment the diff instead of replacing it.
- Mobile-friendly stacked review where the PR description comes first and the code remains the main surface.

Reference sources:

- https://diffs.com/
- https://diffs.com/docs
- https://www.npmjs.com/package/@pierre/diffs

## Product Shape

The page should be one consolidated pull request review:

1. PR description at the top.
2. Minimal review controls: split/stacked layout, annotation visibility, file filter.
3. Consolidated diff below.
4. Segment explanations attached to exact lines or hunks.
5. A compact side panel on desktop that lists the same segment explanations and jumps the reviewer back to code.
6. On mobile, explanations should appear inline beneath the relevant diff lines or as compact cards between file sections.

## Metadata Contract

Every submitted PR should include a sidecar metadata file. The metadata should explain intent only where it can be attached to a concrete diff segment.

The schema should avoid review grades, risk scores, broad summaries, or inferred judgments. It should prefer objective implementation context:

```json
{
  "pr": {
    "title": "Replace press-and-hold voice turns with explicit Start and Send controls",
    "description": "Why this change exists, copied from the PR body.",
    "base": "main",
    "head": "voice-start-send"
  },
  "segments": [
    {
      "id": "turn-pending-state",
      "file": "web/src/features/room/FridayRoom.tsx",
      "hunk": "@@ -301,6 +301,9 @@ function FridayRoomLayout({",
      "side": "additions",
      "startLine": 304,
      "endLine": 306,
      "explanation": "Adds an explicit pending state while start_turn or end_turn RPCs are in flight.",
      "reason": "Prevents overlapping turn-control requests from the primary button.",
      "source": "agent-authored"
    }
  ],
  "verification": [
    {
      "command": "npm run build",
      "status": "passed",
      "relatedSegmentIds": ["turn-pending-state"]
    }
  ]
}
```

## Implementation Prompt Guidance

Agents implementing a PR should be asked to produce the sidecar while they work, not after the fact. The instruction should be short and mechanical:

> When you make a behaviorally meaningful change, add or update a metadata segment that points to the exact file, hunk, side, and line range. Explain what the changed lines do and why they exist. Do not grade the PR, infer risk, or summarize unrelated files.

This may improve implementation quality because the agent has to state how changed lines fit into the codebase as it writes them. The cost is extra tokens and discipline, so V1 should keep the metadata narrow.

## Non-Goals

- No AI scoring.
- No risk gauges.
- No broad "review readiness" dashboards.
- No subjective claims that are not tied to exact diff evidence.
- No replacement for reading the code.

## Build Plan

1. Keep Vite React.
2. Add `@pierre/diffs`.
3. Render a mock PR patch through `PatchDiff`.
4. Add objective line annotations from a mock sidecar object.
5. Style the surrounding UI to keep the diff visually dominant.
6. Verify desktop and mobile with Agent Browser.
