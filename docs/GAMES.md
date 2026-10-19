# Playable games and matchmaking

The eight primary games and eight council mini-games now open real game sessions. Every game offers a clearly labeled computer mode and an authenticated real-player queue. Queueing never substitutes a bot for a human. If nobody else searches the same game, the user waits and may cancel. Jackaroo explicitly includes one computer teammate per human.

## Modes and variants

- XO: legal moves, three-in-a-row, draws; minimax practice opponent.
- Chess: chess.js 1.4.0 (MIT, vendored locally) validates checks, checkmate, castling, en passant, promotion and repetition. A shallow material/position computer opponent runs in a dedicated worker.
- Domino: two-player double-six draw dominoes, blocked-hand point comparison.
- Ludo: choose two opposing players or four individual players, online or against explicitly labeled computers. Four marbles each; six to enter; six/capture/home arrival grant a bonus throw; the third consecutive six loses the turn. Safe stars permit coexistence; two opposing marbles on an unsafe square form a blockade. New matches enter their private lane after progress 50 and finish exactly at 56; earlier two-player states retain their old geometry. The first player to finish all four marbles wins. Six-sided dice are generated on the server for online games. Pawns animate along individual board squares, captures return to base, and optional synthesized sound follows user interaction. Reduced motion is supported.
- Jackaroo: two teams, each with one human and one explicitly labeled computer teammate. Ace/King entry, Ace 1/11, backwards four, five on eligible marbles, split seven, Jack exchange, ten movement/burn, protected starts and teammate assistance. Four marbles share the final goal of each color's home lane. This is a documented lightweight variant, not a claim to every tournament/house rule.
- Pool: deterministic two-dimensional 8-ball variant, group assignment, fouls, cue ball placement, early-eight loss and legal-eight win.
- Carrom: two colors, nine pieces each, queen cover, striker fouls and single-board wins. Simplified digital board rules are shown in-app.
- Quiz / knowledge / flags / emoji: ten-question alternating rounds, answers hidden from the opponent until both have answered.
- Memory: turn-based pairs, hidden unflipped cards and explicit mismatch continuation.
- Treasure / balloons: turn-based score games over twenty-four selections.
- Horses: two-horse dice race to forty.
- Dare: ten noncompetitive prompts, no paid rewards.

Game scores never change wallet gold or diamonds. Profile level/royal membership is not modified.

## Transport and authority

`POST /games` uses a verified Firebase bearer identity, restricted existing CORS, and the existing bounded JSON reader. It does not require an Agora connection, a voice lease, or an Agora secret. D1 tables and the queue index initialize automatically; no manual console SQL is required.

D1 transactions pair waiting accounts while a unique membership row prevents multiple active games per account. Actions contain an expected match version and an idempotency nonce. The server validates legal actions, rolls dice, deals cards, runs physics and team bots, and hides hands, random seed, deck contents, hidden tiles and unrevealed answers. Clients never submit a replacement board or score.

Ludo uses separate versioned `ludo_rooms` storage with JSON seat claims inside a D1 transaction and the shared unique account membership table. Two-seat and four-seat queues are isolated and never fill empty human seats with bots. An active Ludo departure/disconnection/60-second turn timeout removes that color from play and skips its future turns; the final remaining player wins. Cancelling a waiting table closes that search for its participants. Legacy two-player games remain supported.

Waiting rooms poll every 2.5 seconds when visible, slower in the background. Inactive opponents forfeit after ninety seconds. A connected player who takes no action for two minutes loses the turn-based match. Leaving resigns and clears membership; reconnecting resumes the existing match. Old finished rooms are pruned after a day, and inactive waiting rooms after two hours.

## Performance

Modules load only when a user opens games. Board geometry and pieces are SVG/CSS. Ludo additionally loads a 263 KB WebP waterfront background only when its dialog opens. The original artwork was created with the built-in imagegen tool, then converted to WebP: `games/ludo-night.webp`. Prompt: premium 3D Gulf waterfront skyline at night, sapphire/turquoise/gold, subtle fireworks and a yacht, quiet dark central space, no board, UI, text or logo. Computer decisions run in a Web Worker. Physics uses a fixed 120 Hz simulation and a requestAnimationFrame playback at up to 60 frames per second; canvas pixel ratio is capped at two. Idle boards have no continuous render loop. Dedicated workers, animation frames, polls and listeners are released on exit.

## Validation

- Game tests cover all sixteen starts/moves, legal-action rejection, hidden information, complete ludo/jackaroo/pool/carrom games, XO optimal defense, domino tile conservation, chess castling/promotion/en passant/repetition, queen completion and deterministic bounded physics.
- Worker tests cover concurrent eight-account pairing, one-match membership, identity checks, wrong-turn and stale-version rejection, idempotency, private hands, queue expiry, disconnect/turn deadlines and resignation.
- Real Miniflare/Workers/D1 tests use actual RSA JWT verification with a mocked Firebase upstream, and verify two-account matchmaking, move synchronization and resignation alongside existing voice/chat tests.
- Chromium runs exercise all sixteen computer modes and two authenticated test accounts using the native browser fetch transport against the Worker handler/SQLite fixture. They check game entry, legal moves, synchronized versions, exits, and mobile layout; an actual computer worker reply and narrow/wide chess boards are checked. These fixtures do not claim to be two real production Firebase accounts.

## Rule references

- chess.js upstream source and license: https://github.com/jhlywa/chess.js
- Jackaroo manufacturer: https://jackarooshop.myshopify.com/pages/rules
- All India Carrom Federation: https://www.indiancarrom.co.in/laws-of-carrom/

The in-app rule text is the authority for the documented lightweight variants.

Ludo upgrade validation: 71 unit/regression tests, including legal four-color play through completion, capture/bonus/safe/blockade rules, exact home entry, transactional four-seat queues, request deduplication and departure handling. Real Miniflare tests exercise four RSA-authenticated accounts against D1 JSON matchmaking. Chromium checks 320/390/430 pixel layouts, native die/pawn interaction and synchronized four-account entry against the actual server handler/SQLite fixture; no production-user identities are used.
