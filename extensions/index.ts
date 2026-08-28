import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const queuedCompactions = new Set<string>();
const MAX_TRACKED_COMPACTIONS = 128;

const continuationPrompt =
  "Automatic threshold compaction has completed. Reassess the active task from the compaction summary, retained recent messages, and original user goal. If the task is complete, provide the final answer and stop. Otherwise take only the next necessary concrete action. Do not repeat completed work or invent work merely to continue.";

export default function guardedThresholdContinuation(pi: ExtensionAPI): void {
  pi.on("session_compact", async (event, ctx) => {
    // Never interfere with manual compaction or Pi's native overflow retry path.
    if (event.reason !== "threshold" || event.willRetry) return;

    // Do not turn pre-prompt maintenance, a completed idle interaction, or
    // existing user/extension work into an extra synthetic turn.
    if (ctx.isIdle() || ctx.hasPendingMessages()) return;

    const compactionId = event.compactionEntry.id;
    if (queuedCompactions.has(compactionId)) return;

    queuedCompactions.add(compactionId);
    if (queuedCompactions.size > MAX_TRACKED_COMPACTIONS) {
      const oldest = queuedCompactions.values().next().value;
      if (oldest) queuedCompactions.delete(oldest);
    }

    await pi.sendMessage(
      {
        customType: "guarded-threshold-continuation",
        display: false,
        content: continuationPrompt,
      },
      { deliverAs: "followUp" },
    );
  });
}
