# Klustered Winter 2026 launch

Status checked 24 October 2026. Pre-season format approved 24 October 2026.

> **Public page on hold.** `https://rawkode.academy/shows/klustered` shows only "Klustered news will be released soon." The public pages and endpoints listed below are switched off in `projects/rawkode.academy/website/src/shows/klustered/index.ts`, and every `klustered.live` path redirects to the holding page. The dates below are internal planning notes and are not announced. Bracket data and the klustered.dev portal are unchanged. Re-enable public pages by listing slugs in `enabledPages` and `enabledEndpoints`.

## What exists

- The Summer-to-Winter transfer ran on 25 September 2026. It created the Winter Solo and Team brackets, moved the Summer applications and competitor profiles, activated Winter, and deleted Summer. Do not run it again. Winter already has brackets, so the action refuses.
- The public application route `https://rawkode.academy/shows/klustered/apply` needs an active, eligible bracket to show an application option. It is switched off while the holding page is live.
- While the holding page is live, the public site exposes no Klustered Apply page, seasons, bracket listings, schedules, live endpoint or calendar feed.
- The public schedule currently has no Winter matches. Do not generate fixtures until applications have been reviewed and entries are ready.

## Confirmed schedule

Winter 2026 opens **Wednesday 18 November 2026** at **17:30 GMT** (17:30 UTC) with five one-off pre-season matches. 11 November is KubeCon NA week.

- 18 November 2026
- 25 November 2026
- 2 December 2026
- 9 December 2026
- 16 December 2026

There are no episodes on 23 or 30 December.

The Solo bracket is 8 players. It runs weekly from **Wednesday 6 January 2027** at **17:30 UTC** to the final on **Wednesday 17 February 2027**. Applications close on **13 December 2026**.

A Team bracket runs from **Wednesday 24 February 2027** at 17:30 UTC only if 4 teams of 3 or more are ready by **31 January 2027**. Otherwise it does not start.

klustered.dev stores times in UTC. 17:30 GMT is 17:30 UTC through this Solo final. From 28 March 2027, 17:30 UTC is 18:30 UK time.

The five pre-season dates are one-off matches. They are not the Solo bracket's weekly cadence. Generate Solo round one only after that bracket's start is 6 January 2027 at 17:30 UTC.

## Existing brackets

The 25 September transfer wrote the same start time onto Solo and Team. Those stored start times still need correcting before round one.

The admin bracket page only changes status. It does not edit a start time or a registration close. Correct Solo to **2027-01-06** at **17:30 UTC**, and close its applications on **2026-12-13**, before generating round one. Do not leave Team on the Solo start. Set Team to **2027-02-24** at 17:30 UTC only if 4 teams of 3 or more are ready by 31 January 2027.

New brackets default to 17:30 UTC. The Summer-to-Winter date field defaults to **2027-01-06**, the Solo start. Do not submit that transfer again.

## Launch steps

1. Done (24 Oct 2026): pre-season from 18 November 2026, Solo from 6 January 2027, Team from 24 February 2027 only if 4 teams of 3 or more are ready by 31 January.
2. Done (25 Sep 2026): Summer-to-Winter transfer. Do not run it again.
3. Correct the existing brackets' start times before generating round one. Solo is 2027-01-06 at 17:30 UTC, with applications closing 2026-12-13.
4. Schedule the five pre-season matches listed above, at 17:30 UTC. No episodes on 23 or 30 December.
5. When public applications reopen, enable the `apply` page and endpoint, then verify `/shows/klustered/apply` while signed out, then verify sign-in and self-application.
6. Review applications, confirm 8 Solo entries, then generate Solo round one and publish match dates.
7. On 31 January 2027, start the Team bracket on 24 February only if 4 teams of 3 or more are ready.

Draft and finished brackets cannot accept new applications after this change. An active bracket with no registration closing time remains open until an admin finishes it.
