import type { ReviewAnalysisFixture } from "./types";

export const reviewAnalysisFixtures = [
  {
    id: "friday#37",
    reviewerIntent:
      "Review whether the PR cleanly changes Friday voice turns from press-and-hold to explicit start/send controls while preserving verification coverage and Codex model defaults.",
    confidence: "high",
    evidence: [
      {
        kind: "commit",
        id: "friday-commit",
        oid: "e034f465b2b1e47204a8f1629a677fdb95b74138",
        note: "Single PR commit describing the voice-control and Codex-default changes.",
      },
      {
        kind: "file",
        id: "friday-room-file",
        filePath: "web/src/features/room/FridayRoom.tsx",
      },
      {
        kind: "diff",
        id: "friday-turn-pending-state",
        filePath: "web/src/features/room/FridayRoom.tsx",
        hunkHeader:
          "@@ -301,6 +301,9 @@ function FridayRoomLayout({",
        note: "Adds pending state for asynchronous turn-control requests.",
      },
      {
        kind: "diff",
        id: "friday-start-turn-guard",
        filePath: "web/src/features/room/FridayRoom.tsx",
        hunkHeader:
          "@@ -871,7 +873,11 @@ function FridayRoomLayout({",
        note: "Guards startTurn while a start/end RPC is pending.",
      },
      {
        kind: "diff",
        id: "friday-toggle-turn",
        filePath: "web/src/features/room/FridayRoom.tsx",
        hunkHeader:
          "@@ -969,8 +986,18 @@ function FridayRoomLayout({",
        note: "Introduces a click/keyboard toggle between start and send.",
      },
      {
        kind: "diff",
        id: "friday-button-copy",
        filePath: "web/src/features/room/FridayRoom.tsx",
        hunkHeader:
          "@@ -1348,23 +1356,19 @@ function FridayRoomLayout({",
        note: "Changes the primary voice button from pointer hold semantics to Start/Send states.",
      },
      {
        kind: "diff",
        id: "friday-self-test-toggle",
        filePath: "web/scripts/friday-self-test.mjs",
        hunkHeader:
          "@@ -477,28 +477,20 @@ async function fillCreateSessionForm(page) {",
        note: "Updates the browser self-test from mouse hold/release to Start and Send clicks.",
      },
      {
        kind: "diff",
        id: "friday-codex-models",
        filePath: "friday/infra/providers/codex.py",
        hunkHeader:
          "@@ -304,6 +304,12 @@ async def _fan_out_error(self, message: str) -> None:",
        note: "Adds GPT-5.3 Codex Spark to the Codex model list.",
      },
      {
        kind: "diff",
        id: "friday-default-directory",
        filePath: "web/src/features/sessions/components/new-session-modal.tsx",
        hunkHeader:
          "@@ -12,7 +12,7 @@ import { useHarnessesQuery, useModelsQuery } from '@/features/sessions/hooks';",
      },
      {
        kind: "comment",
        id: "friday-local-verification-comment",
        commentId: "IC_kwDOSRdi488AAAABDGIaCw",
        note: "Author's local verification notes covering typecheck, mypy, build, desktop/mobile browser checks, and self-test blockers.",
      },
      {
        kind: "comment",
        id: "friday-codex-clean-review",
        commentId: "IC_kwDOSRdi488AAAABDGchmA",
        note: "Codex review reported no major issues after the head SHA review request.",
      },
    ],
    areas: [
      {
        id: "voice-turn-controls",
        title: "Voice Turn Controls",
        status: "needs-review",
        filePaths: ["web/src/features/room/FridayRoom.tsx"],
        summary:
          "The core behavior changes from pointer hold/release to explicit Start and Send actions with pending-state suppression around LiveKit RPC calls.",
        evidenceIds: [
          "friday-room-file",
          "friday-turn-pending-state",
          "friday-start-turn-guard",
          "friday-toggle-turn",
          "friday-button-copy",
        ],
        rationaleIds: ["friday-rationale-turn-control"],
      },
      {
        id: "verification-path",
        title: "Verification Path",
        status: "ready",
        filePaths: ["web/scripts/friday-self-test.mjs", "README.md"],
        summary:
          "The self-test and docs were updated to exercise the new toggle model, and the PR includes local browser verification notes.",
        evidenceIds: [
          "friday-self-test-toggle",
          "friday-local-verification-comment",
        ],
        rationaleIds: ["friday-rationale-verification"],
      },
      {
        id: "codex-session-defaults",
        title: "Codex Session Defaults",
        status: "ready",
        filePaths: [
          "friday/infra/providers/codex.py",
          "web/src/features/sessions/components/new-session-modal.tsx",
        ],
        summary:
          "Codex-facing labels and the default session directory changed alongside the voice-control work.",
        evidenceIds: ["friday-codex-models", "friday-default-directory"],
        rationaleIds: ["friday-rationale-defaults"],
      },
    ],
    questions: [
      {
        id: "friday-question-space-repeat",
        question:
          "Should holding the spacebar after this change repeatedly toggle the turn if the browser emits keydown repeat events?",
        why: "The old keyup path was removed and the new keydown handler calls toggleTurn directly; React/browser repeat behavior is worth checking because it can accidentally start and send a turn.",
        state: "inference",
        confidence: "medium",
        evidenceIds: ["friday-toggle-turn"],
      },
      {
        id: "friday-question-rpc-failure",
        question:
          "If end_turn fails after the UI clears isHolding, should the microphone remain disabled or should the UI recover into a retryable active-turn state?",
        why: "The UI optimistically exits the active turn before the end-turn RPC completes, which may be correct but carries UX implications under LiveKit failure.",
        state: "inference",
        confidence: "medium",
        evidenceIds: ["friday-start-turn-guard", "friday-button-copy"],
      },
    ],
    risks: [
      {
        id: "friday-risk-key-repeat",
        title: "Keyboard repeat may double-toggle the turn",
        severity: "medium",
        state: "inference",
        confidence: "medium",
        mitigation:
          "Manually verify spacebar hold behavior or gate keydown handling on event.repeat before considering this ready.",
        evidenceIds: ["friday-toggle-turn", "friday-local-verification-comment"],
      },
      {
        id: "friday-risk-self-test-platform",
        title: "Voice self-test still depends on a platform-specific speech tool",
        severity: "low",
        state: "fact",
        confidence: "high",
        mitigation:
          "Track the existing Linux blocker separately if self-tests need to run in CI or on this workstation.",
        evidenceIds: ["friday-self-test-toggle", "friday-local-verification-comment"],
      },
    ],
    rationale: [
      {
        id: "friday-rationale-turn-control",
        title: "Turn Control State",
        summary:
          "The added pending state makes the Start/Send model explicit and prevents overlapping LiveKit RPC calls while the primary control changes labels.",
        claims: [
          {
            id: "friday-claim-overlap-guarded",
            text: "Start and end requests are guarded while a turn-control RPC is pending.",
            state: "fact",
            confidence: "high",
            evidenceIds: ["friday-turn-pending-state", "friday-start-turn-guard"],
          },
          {
            id: "friday-claim-pointer-model-removed",
            text: "The primary voice button no longer relies on pointer capture or pointer-up release semantics.",
            state: "fact",
            confidence: "high",
            evidenceIds: ["friday-button-copy"],
          },
        ],
      },
      {
        id: "friday-rationale-verification",
        title: "Verification Coverage",
        summary:
          "Fixture comments show local type, build, desktop, mobile, and fake-microphone checks, with explicit notes for blocked self-tests.",
        claims: [
          {
            id: "friday-claim-browser-verified",
            text: "The author verified desktop and mobile rendering plus Start/Send voice-control behavior locally.",
            state: "fact",
            confidence: "high",
            evidenceIds: ["friday-local-verification-comment"],
          },
          {
            id: "friday-claim-self-test-updated",
            text: "The automated self-test script was updated to click Start and Send instead of simulating a held mouse button.",
            state: "fact",
            confidence: "high",
            evidenceIds: ["friday-self-test-toggle"],
          },
        ],
      },
      {
        id: "friday-rationale-defaults",
        title: "Defaults",
        summary:
          "The PR also adjusts Codex naming/model availability and the new-session directory default, so review should not focus only on the room component.",
        claims: [
          {
            id: "friday-claim-spark-added",
            text: "GPT-5.3 Codex Spark is added as a selectable Codex model.",
            state: "fact",
            confidence: "high",
            evidenceIds: ["friday-codex-models"],
          },
          {
            id: "friday-claim-directory-linux",
            text: "The default session directory changes from a macOS portfolio path to /home/sahil/projects.",
            state: "fact",
            confidence: "high",
            evidenceIds: ["friday-default-directory"],
          },
        ],
      },
    ],
  },
  {
    id: "overwatch#9",
    reviewerIntent:
      "Confirm a small Overwatch PR posts a head-bound Codex marker and then an exact trigger comment, with a regression test.",
    confidence: "high",
    evidence: [
      {
        kind: "commit",
        id: "overwatch-commit",
        oid: "4dfce44e83335e4b7a96e5daeb58430a4c388de2",
      },
      {
        kind: "diff",
        id: "overwatch-review-trigger-code",
        filePath: "src/overwatch/github.py",
        hunkHeader:
          "@@ -317,10 +317,9 @@ def merge_pr(self, pr: PullRequestRef, head_sha: str | None = None) -> None:",
      },
      {
        kind: "diff",
        id: "overwatch-review-trigger-test",
        filePath: "tests/test_overwatch.py",
        hunkHeader:
          "@@ -509,6 +509,34 @@ def _request_all_pages(self, path: str) -> list[dict[str, object]]:",
      },
    ],
    areas: [
      {
        id: "codex-trigger-comment",
        title: "Codex Trigger Comment",
        status: "ready",
        filePaths: ["src/overwatch/github.py", "tests/test_overwatch.py"],
        summary:
          "The implementation emits a head marker when a head SHA is available, then always emits a plain @codex review trigger that automation can match exactly.",
        evidenceIds: [
          "overwatch-review-trigger-code",
          "overwatch-review-trigger-test",
        ],
        rationaleIds: ["overwatch-rationale-trigger"],
      },
    ],
    questions: [],
    risks: [
      {
        id: "overwatch-risk-duplicate-comment",
        title: "Two comments are intentional but visible",
        severity: "low",
        state: "inference",
        confidence: "medium",
        mitigation:
          "Keep the regression test as the source of truth for comment order and exact bodies.",
        evidenceIds: [
          "overwatch-review-trigger-code",
          "overwatch-review-trigger-test",
        ],
      },
    ],
    rationale: [
      {
        id: "overwatch-rationale-trigger",
        title: "Exact Trigger Preservation",
        summary:
          "The code path separates metadata from the bot trigger so the final comment remains exactly @codex review.",
        claims: [
          {
            id: "overwatch-claim-two-comments",
            text: "When a head SHA is provided, the client posts the head marker first and the exact trigger second.",
            state: "fact",
            confidence: "high",
            evidenceIds: [
              "overwatch-review-trigger-code",
              "overwatch-review-trigger-test",
            ],
          },
        ],
      },
    ],
  },
] as const satisfies ReviewAnalysisFixture[];
