# Account Shop Cosmetics Real Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make account-shop cosmetics visibly affect the local game UI after purchase and equip.

**Architecture:** Keep cosmetics as presentation-only state in `App.tsx`. Load equipped cosmetics from `/cosmetics/me`, derive profile/background/skin/battle-effect helpers, and pass them into existing shell, topbar, dog badge, dice, and battle VFX surfaces.

**Tech Stack:** React, TypeScript, CSS, Vitest structure tests, existing Fastify cosmetics API.

---

### Task 1: Lock Expected Wiring With Tests

**Files:**
- Modify: `src/App.structure.test.ts`
- Modify: `src/App.css.test.ts`

- [ ] **Step 1: Write failing tests**

Add assertions that `App.tsx` loads `/cosmetics/me`, stores `equippedCosmetics`, passes cosmetics into `Shell`, refreshes after purchase/equip, and wires `cosmeticDogAsset`, `cosmeticDogSkinClass`, and `cosmeticBattleFxClass` into battle components. Add CSS assertions for `.app-shell.cosmetic-background-*`, `.cosmetic-avatar-*`, `.dog-badge-skin-*`, and `.battle-fx-*`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/App.structure.test.ts src/App.css.test.ts`
Expected: FAIL because helper names and CSS selectors are not implemented yet.

### Task 2: Add Cosmetic Presentation Helpers

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement helper records and accessors**

Add records for title labels, avatar labels, background ids, dog skin ids, and battle effect ids. Add helper functions that resolve equipped cosmetics by slot and produce class names or display labels.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/App.structure.test.ts src/App.css.test.ts`
Expected: Remaining failures only around component wiring or CSS selectors.

### Task 3: Wire Cosmetics Into UI

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Root state and refresh**

Add `equippedCosmetics` state and `loadCosmetics` callback. Refresh it after login, `/me`, purchase, and equip. Pass it through `Shell`, account shop/settings, and `BattleView`.

- [ ] **Step 2: Visible surfaces**

Update `Shell`, `TopBar`, `DogTraitSummary`, `BattleView`, `BattleStage`, `BattleDog`, `BattleDice`, and `BattleFxStage` so equipped cosmetics affect visible class names, labels, and player-side dog badge sources.

- [ ] **Step 3: Run focused tests**

Run: `npm test -- src/App.structure.test.ts src/App.css.test.ts`
Expected: CSS selector failures remain until styling is added.

### Task 4: Add Styles

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add compact visible styles**

Add background theme classes, avatar badge classes, dog skin overlays, and battle effect glow/animation classes without new image downloads.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/App.structure.test.ts src/App.css.test.ts`
Expected: PASS.

### Task 5: Final Verification

**Files:**
- Generated: `dist-click/DogFight-standalone.cmd`
- Generated: `dist-click/index.html`

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: exit 0, including guard, TypeScript, Vite, and standalone packaging.
