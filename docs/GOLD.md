# Free game gold and daily tasks

Gold is free, non-purchasable, non-redeemable virtual game currency. No cash-out, transfers, purchase, real-value prizes or diamonds are provided. It lives in authenticated D1 `gold_accounts`, not the older Firestore wallet's unused gold placeholder. The UI reads diamonds from its existing source and gold from `/games`.

## Player experience

- Choose 500, 1,000, 5,000, 10,000, 50,000, 100,000, 500,000, 1,000,000, 2,000,000 or 5,000,000 gold per player. Matchmaking requires the same game, capacity and entry amount.
- An explicitly labeled free online table allows new accounts to complete tasks before they can afford the smallest gold table. Computer practice is always free and does not award progression. Dare is noncompetitive and has no gold table.
- Entering a queue reserves one entry amount. Joining twice or reconnecting cannot debit twice. Insufficient gold rolls back both debit and matchmaking transaction, including a partially filled Ludo roster.
- The winner receives the full sum of participants' entries, without a platform fee. For example, a four-player 500-gold table has a 2,000-gold pot. Draws and cancelled waiting rooms refund each player's entry. An active resignation forfeits the entry. Timed-out abandoned games without an adjudicated winner are refunded after two hours, on recovery.
- Normal boxes award a server-random integer from 100 through 500 inclusive. Premium boxes award 2,000 through 5,000 inclusive.
- Daily tasks: login (normal), complete one online game (normal), complete three online games (premium). Each task may be claimed once per Baghdad calendar day, resetting at 00:00 UTC+3. Claim retries return the same reward.
- A completed natural result, with at least four legal actions, grants each real participant one completed game and 25 XP; the winner receives 100 XP instead. Resignations, timeouts, cancelled searches and computer practice do not count toward tasks or XP. Level starts at 1 and increases every 1,000 XP. Gold stake size does not buy XP.

## Authority and recovery

`POST /games` reuses Firebase bearer verification and bounded/CORS-protected requests. `gold-status` reads the caller's account and tasks; `gold-claim` accepts only a task ID. Posted balances, rewards, XP and client timestamps are ignored. Only server-validated match results create settlement records.

D1 tables and migrations initialize on first use. Queue and gold reservation share a D1 transaction. A unique `(match_id,uid)` entry plus a balance-check/debit trigger prevents overdrafts and duplicate debits. A unique settlement per match and its database trigger provide atomic gold payout/refunds, XP, and task progress. Unique daily claims plus a credit trigger prevent repeat rewards across concurrent requests or devices. A later authenticated request recovers a finished result if the original HTTP response was lost before settlement. Unsettled entry-backed matches are not pruned.

## Deployment and validation

Deploy the Cloudflare Worker first from `cloudflare/` using `npm run deploy`, retaining existing bindings and secrets. Migrations are additive; no manual D1 SQL or changes to Firebase rules are needed. Verify `/health` includes `free-gold-tasks`. Then publish the frontend branch to GitHub Pages. Do not claim the live economy is enabled until both are deployed.

Validation: `node --test cloudflare/test/*.test.js`; `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --outdir dist` from `cloudflare/`; `node test/runtime.test.mjs`. Real Workers/D1 runtime checks cover concurrent box claims, balance triggers, stake tables, pot settlement and resignation behavior, in addition to existing authenticated voice/chat/game tests. Firebase upstream is mocked. Browser and production-account checks remain pending.
