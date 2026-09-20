# Stable browser-test contract

The Playwright journeys use semantic roles first. `data-testid` is reserved for
stateful or repeated elements that cannot be addressed unambiguously by role and
accessible name.

| Selector                            | Route(s)                   | Contract                                                                          |
| ----------------------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `display-name`                      | `/join`                    | Contestant's public display name.                                                 |
| `room-code-input`                   | `/join`                    | Public room-code entry.                                                           |
| `team-choice-{teamId}`              | `/join`                    | Choose an available team.                                                         |
| `join-room`                         | `/join`                    | Join the selected room and team.                                                  |
| `room-code`                         | host/display               | Show the public code as text.                                                     |
| `room-phase`                        | host/play/audience/display | Expose the current phase in text.                                                 |
| `connection-status`                 | all live routes            | `connecting`, `connected`, `reconnecting`, or `offline`.                          |
| `team-roster`                       | host/display               | Contain admitted team names.                                                      |
| `start-game`                        | host                       | Start the room.                                                                   |
| `advance-phase`                     | host                       | Advance through deterministic seeded phases.                                      |
| `complete-game`                     | host                       | Finish the seeded game and project its result.                                    |
| `host-correct`                      | host                       | Open score-correction controls.                                                   |
| `host-private-answer`               | host                       | Prove the E2E fixture contains its private marker; never render for another role. |
| `mint-{role}-invite`                | host                       | Create a production `player`, `audience`, or `display` invitation.                |
| `{role}-invite-code`                | host                       | Show the newly minted opaque invitation code.                                     |
| `copy-{role}-invite`                | host                       | Copy the corresponding invitation code.                                           |
| `host-team-id`                      | host                       | Choose the authoritative team for host-operated mechanics.                        |
| `host-team-name`                    | host                       | Name the team being assembled.                                                    |
| `add-team`                          | host                       | Add or update a live team.                                                        |
| `spin-wheel`                        | host                       | Dispatch a Spinlock spin for the selected team.                                   |
| `spin-letter`                       | host                       | Enter one Spinlock letter.                                                        |
| `guess-letter`                      | host                       | Dispatch the selected team's Spinlock letter guess.                               |
| `lifeline-fifty-fifty`              | host                       | Use the selected team's 50:50 lifeline.                                           |
| `lifeline-ask-audience`             | host                       | Use the selected team's audience lifeline.                                        |
| `chaser-answer`                     | host                       | Enter Race Condition's authoritative chaser answer.                               |
| `submit-chaser-answer`              | host                       | Dispatch the chaser answer.                                                       |
| `score-{teamId}`                    | host/display/play          | Show the authoritative team score.                                                |
| `question`                          | play/audience/display      | Show the currently public prompt.                                                 |
| `answer-option-{id}`                | play/audience              | Submit a seeded answer option.                                                    |
| `answer-input`                      | play/audience              | Enter text where the game accepts it.                                             |
| `submit-answer`                     | play/audience              | Submit the current response.                                                      |
| `buzzer`                            | play                       | Attempt a Race Condition buzz.                                                    |
| `buzzer-winner`                     | host/display/play          | Show the one authoritative winner.                                                |
| `spin-board`                        | host/display/play          | Contain the Spinlock puzzle.                                                      |
| `reveal-answer`                     | host                       | Reveal the current answer.                                                        |
| `revealed-answer`                   | host/play/audience/display | Contain the answer only after reveal.                                             |
| `audience-distribution`             | host/display               | Show Null Pointer results after freeze.                                           |
| `audience-aggregate`                | host                       | Show the authoritative number of audience responses committed by the room.        |
| `freeze-distribution`               | host                       | Atomically close audience answers and freeze rarity.                              |
| `game-complete`                     | all live routes            | Mark the terminal phase.                                                          |
| `leaderboard-row-{roomId}-{teamId}` | `/leaderboards`            | Contain the exact freshly projected room result and score.                        |
| `audience-bin-{answerSlug}`         | host/display               | Show the exact frozen Null Pointer count for one answer.                          |

Forms must expose persistent labels, errors through `aria-describedby`, and
pending state without replacing their accessible name. Live score/phase updates
use a polite live region; urgent connectivity failure uses an assertive status.
Focus returns to the triggering control when a dialog closes and moves to the
round heading after a host phase transition.
