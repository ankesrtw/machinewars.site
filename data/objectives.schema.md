# Objective vocabulary — hard cap of 11 types

ROADMAP-V2 §4.3 / `docs/track-b-content.md` §2.1. **This list is a hard cap — do
not add a 12th type without deleting one.** In Unity each becomes a small
`ObjectiveSO` subclass (§4.6); the type string is the discriminator the
importer switches on.

Every objective is an object with at least `type`; other fields depend on the
type as listed below. `optional: true` may be added to any objective (not
listed per-type since it composes with all of them) — mission `rewards` still
grant on completion of required objectives only.

| # | `type` | Fields | Meaning |
|---|---|---|---|
| 1 | `survive_waves` | `count` | Clear `count` waves of the mission's `waveSet`. |
| 2 | `kill_count` | `count` | Kill `count` enemies of any type. |
| 3 | `kill_type` | `enemy`, `count` | Kill `count` enemies of a specific `data/enemies.data.js` type. |
| 4 | `protect` | `targetId`, `hp` | Keep the named `Entity` above 0 HP (starts at `hp`) until the objective/mission ends. |
| 5 | `reach_zone` | `zoneId` | Player (or an escorted follower) enters the named marked volume. |
| 6 | `time_limit` | `seconds` | Complete the mission (or a bound objective) within `seconds`. |
| 7 | `no_damage` | — | Complete the mission without the player taking damage. |
| 8 | `weapon_restriction` | `weapon` | Complete the mission using only the named `data/weapons.data.js` weapon. |
| 9 | `destroy_targets` | `targetGroup`, `count` | Destroy `count` `Entity` instances tagged with `targetGroup`. |
| 10 | `rescue` | `targetGroup`, `count` | Reach and extract `count` `Entity` instances tagged with `targetGroup` (their state moves `intact → rescued`). |
| 11 | `escort` | `targetId`, `zoneId` | Get the named follower `Entity` to `zoneId` alive. |

## Notes

- `protect`/`destroy_targets`/`rescue`/`escort` all depend on the `Target` +
  `Entity` primitives (ROADMAP-V2 §4.3/track-b §2.5) — **not built yet**. This
  task (P0.7) only authors the data shape; nothing runs these objectives until
  that runtime lands (Unity, per §4.6).
- `type` values are the only field validated against this table by
  `tools/validate-missions.mjs` (P0.7) — every other field is free-form per
  type, matching the loose validation the mission author needs at this stage.
