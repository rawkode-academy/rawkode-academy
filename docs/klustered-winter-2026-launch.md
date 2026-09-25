# Klustered Winter 2026 launch

Status checked 23 September 2026.

## What exists

- The Winter 2026 season is already in the bracket data, with status `interest` and no published dates.
- The public application route is `https://rawkode.academy/shows/klustered/apply`. It has not been removed; it needs an active, eligible bracket to show an application option.
- Until the Winter relaunch is ready, the public site exposes only the Apply page. Seasons, bracket listings, schedules, the live endpoint, and the calendar feed are hidden for Klustered.
- The public schedule currently has no Winter matches. Do not generate fixtures until applications have been reviewed and entries are ready.

## Provisional target

Use **30 October 2026** as the target season start date. This is a planning date based on “the end of October”; confirm the actual day and match start time with the organizers before announcing it. Leave the season end date unset until the Winter format and cadence are agreed.

Bracket start and registration closing times are entered in UTC. Set the individual and team bracket dates once the event schedule is agreed. This change does not publish registration dates, fixtures, or participant data.

## Launch steps

1. In `klustered.dev/admin/seasons`, find the existing Winter 2026 season and set its start date to the agreed date. Set status to `active` when the season is ready to be announced.
2. In `klustered.dev/admin/brackets`, create the individual and team brackets with agreed start times and registration closing times. New brackets stay in `draft`.
3. Keep each bracket in `draft` while applications should remain closed. Set it to `active` when applications are meant to open. Active status opens applications immediately; this portal does not schedule a future opening time.
4. Verify `/shows/klustered/apply` while signed out, then verify sign-in and self-application. Confirm the close time before opening if you do not want applications left open until the bracket is finished.
5. Review applications, confirm competitors/teams, then generate round one and publish match dates.

Draft and finished brackets cannot accept new applications after this change. An active bracket with no registration closing time remains open until an admin finishes it.
