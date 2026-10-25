# Architecture status — 2026-10-25

This document distinguishes implemented behavior from requested roadmap features.

Implemented:
- Firebase identity verification, server-authoritative moves and gold settlement, request versioning and idempotency.
- Classic, Quick, Master and Arrow Ludo queues isolated by variant, seat count and gold entry amount.
- Online Ludo dice use `node:crypto.randomInt(1, 7)` for each authoritative roll; clients submit only a roll action and cannot supply its result. Replay of an accepted nonce returns the existing result instead of drawing again. Seeded rolls remain for local computer practice and repeatable engine tests.
- Agora-powered council voice sessions with authenticated admission and temporary council locking.

Current limits and roadmap:
- Ludo now receives authenticated WebSocket state pushes through a Durable Object per table. Writes still use the established authenticated HTTP move endpoint. Visible polling is reduced to 15 seconds when connected and returns to 2.5 seconds as a fallback. Tickets expire after 30 seconds and are single-use; socket sessions expire at the earlier of 5 minutes or the verified identity token expiry, then reconnect with a fresh ticket. Clients show live status only after the first matching snapshot, detect silent connections, suspend reconnect attempts while offline and resynchronize when returning to the app. Generation guards discard retired sockets and delayed ticket responses. Existing server versions and idempotency remain authoritative; socket transport is receive-only.
- Matchmaking does not yet use account level or skill rating. The server currently matches seats, variant and stake.
- In-game voice, same-device multiplayer, moderation/reporting/blocking and persistent cross-device profile fields remain separate work items.
- Store checkout and recurring VIP purchases are not active. Merchant integration, verified callbacks, reversals and subscription lifecycle handling are prerequisites. No Yalla Pay or Iraqi carrier billing integration is claimed.

Secure randomness is an implementation property, not an external fairness certification. No zero-latency, zero-bias or global scalability guarantee is claimed.
