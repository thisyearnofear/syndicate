---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Season of Tickets turns Megapot lottery entries into a social tontine game — crew-vs-crew competition, real on-chain purchases, and a dramatic auction-driven exit."
destination: youtube
aspect: 1920x1080
language: en
length: 60s
angle: tontine drama narrative
---

## Intent

A 60-second hackathon submission demo for the Inco Summer Game Jam (Megapot track). The video tells the story of one tontine round: friends pool real Megapot tickets into a crew, compete on a leaderboard, then one member "calls the pot" via a raise-only discount auction — the winner exits, the survivors' shares renormalize, and every step is receipt-verified on-chain. The tone is tense, cinematic, and proof-driven: "receipts, not promises." Target audience is hackathon judges evaluating depth of Megapot integration, gameplay originality, working product, and retention potential.

## Assets

- Screenshots captured from the running `/season` page (HQ, crew ladder, seat map, bid panel, settlement reveal)
- Real mainnet transaction hashes: `0x543995da…09ef5c` (2 tickets), `0xbac9…72f4` (1 ticket)
- Scoring API response showing `purchases: 2, entries: 3`
- Keeper cron response confirming autonomous operation

## Customizations

- Kinetic-type captions, no voiceover (faster to ship, avoids TTS dependency)
- Use the app's own design tokens: dark slate background (#0f172a), amber accent for "Play" domain, violet for "Coordinate" domain
- Reveal grammar from the app: DecryptLine for the chest-opening moment, BeamFrame for the winner highlight
- Data callouts styled as receipt stamps (tx hash, block number, ticket count)

## Notes

- No fabricated data — every number shown comes from the real testnet/mainnet runs
- Keep the Fhenix privacy feature out of the video (deprecated); focus purely on Season/Megapot
- End card: GitHub repo link + "Built for the Inco Summer Game Jam — Megapot Track"
- Do NOT show private keys or wallet addresses in full; abbreviate (0x0380…d4Ec)
