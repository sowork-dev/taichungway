# Original Taichung water-balloon grid rules

`public/bubble-core.js` is a dependency-free deterministic UMD engine: `window.BubbleCore` in a browser and `require()` in Node. It uses only caller-provided clocks and input. No bots, fake opponents, policy-reading gates, network requests, third-party game assets or authentication fields are part of this engine.

## Public integration contract

- Constants: `GAME_KIND='bubble'`, `COLS=9`, `ROWS=13`, `CELL=64`, `WORLD_WIDTH=576`, `WORLD_HEIGHT=832`, `SPEED=DASH_SPEED=200`, `ACTIONS=['bomb']`.
- Legacy compatibility exports `LANDMARKS`, `TARGETS`, `PICKUP_SLOTS` are empty. Taichung decoration belongs outside the board in the renderer.
- `createGame({now=0,roundMs=60000,countdownMs=2000})` returns authoritative mutable state; its input queues, options and monotonic counters are private WeakMap state. Options require finite clock/durations, positive round duration and nonnegative countdown.
- `addPlayer(g,id,now)`, `removePlayer(g,id,now)`, `rematch(g,id,now)` return a boolean. There are at most two unique nonempty string player IDs.
- `setInput(g,id,{x,y,bomb})` updates the dominant cardinal movement axis and OR-latches literal `bomb:true` until the next step. Unknown players and malformed input objects are rejected. Nonfinite directions become zero. Input is intent, not client authority over positions or scores.
- `step(g,now)` advances the authoritative game. Nonfinite and backward clocks are ignored. Movement delta is capped at 50ms; clocks, fuses and deadlines are not slowed by that cap.
- `snapshot(g)` returns detached public state: kind, grid dimensions, phase/times/remainingMs/mode, players, bombs, blasts, crates, walls, winners and the latest 40 events. Public player fields are explicitly selected; caller-added auth/resume credentials are excluded.
- `canStand(x,y,gOrSnapshot?)` uses radius 15 and live walls/crates/bombs. Without a world it uses the original crate layout. Public calls treat bombs as solid.
- `findPath(x,y,tx,ty,gOrSnapshot?)` performs deterministic cardinal BFS through current walkable cell centers, includes the exact start and safe exact target, and returns `[]` when unavailable. Pass the live world for cleared routes and bomb collision. The actual player at the start is inferred for fresh-bomb escape.
- `cellOf(x,y)` and `cellCenter(c,r)` expose grid conversion. Optional `movePlayer(p,x,y,dt,speed=200,g)` uses the same radius-aware movement and capped speed; gameplay callers should use `setInput` / `step` so phase and trapping rules remain authoritative.
- `blastCells(g,bomb)` returns `{c,r}[]` for rendering the exact current preview geometry.

## Board and movement

Cells are centered at `(c+.5)*64,(r+.5)*64`. Borders are solid; inner even-column/even-row cells are solid. Team 0 starts at `(1,1)` / `(96,96)`; team 1 starts at `(7,11)` / `(480,736)`. Sixteen symmetric crates include the specified twelve plus `(1,7),(7,5),(3,11),(5,1)`. All fifteen existing policy-catalog topic IDs appear deterministically, with short semantic labels only and no invented policy claims.

Starting corridors remain open except the intended first-bomb targets at `(3,1)` and `(5,11)`, each in range two of its spawn. Clearing crates creates normal walkable connected floor routes. Movement uses small collision slices to prevent tunneling and snaps within 12px of a lane center for joystick turns. Positions are normalized to six decimal places to avoid accumulating floating-point residue.

A freshly placed bomb records all players overlapping its tile in `passIds`. Those players can escape; permission is removed as soon as their center leaves the tile. If their radius still overlaps the old tile, collision permits only further outward separation, never movement back into the bomb. This avoids both boundary trapping and return-through-bomb exploits.

## Balloons, water and scoring

The only action places a water balloon in the player's current tile. Placement requires practice/playing state, no trap, no existing balloon in that tile, fewer than two active owned balloons and an elapsed 350ms placement cooldown. Requests are consumed even if placement is rejected. Only an actual placement emits `place`.

A balloon has a 1800ms fuse and range two. Water covers its own cell and four cardinal rays, stops before a wall, includes the first live crate and stops there. Chain reactions follow encountered balloons once each, deterministically. Within one reaction wave, geometry is calculated before any crate is destroyed, so one ray does not incorrectly shoot through a crate just destroyed by another balloon. A crate can be destroyed once and emits `destroy` with owner playerId, topicId and center coordinates. Each balloon emits `splash` and leaves water for 450ms measured from its fuse/chain detonation time.

- Practice: +1 per destroyed crate; real movement and bombs, no artificial opponent and no timed ending.
- PvP: crates open routes but give no points. An opponent water capture gives +1; self-hit gives zero. Both trap for 1000ms and grant 2500ms immunity. A capture event includes scorer playerId, victimId, position and points.
- Active water can hit a player entering its cell, but immunity and trapping prevent repeated capture during the hit window. If both own and enemy water touch a victim simultaneously, enemy water takes scoring precedence.
- All simultaneous victims are resolved before evaluating first-to-three. Highest score wins; equal highest scores produce multiple winnerIds.
- The exact round deadline finishes before new actions or late explosions. Finished games cannot earn more points.

## Real two-player lifecycle

One human is in practice. A second genuine player resets positions, input, bombs, water, crates, scores, traps and immunity, then starts a two-second countdown. Countdown blocks movement/actions and clears queued input. Round expiry is anchored to countdown completion, not a delayed server tick.

After finishing, both distinct players must request rematch before another clean countdown. A disconnect resets any survivor to practice and never simulates a late phantom win. Event IDs remain monotonic across arena resets; the event ring retains only the latest 40.

## Verification

Run the scoped engine tests on the deployment target:

```sh
npx --yes --package=node@22.22.2 node --test tests/bubble-core.test.cjs
```

The tests exercise real engine state, collisions, owner escape, exact fuse/water lifetime, chain reactions, live pathfinding and actual route traversal, trap/immunity, scoring/ties/deadline, rematch/disconnect, input validation, detached snapshots and identical Node/browser UMD simulation.
