---
format: 1920x1080
duration: 60s
message: "Season of Tickets turns real Megapot entries into a social tontine — crew up, pool tickets, and call the pot. Every score is a real, receipt-verified on-chain entry."
arc: Hook → Tontine premise → The game (real UI) → Real-entry proof → The call/auction → Receipt verification → Settlement reveal → CTA
audience: Inco Summer Game Jam judges (Megapot track)
mode: autonomous
music: "tense, urgent dark-electronic game-show pulse; builds under the auction, resolves warm on the reveal"
---

## Frame 1 — The Last Seat (cover / hook)

- scene: Massive lowercase amber type punches in — "the last seat wins."
- duration: 5s
- poster: 3s
- transition_in: cut
- status: outline
- src: compositions/frames/01-cover.html
- register: amber
- asset_candidates: none

Open cold on the tontine promise. Broadside cover: amber ground, dark-ink display type at ~13cqw, a mono kicker "SEASON OF TICKETS — A TONTINE ON MEGAPOT", and a small ink rule stub. No chrome bars. This is the thesis; everything after pays it off.

## Frame 2 — The Twist (statement)

- scene: Dark frame, one clause lit amber — "your crew is the strategy."
- duration: 5s
- transition_in: cut
- status: outline
- src: compositions/frames/02-twist.html
- register: dark
- asset_candidates: none

Statement frame. Big lowercase cream display on ink: "a lottery where *your crew* is the strategy." Amber on the key clause. Mono kicker "NOT JUST A TICKET — A TONTINE". Sets up the social mechanic before showing any UI.

## Frame 3 — The Game, Live (screenshot plate)

- scene: Real /season hero screenshot pushes in, 3-step callouts light up.
- duration: 8s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-game.html
- register: dark
- asset_candidates: assets/season-hero.png

Show the actual product. Plate the /season hero (1920×1080) with a slow push-in. Overlay three mono callouts tied to the app's own copy: "1 · crew up", "2 · pool real entries", "3 · call the pot". This is the working-product beat for the judges.

## Frame 4 — Real Entries (stat grid)

- scene: Three top-border stat cards count up from real settle data.
- duration: 8s
- transition_in: cut
- status: outline
- src: compositions/frames/04-stats.html
- register: dark
- asset_candidates: none

The dense exception. Three stat-cards (top-border only) with real figures from the mainnet settle: "2 real mainnet purchases", "3 tickets scored on-chain", "3 USDC crew chest". Amber numerals count up. Mono kicker "EVERY SCORE = A REAL MEGAPOT ENTRY". No fabricated numbers.

## Frame 5 — The Ladder & Feed (screenshot plate)

- scene: Crew ladder + live season feed, event lines highlight in sequence.
- duration: 7s
- transition_in: crossfade
- status: outline
- src: compositions/frames/05-ladder.html
- register: dark
- asset_candidates: assets/season-ladder.png

Plate the lower /season view showing the crew ladder and the season feed. Highlight real feed lines in order: "crew founded", "seat taken", "the pot was called — auction is live", "offered 33.3% back to the crew". Reinforces retention/social loop.

## Frame 6 — The Call (auction drama)

- scene: Dark→amber; a discount bid climbs to 33.3% under a countdown.
- duration: 8s
- transition_in: cut
- status: outline
- src: compositions/frames/06-call.html
- register: dark→amber
- asset_candidates: none

The money shot — the most original mechanic. "anyone can call the pot." Then the raise-only auction: a bid counter climbs to "33.3% back to the crew", anti-snipe clock extends. Shift from dark register to amber ground as the call lands. Mono labels: "RAISE-ONLY", "ANTI-SNIPE +5:00".

## Frame 7 — Receipt-Verified (proof)

- scene: Real tx hashes stamp in as receipts on Base.
- duration: 7s
- transition_in: cut
- status: outline
- src: compositions/frames/07-receipts.html
- register: dark
- asset_candidates: none

The credibility beat that beats every mock submission. Two receipt stamps with the REAL mainnet tx hashes: `0x5439…09ef5c` (2 tickets) and `0xbac9…72f4` (1 ticket), plus "settle ok:true — receipt-verified on Base". Mono, stamp-in entrance. Kicker "NOTHING IS SIMULATED".

## Frame 8 — The Reveal (settlement)

- scene: Chest decrypts → winner beams → seat frees → cuts renormalize.
- duration: 6s
- transition_in: crossfade
- status: outline
- src: compositions/frames/08-reveal.html
- register: dark
- asset_candidates: none

Use the app's own reveal grammar: a DecryptLine chest opens, a BeamFrame highlights the winning bidder, the freed seat empties, and survivor cuts renormalize (e.g. 25%→33%). Line: "every exit feeds the survivors." Violet accent for the crew/season identity.

## Frame 9 — Season of Tickets (end card / CTA)

- scene: Amber end card — title, "built on Megapot · Base", repo link.
- duration: 6s
- transition_in: cut
- status: outline
- src: compositions/frames/09-cta.html
- register: amber
- asset_candidates: none

Close on amber. Massive lowercase "season of tickets." + sub "a tontine pot on megapot". Mono footer: "BUILT ON MEGAPOT · BASE", "INCO SUMMER GAME JAM — MEGAPOT TRACK", and the public repo github.com/thisyearnofear/syndicate. Non-custodial · open-source · Base-native.
