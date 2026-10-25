# Architecture status — 2026-10-25

This document distinguishes implemented behavior from requested roadmap features.

Implemented:
- Firebase identity verification, server-authoritative moves and gold settlement, request versioning and idempotency.
- Classic, Quick, Master and Arrow Ludo queues isolated by variant, seat count and gold entry amount.
- Online Ludo dice use `node:crypto.randomInt(1, 7)` for each authoritative roll; clients submit only a roll action and cannot supply its result. Replay of an accepted nonce returns the existing result instead of drawing again. Seeded rolls remain for local computer practice and repeatable engine tests.
- Agora-powered council voice sessions with authenticated admission and temporary council locking.

Current limits and roadmap:
- Game state uses HTTP polling (normally 2.5 seconds while visible), not WebSocket push. A future persistent-room service must preserve membership, ordering, reconnect snapshots and exactly-once economic settlement; adding a socket alone would not provide those guarantees.
- Matchmaking does not yet use account level or skill rating. The server currently matches seats, variant and stake.
- In-game voice, same-device multiplayer, moderation/reporting/blocking and persistent cross-device profile fields remain separate work items.
- Store checkout and recurring VIP purchases are not active. Merchant integration, verified callbacks, reversals and subscription lifecycle handling are prerequisites. No Yalla Pay or Iraqi carrier billing integration is claimed.

Secure randomness is an implementation property, not an external fairness certification. No zero-latency, zero-bias or global scalability guarantee is claimed.
