import assert from "node:assert/strict";
import test from "node:test";

import extension from "../extensions/index.ts";

type CompactEvent = {
  reason: "manual" | "threshold" | "overflow";
  willRetry: boolean;
  compactionEntry: { id: string };
};

type MockContext = {
  isIdle(): boolean;
  hasPendingMessages(): boolean;
};

function setup(context = { idle: false, pending: false }) {
  let handler: ((event: CompactEvent, ctx: MockContext) => Promise<void>) | undefined;
  const sent: Array<{ message: Record<string, unknown>; options: Record<string, unknown> }> = [];

  extension({
    on(name: string, callback: typeof handler) {
      assert.equal(name, "session_compact");
      handler = callback;
    },
    async sendMessage(message: Record<string, unknown>, options: Record<string, unknown>) {
      sent.push({ message, options });
    },
  } as never);

  return {
    sent,
    async compact(event: CompactEvent) {
      assert.ok(handler);
      await handler(event, {
        isIdle: () => context.idle,
        hasPendingMessages: () => context.pending,
      });
    },
  };
}

test("queues exactly one hidden follow-up for an active threshold compaction", async () => {
  const runtime = setup();
  const event = { reason: "threshold", willRetry: false, compactionEntry: { id: "one" } } as const;

  await runtime.compact(event);
  await runtime.compact(event);

  assert.equal(runtime.sent.length, 1);
  assert.equal(runtime.sent[0].message.display, false);
  assert.equal(runtime.sent[0].options.deliverAs, "followUp");
});

test("does not queue for manual, retried, idle, or already-pending work", async () => {
  const scenarios = [
    { context: { idle: false, pending: false }, event: { reason: "manual", willRetry: false } },
    { context: { idle: false, pending: false }, event: { reason: "overflow", willRetry: true } },
    { context: { idle: true, pending: false }, event: { reason: "threshold", willRetry: false } },
    { context: { idle: false, pending: true }, event: { reason: "threshold", willRetry: false } },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    const runtime = setup(scenario.context);
    await runtime.compact({ ...scenario.event, compactionEntry: { id: `skip-${index}` } });
    assert.equal(runtime.sent.length, 0);
  }
});
