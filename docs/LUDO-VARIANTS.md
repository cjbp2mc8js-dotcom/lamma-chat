# Ludo variants

Rules supplied by the project owner on 2026-10-25:

- Classic: finish four pieces, without a capture prerequisite.
- Quick: finish one piece; capture at least one opposing piece before entering the private home lane.
- Master: finish four pieces with the same capture prerequisite. Two opposing pieces on an unsafe square remain a blockade, as in the existing classic engine.
- Arrow: exact landing triggers one forward jump across an outside bend. The route inferred from the supplied board image uses absolute path indices 9→13, 22→26, 35→39, 48→0, skipping four progress steps. Crossing a start without landing does not trigger a jump. A jump that would bypass the player’s private home entrance is suppressed. These explicit endpoint choices are an implementation interpretation of the supplied image, not independently verified Yalla Ludo source rules.

Capture permission belongs to the player, survives their pieces being captured, and is not awarded for landing on an occupied safe square. All variants retain exact finishing, safe squares and the existing bonus-roll rules.

The server stores the variant in the initial state, isolates queues by seat count, stake and variant, validates moves against that state, and returns the actual variant when resuming a match. Existing states without a variant are classic. Clients cannot grant capture permission or choose their own finish threshold.
