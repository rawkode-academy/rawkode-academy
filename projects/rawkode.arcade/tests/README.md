# Production acceptance tests

Acceptance tests run against the real Cloudflare Worker, Durable Object SQLite,
D1, protocol, redaction, ticket, game, and projection code. They must not use a
contract adapter or duplicate production behavior in an in-memory harness.

`bun run test` is the single release gate. It runs fast game/content tests with
Bun and storage/integration tests through `@cloudflare/vitest-pool-workers` using
the project's Wrangler bindings. Each underlying runner is executed through
`scripts/require-no-skips.ts`; a skipped, pending, or todo case is a release
failure.

The production-backed suite covers:

- protocol validation and bounded messages;
- role-redacted snapshots with no unrevealed answer leakage;
- persisted command idempotency and exactly-once score effects;
- server-scoped room membership, contestant name/team persistence, and
  cross-room ticket denial;
- atomic concurrent buzzer arbitration;
- contiguous replay, redacted snapshot fallback after a gap, and public socket
  reconnection with a renewed member ticket;
- authoritative deadline rejection while a round remains open;
- audience identity deduplication, retained alarm retry, additive cross-shard
  reactions, shard-aware socket presence, and frozen Null Pointer distributions;
- rejection of late audience answers after distribution freeze;
- single-use WebSocket ticket nonces;
- all six immutable game-content validators; and
- terminal Durable Object outbox delivery through the idempotent D1 room
  leaderboard projector, including duplicate and concurrent consumption.

Use unique room IDs per test. Tests may fix a clock or seed through an explicit
test binding, but may not replace the code or persistence boundary under test.
Browser role journeys remain in `e2e/`; production-scale traffic remains in
`scripts/load-rehearsal.ts`.
