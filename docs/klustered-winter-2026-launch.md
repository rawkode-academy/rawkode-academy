# Klustered Winter 2026 launch

Status checked 25 September 2026.

## What exists

- The Winter 2026 season is already in the bracket data, with status `interest` and no published dates.
- The public application route is `https://rawkode.academy/shows/klustered/apply`. It has not been removed; it needs an active, eligible bracket to show an application option.
- Until the Winter relaunch is ready, the public site exposes only the Apply page. Seasons, bracket listings, schedules, the live endpoint, and the calendar feed are hidden for Klustered.
- The public schedule currently has no Winter matches. Do not generate fixtures until applications have been reviewed and entries are ready.

## Provisional target

Use **30 October 2026** as the target season start date. This is a planning date based on “the end of October”; confirm the actual day and match start time with the organizers before announcing it. Leave the season end date unset until the Winter format and cadence are agreed.

Bracket start and registration closing times are entered in UTC. The Summer-to-Winter action defaults to 19:00 UTC on 30 October, matching the existing bracket convention; change the date or time if the organizers choose another schedule. The action leaves the registration close unset, so applications stay open until an admin finishes each bracket.

## Carrying Summer applications forward

The current Summer 2026 season has four pending applications across Solo and Team, three competitor profiles, and no teams, entries, matches, or legacy registrations. Use the **Move applications and delete Summer** action on the Summer row in `klustered.dev/admin/seasons` after confirming the Winter date and time.

The action creates and activates the matching Winter brackets, reassigns the existing application and competitor records while preserving their IDs and review state, activates Winter, and deletes Summer in one D1 batch. It refuses to run if Winter already has brackets, applications, or competitor data, or if Summer has other linked competition data that would be deleted.

## Launch steps

1. Confirm the 30 October date and bracket start time with the organizers.
2. On the Summer row in `klustered.dev/admin/seasons`, run **Move applications and delete Summer**. This opens the matching Winter Solo and Team brackets immediately.
3. Verify `/shows/klustered/apply` while signed out, then verify sign-in and self-application.
4. Review the transferred and new applications, confirm competitors/teams, then generate round one and publish match dates.

Draft and finished brackets cannot accept new applications after this change. An active bracket with no registration closing time remains open until an admin finishes it.
