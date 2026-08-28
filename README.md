# Pi Threshold Continue

An intentionally small [Pi](https://pi.dev) extension for long-running tasks.
After an automatic threshold compaction, it queues one hidden follow-up only
when Pi is still processing an active agent run. The follow-up tells the model
to continue the current task, or finish when the task is already complete.

## Why

Pi rebuilds a compacted context for the next request. Normal threshold
compaction does not itself retry the agent loop, so unfinished work can become
idle. This extension restores one decision point without treating every
compaction as proof that more work is required.

## Guardrails

The extension does nothing when:

- compaction was manual;
- Pi is already retrying an overflow;
- the session is idle;
- a user or another extension already has a message queued; or
- the same compaction event is delivered more than once.

It uses only Pi's public `session_compact`, `isIdle`, `hasPendingMessages`, and
`sendMessage` APIs. It has no runtime dependencies, performs no network I/O,
and does not write project files.

## Install

```bash
pi install npm:@touchfish100/pi-threshold-continue
```

Restart Pi after installing or updating the package.

## Development

```bash
npm install
npm run check
npm test
npm pack --dry-run
```

## License

MIT. See [LICENSE](LICENSE).
