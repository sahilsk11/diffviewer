import type { DiffLineAnnotation } from "@pierre/diffs/react";

export interface SegmentMetadata {
  id: string;
  file: string;
  hunk: string;
  side: "additions" | "deletions";
  lineNumber: number;
  endLine?: number;
  title: string;
  explanation: string;
  reason: string;
}

export interface ReviewAnnotation {
  segmentId: string;
}

export const mockPatch = `diff --git a/web/src/features/room/FridayRoom.tsx b/web/src/features/room/FridayRoom.tsx
index 5a94c2f..ad31f10 100644
--- a/web/src/features/room/FridayRoom.tsx
+++ b/web/src/features/room/FridayRoom.tsx
@@ -301,6 +301,10 @@ function FridayRoomLayout({
   const [isHolding, setIsHolding] = useState(false);
   const [voiceError, setVoiceError] = useState<string | null>(null);
   const [transcript, setTranscript] = useState("");
+  const [turnControlPending, setTurnControlPending] = useState(false);
+  const turnControlDisabled =
+    turnControlPending || connectionState !== "connected";
+
 
   const activeParticipant = participants.find((participant) => {
     return participant.identity === activeSpeakerIdentity;
@@ -871,11 +875,17 @@ function FridayRoomLayout({
   const startTurn = useCallback(async () => {
-    if (isHolding || !room) {
+    if (isHolding || !room || turnControlDisabled) {
       return;
     }
 
-    await room.localParticipant.performRpc({
-      destinationIdentity: agentIdentity,
-      method: "start_turn",
-    });
+    setTurnControlPending(true);
+    try {
+      await room.localParticipant.performRpc({
+        destinationIdentity: agentIdentity,
+        method: "start_turn",
+      });
+      setIsHolding(true);
+    } finally {
+      setTurnControlPending(false);
+    }
   }, [agentIdentity, isHolding, room, turnControlDisabled]);
 
   const endTurn = useCallback(async () => {
@@ -969,10 +979,18 @@ function FridayRoomLayout({
   const toggleTurn = useCallback(async () => {
-    if (isHolding) {
-      await endTurn();
-    } else {
-      await startTurn();
-    }
+    if (turnControlPending) return;
+
+    if (isHolding) {
+      setIsHolding(false);
+      await endTurn();
+      return;
+    }
+
+    await startTurn();
   }, [endTurn, isHolding, startTurn, turnControlPending]);
 
   useEffect(() => {
@@ -1348,15 +1366,15 @@ function FridayRoomLayout({
       <button
         className="voiceButton"
-        disabled={!room}
-        onPointerDown={startTurn}
-        onPointerUp={endTurn}
-        onPointerCancel={endTurn}
+        disabled={turnControlDisabled}
+        onClick={toggleTurn}
         type="button"
       >
-        Hold to talk
+        {isHolding ? "Send" : "Start"}
       </button>
     </div>
   );
 }
diff --git a/web/scripts/friday-self-test.mjs b/web/scripts/friday-self-test.mjs
index 82cc3af..0d1f44e 100644
--- a/web/scripts/friday-self-test.mjs
+++ b/web/scripts/friday-self-test.mjs
@@ -477,13 +477,12 @@ async function exerciseVoiceTurn(page) {
   await page.getByRole("button", { name: "Join room" }).click();
   await page.getByText("Connected").waitFor();
 
-  const voiceButton = page.getByRole("button", { name: "Hold to talk" });
-  await voiceButton.hover();
-  await page.mouse.down();
+  const startButton = page.getByRole("button", { name: "Start" });
+  await startButton.click();
   await page.waitForTimeout(1200);
-  await page.mouse.up();
+  await page.getByRole("button", { name: "Send" }).click();
 
   await page.getByText("Turn submitted").waitFor();
 }
`;

export const reviewMetadata = {
  pr: {
    title: "Replace press-and-hold voice turns with explicit Start and Send controls",
    description:
      "The voice turn control no longer depends on pointer down/up. The room UI now exposes explicit Start and Send actions, guards overlapping RPCs with a pending state, and updates the browser self-test to exercise the new interaction path.",
    base: "main",
    head: "voice-start-send",
    repository: "sahilsk11/friday",
  },
  segments: [
    {
      id: "turn-pending-state",
      file: "web/src/features/room/FridayRoom.tsx",
      hunk: "@@ -301,6 +301,10 @@ function FridayRoomLayout({",
      side: "additions",
      lineNumber: 304,
      endLine: 306,
      title: "Pending state",
      explanation:
        "Adds explicit state for an in-flight start_turn or end_turn request.",
      reason:
        "The button can disable itself while a turn-control RPC is outstanding.",
    },
    {
      id: "start-turn-rpc-guard",
      file: "web/src/features/room/FridayRoom.tsx",
      hunk: "@@ -871,11 +875,17 @@ function FridayRoomLayout({",
      side: "additions",
      lineNumber: 878,
      endLine: 886,
      title: "Start turn guard",
      explanation:
        "Wraps the start_turn RPC in pending-state setup and cleanup.",
      reason:
        "The UI records the active turn only after the RPC completes successfully.",
    },
    {
      id: "toggle-turn-command",
      file: "web/src/features/room/FridayRoom.tsx",
      hunk: "@@ -969,10 +979,18 @@ function FridayRoomLayout({",
      side: "additions",
      lineNumber: 980,
      endLine: 989,
      title: "Start/Send toggle",
      explanation:
        "Routes the primary control through one click handler that either starts or sends the current turn.",
      reason:
        "The interaction is now explicit button clicks instead of pointer hold/release.",
    },
    {
      id: "button-contract",
      file: "web/src/features/room/FridayRoom.tsx",
      hunk: "@@ -1348,15 +1366,15 @@ function FridayRoomLayout({",
      side: "additions",
      lineNumber: 1369,
      endLine: 1372,
      title: "Button contract",
      explanation:
        "Replaces pointer lifecycle handlers with a disabled state and click action.",
      reason:
        "The visible label now reflects the current turn state: Start before recording, Send while recording.",
    },
    {
      id: "self-test-flow",
      file: "web/scripts/friday-self-test.mjs",
      hunk: "@@ -477,13 +477,12 @@ async function exerciseVoiceTurn(page) {",
      side: "additions",
      lineNumber: 480,
      endLine: 483,
      title: "Self-test interaction",
      explanation:
        "Updates the browser self-test to click Start, wait, then click Send.",
      reason:
        "The test path should match the new user-visible interaction.",
    },
  ] satisfies SegmentMetadata[],
  verification: [
    {
      command: "npm run build",
      status: "passed",
      relatedSegmentIds: ["turn-pending-state", "button-contract"],
    },
    {
      command: "browser self-test",
      status: "updated",
      relatedSegmentIds: ["self-test-flow"],
    },
  ],
};

export const lineAnnotations: DiffLineAnnotation<ReviewAnnotation>[] =
  reviewMetadata.segments.map((segment) => ({
    side: segment.side,
    lineNumber: segment.lineNumber,
    metadata: {
      segmentId: segment.id,
    },
  }));
