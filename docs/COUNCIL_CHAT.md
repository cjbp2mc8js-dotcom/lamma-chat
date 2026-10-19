# Council chat

The composer sends messages to `/council-chat` on the voice Worker using a Firebase ID token and an unexpired server-issued admission session. Text chat obtains and renews its own admission independently of Agora audio, so audio reconnects do not disable messaging. The room is re-read with the caller's Firebase permissions. Sender identity comes from the verified token; display names are user-controlled labels with no authority.

The chat table and index are created on first use with `CREATE ... IF NOT EXISTS`. No manual migration or changes to existing voice session rows are needed. The production Worker name and D1 binding are in `cloudflare/wrangler.jsonc`.

Each fresh council entry starts with an empty view. Entry timestamps survive renewal and duplicate joins, so members who remain inside keep their current messages. Historical rows are not deleted for other members. Existing pre-feature leases retain their view until their next fresh admission.

Messages contain 1–500 UTF-16 code units of plain text. Retry IDs are scoped to sender and room. Sends are limited to one per sender per room every 1.5 seconds. Up to 200 messages are retained per room, and retrieval returns up to 60 messages newer than that admission’s server-side entry timestamp, within the last seven days; sends trigger cleanup.

The foreground client refreshes every three seconds, slows to ten seconds on errors, and stops in background or after leaving. Failed drafts remain in the composer and retries reuse the same ID. Send errors remain visible beside the composer and are not overwritten by polling. Stale poll results cannot erase a newer send response. Messages render through DOM text nodes.

Production Worker builds use `codex/royal-council-voice`. The deployed `/health` endpoint advertises `features: ["council-chat"]`. GitHub Pages serves the frontend from `main`.

Validation covers two verified test accounts sharing real local D1 storage (Firebase upstream mocked), lease revocation, room isolation, limits, retries, request cancellation and mobile rendering.
