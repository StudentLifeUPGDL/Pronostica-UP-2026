# Auto-syncing tournament results

The app's scores are computed live from a **single Firestore document**,
`results/official` (shape `Results` in [`src/app/data/worldcup.ts`](../src/app/data/worldcup.ts)).
It holds the *final group standings* + *which teams advanced each knockout round* +
champion/runner-up/third — **not** individual match scorelines.

So you never have to enter every match. [`scripts/syncResults.mjs`](syncResults.mjs)
pulls the real tournament state from **football-data.org** and writes that one doc
on a schedule. The admin "Resultados reales" screen still works as a manual override.

---

## 1. Get a free API key

Register at <https://www.football-data.org/client/register>. You'll get an API
token by email. (The World Cup competition code is `WC`.)

> ⚠️ football-data.org lists "Worldcup" in its free tier, but confirm your key can
> actually read it — the very first dry-run below will tell you (a `403` means it's
> not in your plan). If so, see **Fallback** at the bottom.

## 2. Test locally with a dry run (writes nothing)

```powershell
$env:FOOTBALL_DATA_API_KEY = "your-key-here"
node scripts/syncResults.mjs --dry-run
```

This prints the derived results and **a list of any team it couldn't match**.
Check that list carefully — see *Keeping teams in sync* below.

## 3. Add the two GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `FOOTBALL_DATA_API_KEY` | your football-data.org token |
| `FIREBASE_SERVICE_ACCOUNT` | the **entire contents** of `scripts/serviceAccount.json`, pasted as-is |

`serviceAccount.json` is the same key you used for `setAdmin.mjs` (gitignored —
never commit it). The Action reads it from the secret, not from the repo.

## 4. It's now automatic

[`.github/workflows/sync-results.yml`](../.github/workflows/sync-results.yml) runs
every 15 minutes and no-ops cheaply outside the tournament window
(Jun 10 – Jul 21, 2026 — edit `WINDOW_START`/`WINDOW_END` in the script if needed).
You can also trigger a manual refresh anytime from the repo's **Actions** tab →
*Sync World Cup results* → *Run workflow*.

To run a one-off write from your machine instead:

```powershell
$env:FOOTBALL_DATA_API_KEY = "your-key-here"
node scripts/syncResults.mjs --write          # uses scripts/serviceAccount.json
```

---

## Keeping teams in sync (important)

Scoring matches on **team id**. The groups/teams in `worldcup.ts` must reflect the
**real 2026 draw**, and `TEAM_TABLE` in `syncResults.mjs` maps each football-data.org
team to those ids. If the dry run reports unmapped teams, fix **both**:

1. the team set / group assignments in `src/app/data/worldcup.ts`, and
2. the matching row in `TEAM_TABLE` (`[appId, displayName, TLA, ...aliases]`).

## How rounds are derived

| `Results` field | Source |
| --- | --- |
| `groups[X]` (1/2/3) | standings endpoint, positions 1–3 per group (written only once all three resolve) |
| `r32/r16/qf/sfWinners` | winners of **finished** matches in that stage |
| `champion` / `runnerUp` | winner / loser of the Final |
| `thirdPlace` | winner of the third-place match |

The write uses `merge: true` and only includes fields it can confidently derive, so
it never wipes a value that hasn't been decided yet or one you set by hand.

## Fallback: openfootball (no API key)

If football-data.org won't serve the World Cup on your plan, swap the data source to
the public-domain [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)
(includes 2026, no key, no rate limit). Only the `apiGet`/`buildResults` functions in
`syncResults.mjs` change — the mapping, merge-write, and the whole workflow stay the
same. Trade-off: openfootball is volunteer-updated, so results may lag live matches.
Ask and I'll wire it up.
