# TapTap Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal TapTap login flow that maps TapTap mini game identities into the existing DogFight user system.

**Architecture:** The server owns TapTap `code2Session` exchange and emits the existing JWT cookie after finding or creating a local user. The database stores third-party identity links in a new `UserIdentity` table. The React app chooses the TapTap login button only when built for the TapTap channel and the TapTap API is present.

**Tech Stack:** React, Vite, Fastify, Prisma, Vitest, TypeScript.

---

### Task 1: Server Configuration and TapTap Client

**Files:**
- Modify: `src/server/config.ts`
- Modify: `src/server/config.test.ts`
- Create: `src/server/taptap-auth.ts`
- Create: `src/server/taptap-auth.test.ts`

- [ ] **Step 1: Write failing config tests**

Add tests asserting `TAPTAP_MINIAPP_ID`, `TAPTAP_MINIAPP_SECRET`, and `TAPTAP_MINIAPP_REGION` parse into server config, and invalid regions throw.

- [ ] **Step 2: Run config tests to verify failure**

Run: `npm test -- src/server/config.test.ts`
Expected: FAIL because `taptap` config does not exist.

- [ ] **Step 3: Implement config parsing**

Add `taptap: { appId, secret, region }` to `ServerConfig`, default region to `cn`, and reject unknown regions.

- [ ] **Step 4: Write failing TapTap client tests**

Test URL selection, successful JSON parsing, and TapTap error payload handling through injected `fetch`.

- [ ] **Step 5: Run TapTap client tests to verify failure**

Run: `npx vitest run src/server/taptap-auth.test.ts`
Expected: FAIL because `src/server/taptap-auth.ts` does not exist.

- [ ] **Step 6: Implement TapTap client**

Create `exchangeTapTapCode(config, code, fetchFn)` that calls `jscode2session` and returns `{ openid, unionid, sessionKey }`.

### Task 2: Database Identity Binding and Auth Route

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/server/app.ts`
- Modify: `src/server/api.test.ts`

- [ ] **Step 1: Write failing route tests**

Add tests for `POST /api/auth/taptap`: first login creates a user, repeated login reuses the user, and TapTap exchange failure returns 401.

- [ ] **Step 2: Run route tests to verify failure**

Run: `npx vitest run src/server/api.test.ts --maxConcurrency=1`
Expected: FAIL because `/api/auth/taptap` is missing.

- [ ] **Step 3: Add Prisma model**

Add `UserIdentity` with `(provider, providerUserId)` uniqueness and a relation to `User`.

- [ ] **Step 4: Implement route**

Add `POST /api/auth/taptap` that validates `code`, calls `exchangeTapTapCode`, upserts/finds `UserIdentity`, creates a local `User` when needed, sets the existing `token` cookie, and returns `publicUser`.

- [ ] **Step 5: Run route tests to verify pass**

Run: `npx vitest run src/server/api.test.ts --maxConcurrency=1`
Expected: PASS.

### Task 3: Frontend TapTap Login Entry

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.structure.test.ts`

- [ ] **Step 1: Write failing frontend structure tests**

Assert that the source contains TapTap channel detection and `/auth/taptap`, and that existing username/password controls remain.

- [ ] **Step 2: Run frontend tests to verify failure**

Run: `npx vitest run src/App.structure.test.ts`
Expected: FAIL because TapTap login code is absent.

- [ ] **Step 3: Implement TapTap login entry**

Add TapTap API types, `VITE_CHANNEL` detection, `loginWithTapTap`, a TapTap login button, and a fallback message when TapTap channel is built without API availability.

- [ ] **Step 4: Run frontend tests to verify pass**

Run: `npx vitest run src/App.structure.test.ts`
Expected: PASS.

### Task 4: Verification and Delivery

**Files:**
- Modify as required by generated Prisma client or build output.

- [ ] **Step 1: Run targeted tests**

Run: `npx vitest run src/server/config.test.ts src/server/taptap-auth.test.ts src/App.structure.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS and regenerate `dist-click/DogFight-standalone.cmd`.

- [ ] **Step 4: Commit, merge, deploy, push**

Commit implementation branch, switch to `main`, merge branch, run the repository's online deployment command, and push `main` to the remote.
