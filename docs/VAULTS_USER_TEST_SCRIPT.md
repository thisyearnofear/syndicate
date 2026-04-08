# Vaults User Test Script

## Goal

Validate whether first-time users can understand and trust the new `/vaults` product surface enough to attempt the deposit flow.

## Target Test Group

- 5 to 10 users
- Mix of wallet-native and non-technical users
- At least 3 users who have never seen Syndicate before

## Session Structure (20-25 min each)

1. Intro (2 min)
2. Task walk-through (12-15 min)
3. Comprehension checks (5 min)
4. Confidence and trust rating (2-3 min)

## Moderator Intro Script

Use this exact framing:

`You are testing a new Vaults product page. There are no wrong answers. Please narrate what you think each section means while you use it.`

## Tasks

1. Land on `/vaults` and explain what product you think this is in one sentence.
2. Identify whether principal is at risk or preserved.
3. Find where you would start a deposit.
4. Click into the deposit flow (`/yield-strategies?tab=strategies`) and describe what you expect to happen next.
5. Return to `/vaults` and join the waitlist.
6. Explain the difference between public mode (`/vaults`) and operator mode (`/ranger`) if noticed.

## Comprehension Questions

Ask after tasks:

1. `What happens to your principal?`
2. `Where does yield come from according to the page?`
3. `What choices do you have for using yield?`
4. `What is still unclear before you would deposit real money?`

## Success Criteria

- 80%+ users can correctly state that principal is preserved in the intended strategy framing.
- 80%+ users can find and click the deposit CTA without moderator help.
- 70%+ users can describe the product in under 15 seconds.
- 60%+ users give confidence >= 4/5 after the flow.

## Metrics to Capture

From analytics:

- `home_vaults_cta_click`
- `vaults_start_click`
- `vaults_deposit_flow_click`
- `vault_waitlist_submit`

From moderated sessions:

- Time to first correct summary
- Time to first deposit CTA click
- Number of clarification prompts required
- Final confidence score (1-5)

## Debrief Template

Capture per user:

- User type (wallet-native / non-technical)
- One-line product summary from user
- Principal understanding (correct/incorrect)
- Deposit flow discoverability (easy/medium/hard)
- Trust blockers
- Suggested copy improvements
