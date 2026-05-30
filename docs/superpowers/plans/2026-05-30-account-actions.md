# Account Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move account shop and achievements into the player history panel and add a personal settings screen for equipping owned cosmetics.

**Architecture:** Reuse the existing `AppScreen` routing and cosmetics APIs. Keep purchasing in `AccountShopScreen`, add a focused `AccountSettingsScreen` for owned cosmetics, and move lobby account navigation into `PlayerRunHistoryPanel`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing Fastify account APIs.

---

### Task 1: Structure Test

**Files:**
- Modify: `src/App.structure.test.ts`

- [ ] **Step 1: Write the failing structure expectations**

Update the account shell test to require `SETTINGS`, `AccountSettingsScreen`, `account-panel-actions`, and to reject the old `account-hub-actions` lobby block.

- [ ] **Step 2: Run the targeted test**

Run: `npx vitest run src/App.structure.test.ts -t "wires account shop"`

Expected: FAIL because `SETTINGS` and `AccountSettingsScreen` do not exist yet.

### Task 2: React Routing And Components

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `SETTINGS` to `AppScreen`**

Extend the union with `SETTINGS`.

- [ ] **Step 2: Move account actions into `PlayerRunHistoryPanel`**

Pass `onEnterShop`, `onEnterAchievements`, and `onEnterSettings` from the lobby render into `PlayerRunHistoryPanel`; remove these props and buttons from `ModeLobby`.

- [ ] **Step 3: Add `AccountSettingsScreen`**

Load `/cosmetics/me`, group owned cosmetics by type, and call `/cosmetics/equip` from each owned item card. Keep the existing direct equip action in the shop.

### Task 3: Styling

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add account action group styles**

Add `.account-panel-actions` and `.account-panel-button` styles matching current account buttons.

- [ ] **Step 2: Add settings grid styles**

Reuse `.shop-section-grid`, `.shop-cosmetic-card`, and `.shop-card-actions` where possible; add only the empty-state and current-equipped styles needed.

### Task 4: Verification

**Files:**
- Modify: `dist-click/index.html`
- Modify: `dist-click/DogFight-standalone.cmd`

- [ ] **Step 1: Run focused structure test**

Run: `npx vitest run src/App.structure.test.ts -t "wires account shop"`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS and regenerate the standalone playable files.
