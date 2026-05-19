# Dog Emperor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add picture-based dog avatars and a selectable Dog Emperor whose lucky number can double triggered item effects.

**Architecture:** Dog identity remains a shared string union in server and client code. Lucky number state is stored on runs, copied into ghost snapshots and fighter snapshots, then interpreted inside battle item resolution. Static PNG avatars are served from `public/assets/dogs`.

**Tech Stack:** React, Fastify, Prisma SQLite, TypeScript, Vitest, Vite.

---

### Task 1: Baseline And Tests

**Files:**
- Modify: `src/server/game.test.ts`
- Modify: `src/server/api.test.ts`
- Modify: `src/App.structure.test.ts`

- [ ] Run `npm test` before edits and record whether the current workspace is already passing.
- [ ] Add failing server tests proving Dog Emperor is defined and lucky-number doubling applies only on matching rolls.
- [ ] Add failing API tests proving `/api/runs` accepts `dogType: "EMPEROR"` with `luckyNumber`, and rejects invalid/missing lucky numbers for Dog Emperor.
- [ ] Add failing frontend structure tests proving `EMPEROR` appears in the dog gallery and dog assets point to PNG files.
- [ ] Run targeted tests and confirm failures are due to missing Dog Emperor behavior.

### Task 2: Backend Model And Battle Logic

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/server/game/types.ts`
- Modify: `src/server/game/data.ts`
- Modify: `src/server/game/battle.ts`
- Modify: `src/server/state.ts`
- Modify: `src/server/app.ts`

- [ ] Add nullable `luckyNumber` fields to `Run` and `GhostSnapshot`.
- [ ] Add `EMPEROR` to `DogType` and `DOGS`.
- [ ] Add optional `luckyNumber` to fighter and battle snapshots.
- [ ] Persist lucky number on run creation and ghost snapshots.
- [ ] Require `1-6` lucky number only when creating Dog Emperor runs.
- [ ] In battle resolution, when actor is Dog Emperor and roll equals lucky number, apply a 50% chance to double each triggered item effect.
- [ ] Preserve existing Bully large-item doubling behavior.

### Task 3: Frontend And Assets

**Files:**
- Copy: `picture/*.png` to `public/assets/dogs/*.png`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] Copy the provided dog PNGs into public assets with stable ASCII filenames.
- [ ] Add `EMPEROR` to the client dog type, names, traits, strategies, tags, and options.
- [ ] Change existing dog asset paths from SVG to provided PNG files.
- [ ] Add a lucky-number selector in DogSelect that appears only for Dog Emperor and submits `{ dogType, luckyNumber }`.
- [ ] Display lucky number in Dog Emperor detail copy without affecting other dog selection flows.

### Task 4: Verification

**Files:**
- All changed files

- [ ] Run targeted Vitest files touched by this feature.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Report exact verification results and any known limitations.
