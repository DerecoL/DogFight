# Player Nickname Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required post-registration nickname setup flow and persist nicknames for later use in player-facing battle identity.

**Architecture:** Store `nickname` directly on `User` and expose a single authenticated profile update endpoint that can be reused later for nickname edits. The React app gates only newly registered sessions behind a nickname setup view before entering dog selection or an active run.

**Tech Stack:** React 19, Vite, Fastify, Prisma, SQLite, Vitest, Supertest.

---

## File Structure

- Modify `prisma/schema.prisma`: add nullable `User.nickname`.
- Modify `scripts/init-db.cjs`: add `nickname` to fresh SQLite initialization and backfill existing local DBs.
- Modify `src/server/app.ts`: add public user response helper, registration `needsNickname`, nickname endpoint, and nickname usage in matchmaking/battle.
- Modify `src/server/api.test.ts`: add red tests for nickname setup and nickname use.
- Modify `src/App.tsx`: add user nickname state, post-registration gate, setup form, and profile endpoint call.
- Modify `src/App.css`: add minimal styling for nickname setup helper text.
- Modify `src/App.structure.test.ts`: add structure checks for the nickname setup screen and endpoint path.

### Task 1: Backend Nickname Contract

**Files:**
- Modify: `src/server/api.test.ts`
- Modify: `prisma/schema.prisma`
- Modify: `scripts/init-db.cjs`
- Modify: `src/server/app.ts`

- [ ] **Step 1: Write the failing API test**

Add a test that registers a user, expects `needsNickname: true`, rejects bad nicknames, saves a valid nickname, and verifies `/api/me` returns it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/server/api.test.ts`

Expected: FAIL because `needsNickname` and `/api/profile/nickname` do not exist yet.

- [ ] **Step 3: Add persistence and API implementation**

Add `nickname String?` to `User`, add migration support to `scripts/init-db.cjs`, create a `publicUser` helper, return nickname in auth/me responses, and implement `POST /api/profile/nickname`.

- [ ] **Step 4: Run the API test to verify it passes**

Run: `npm test -- src/server/api.test.ts`

Expected: PASS for the new nickname contract and existing API tests.

### Task 2: Nickname In Game Identity

**Files:**
- Modify: `src/server/api.test.ts`
- Modify: `src/server/app.ts`

- [ ] **Step 1: Write the failing API test**

Extend the register/create/match/battle test to set nickname `猛犬教练` and assert `matchedGhost.name` and `battle.playerSnapshot.name` use it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/server/api.test.ts`

Expected: FAIL because ghost and battle snapshots still use fixed player names.

- [ ] **Step 3: Use nickname in matchmaking and battle**

Read the current user in match and battle start handlers, derive `user.nickname ?? '玩家'`, and pass it into ghost creation and `snapshotFromRun`.

- [ ] **Step 4: Run the API test to verify it passes**

Run: `npm test -- src/server/api.test.ts`

Expected: PASS.

### Task 3: Frontend Registration Gate

**Files:**
- Modify: `src/App.structure.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the failing structure test**

Assert `App.tsx` contains `needsNickname`, `NicknameSetup`, and `/profile/nickname`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/App.structure.test.ts`

Expected: FAIL because the nickname setup screen is not implemented.

- [ ] **Step 3: Add the setup screen**

Track `needsNicknameSetup` after registration, render `NicknameSetup` before `DogSelect` or game content, call `/api/profile/nickname`, and clear the gate after success.

- [ ] **Step 4: Run the structure test to verify it passes**

Run: `npm test -- src/App.structure.test.ts`

Expected: PASS.

### Task 4: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Generate Prisma client and sync local DB**

Run: `npx prisma generate` and `npm run db:push`.

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

## Self-Review

The plan covers the approved design: persistence, required post-registration setup, future edit endpoint, no visible edit UI, and nickname use in player identity. There are no placeholder tasks. Commit steps are omitted because `D:\AI\DogFight` is not a git repository.
