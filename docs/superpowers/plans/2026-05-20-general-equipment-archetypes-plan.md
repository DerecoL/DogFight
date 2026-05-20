# 通用装备流派补强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 4 件通用装备：血契犬牙、爆鸣计数器、磨牙成长剑、逆毛净化梳，让通用装备池支持吸血摆位、30 次触发爆发、无限成长和反增益克制。

**Architecture:** 复用现有装备定义、品质倍率、触发队列和战斗事件结构。服务端权威逻辑放在 `src/server/game/data.ts`、`src/server/game/types.ts`、`src/server/game/battle.ts`；单文件可玩版的 mock 逻辑在 `scripts/package-click-index.mjs` 同步实现；外部 Excel 数值表同步记录新装备与期望模型。

**Tech Stack:** TypeScript, Vitest, React/Vite, Node.js build script, Excel workbook `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`

---

## 文件结构

- Modify: `E:\AI-GPT\DogFight\src\server\game\types.ts`
  - 新增 `AdvancedEffect` 枚举值：`GRANT_LIFESTEAL_ADJACENT`、`BOOM_COUNTER`、`GROWTH_DAMAGE`、`PURGE_ENEMY_BUFFS`。
- Modify: `E:\AI-GPT\DogFight\src\server\game\data.ts`
  - 新增 4 件通用装备定义。
  - 新增 `itemDescription()` 分支，保证前端、商店和单文件版描述一致。
- Modify: `E:\AI-GPT\DogFight\src\server\game\battle.ts`
  - 在战斗状态中记录吸血装备、爆鸣计数和成长剑当前伤害。
  - 在装备成功触发时统一计数。
  - 在直接伤害后处理吸血、爆鸣爆发、成长和净化。
- Modify: `E:\AI-GPT\DogFight\src\server\game.test.ts`
  - 增加服务端 TDD 测试，覆盖装备定义、吸血、计数器、成长剑、净化梳。
- Modify: `E:\AI-GPT\DogFight\src\App.effect-text.test.ts`
  - 增加描述文本回归，确保新增关键词能在客户端文案中出现。
- Modify: `E:\AI-GPT\DogFight\scripts\package-click-index.mjs`
  - 同步新增装备定义、描述、战斗逻辑、单文件 mock 战斗实现。
- Modify: `E:\AI-GPT\DogFight\scripts\package-click-index.test.mjs`
  - 增加单文件 mock 包含新装备定义和描述的测试。
- Modify: `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`
  - 更新 `通用装备`、`数值模型-装备期望`、`数值模型-平衡看板` 中的新装备数值、触发频率、克制备注和统计摘要。

## Task 1: 新装备类型与定义

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\types.ts`
- Modify: `E:\AI-GPT\DogFight\src\server\game\data.ts`
- Test: `E:\AI-GPT\DogFight\src\server\game.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/server/game.test.ts` 的 `describe('dog and item definitions', ...)` 内追加：

```ts
  it('defines the new common archetype equipment with exact tuning', () => {
    expect(itemDef('v4-blood-contract-fang')).toMatchObject({
      size: 2,
      price: 12,
      dice: [1, 6],
      tags: ['lifesteal', 'support', 'extreme'],
      effect: { type: 'UTILITY', amount: 0 },
      advancedEffect: 'GRANT_LIFESTEAL_ADJACENT',
      defaultQuality: 'GOLD',
    })
    expect(itemDef('v4-boom-counter')).toMatchObject({
      size: 2,
      price: 14,
      dice: [1, 2, 3, 4, 5, 6],
      tags: ['counter', 'trigger', 'damage'],
      effect: { type: 'UTILITY', amount: 300, qualityBase: 'GOLD' },
      advancedEffect: 'BOOM_COUNTER',
      defaultQuality: 'GOLD',
    })
    expect(itemDef('v4-growing-chew-sword')).toMatchObject({
      size: 2,
      price: 9,
      dice: [2, 3, 4],
      tags: ['growth', 'damage', 'stable'],
      effect: { type: 'DAMAGE', amount: 1, qualityBase: 'SILVER' },
      advancedEffect: 'GROWTH_DAMAGE',
      defaultQuality: 'SILVER',
    })
    expect(itemDef('v4-reverse-fur-comb')).toMatchObject({
      size: 1,
      price: 8,
      dice: [3, 4],
      tags: ['cleanse', 'heal', 'counter'],
      effect: { type: 'UTILITY', amount: 3, qualityBase: 'SILVER' },
      advancedEffect: 'PURGE_ENEMY_BUFFS',
      defaultQuality: 'SILVER',
    })

    expect(shopPool('GENERAL').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v4-blood-contract-fang',
      'v4-boom-counter',
      'v4-growing-chew-sword',
      'v4-reverse-fur-comb',
    ]))
    expect(shopPool('MEDIUM').map((item) => item.id)).toEqual(expect.arrayContaining([
      'v4-blood-contract-fang',
      'v4-boom-counter',
      'v4-growing-chew-sword',
    ]))
    expect(shopPool('SMALL').map((item) => item.id)).toContain('v4-reverse-fur-comb')
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game.test.ts -t "new common archetype equipment"
```

Expected: FAIL，错误包含 `Unknown item def v4-blood-contract-fang`。

- [ ] **Step 3: 增加类型**

在 `src/server/game/types.ts` 的 `AdvancedEffect` 联合类型末尾追加：

```ts
  | 'GRANT_LIFESTEAL_ADJACENT'
  | 'BOOM_COUNTER'
  | 'GROWTH_DAMAGE'
  | 'PURGE_ENEMY_BUFFS'
```

- [ ] **Step 4: 增加装备定义**

在 `src/server/game/data.ts` 的 `ITEM_DEFS` 中，放在 `v3-golden-kennel` 后面追加：

```ts
  slotItem('v4-blood-contract-fang', '血契犬牙', 2, 12, [1, 6], ['lifesteal', 'support', 'extreme'], { type: 'UTILITY', amount: 0 }, {
    description: '触发时，使左边 1 个相邻装备获得【吸血】直到战斗结束。钻石品质改为使左右相邻装备都获得【吸血】。',
    advancedEffect: 'GRANT_LIFESTEAL_ADJACENT',
    defaultQuality: 'GOLD',
  }),
  slotItem('v4-boom-counter', '爆鸣计数器', 2, 14, [1, 2, 3, 4, 5, 6], ['counter', 'trigger', 'damage'], { type: 'UTILITY', amount: 300, qualityBase: 'GOLD' }, {
    description: '己方装备每成功触发 1 次，获得 1 点爆鸣计数。达到 30 点后清零，对敌方造成 300 点直接伤害。升级只提高伤害。',
    advancedEffect: 'BOOM_COUNTER',
    defaultQuality: 'GOLD',
  }),
  slotItem('v4-growing-chew-sword', '磨牙成长剑', 2, 9, [2, 3, 4], ['growth', 'damage', 'stable'], { type: 'DAMAGE', amount: 1, qualityBase: 'SILVER' }, {
    description: '初始造成 1 点伤害。每次该装备成功触发后，本局内后续伤害 +3，无成长次数上限。',
    advancedEffect: 'GROWTH_DAMAGE',
    defaultQuality: 'SILVER',
  }),
  slotItem('v4-reverse-fur-comb', '逆毛净化梳', 1, 8, [3, 4], ['cleanse', 'heal', 'counter'], { type: 'UTILITY', amount: 3, qualityBase: 'SILVER' }, {
    description: '清除敌方最多 3 层正面增益；每实际清除 1 层，自己恢复 5 点生命。优先清除荆棘，再清除加速层数，最后每 8 点护盾折算 1 层。',
    advancedEffect: 'PURGE_ENEMY_BUFFS',
    defaultQuality: 'SILVER',
  }),
```

- [ ] **Step 5: 增加品质描述分支**

在 `src/server/game/data.ts` 的 `itemDescription()` 中，放在 `SHIELD_IMMUNITY` 分支之后追加：

```ts
  if (advanced === 'GRANT_LIFESTEAL_ADJACENT') return currentQuality === 'DIAMOND'
    ? '触发时，使左右相邻装备都获得【吸血】直到战斗结束。被赋予吸血的装备按实际造成的生命伤害 100% 治疗自己。'
    : '触发时，使左边 1 个相邻装备获得【吸血】直到战斗结束。被赋予吸血的装备按实际造成的生命伤害 100% 治疗自己。'
  if (advanced === 'BOOM_COUNTER') return `己方装备每成功触发 1 次，获得 1 点爆鸣计数。达到 30 点后清零，对敌方造成 ${amount} 点直接伤害。`
  if (advanced === 'GROWTH_DAMAGE') {
    const growth = currentQuality === 'DIAMOND' ? 7 : currentQuality === 'GOLD' ? 5 : 3
    return `初始造成 ${amount} 点伤害。每次该装备成功触发后，本局内后续伤害 +${growth}，无成长次数上限。`
  }
  if (advanced === 'PURGE_ENEMY_BUFFS') {
    const purgeLimit = amount
    const healPerLayer = currentQuality === 'DIAMOND' ? 11 : currentQuality === 'GOLD' ? 8 : 5
    return `清除敌方最多 ${purgeLimit} 层正面增益；每实际清除 1 层，自己恢复 ${healPerLayer} 点生命。优先清除荆棘、加速层数，再按每 8 点护盾折算 1 层。`
  }
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game.test.ts -t "new common archetype equipment"
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/server/game/types.ts src/server/game/data.ts src/server/game.test.ts
git commit -m "feat: add common archetype equipment definitions"
```

## Task 2: 血契犬牙吸血赋能

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\battle.ts`
- Test: `E:\AI-GPT\DogFight\src\server\game.test.ts`

- [ ] **Step 1: 写黄金左侧吸血失败测试**

在 `describe('battle simulation', ...)` 内追加：

```ts
  it('lets gold blood contract fang grant lifesteal to the left adjacent equipment only', () => {
    const player = lateGameFighter('P', 'SHIBA', [
      equipment('left-sword', 'v4-growing-chew-sword', 0, 'SILVER'),
      equipment('fang', 'v4-blood-contract-fang', 2, 'GOLD'),
      equipment('right-bite', 'starter-1', 4, 'BRONZE'),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [
      equipment('enemy-bite', 'starter-1', 0, 'BRONZE'),
    ])

    const result = simulateBattle(player, opponent, 'blood-contract-left')
    const grant = result.events.find((event) => event.itemId === 'fang' && event.text.includes('吸血'))
    const lifestealHeal = result.events.find((event) => event.itemId === 'left-sword' && event.effectType === 'HEAL')
    const rightHeal = result.events.find((event) => event.itemId === 'right-bite' && event.effectType === 'HEAL')

    expect(grant?.text).toContain('左侧')
    expect(lifestealHeal).toMatchObject({ actor: 'player', target: 'player' })
    expect(rightHeal).toBeUndefined()
  })
```

- [ ] **Step 2: 写钻石左右吸血失败测试**

```ts
  it('lets diamond blood contract fang grant lifesteal to both adjacent equipment', () => {
    const player = lateGameFighter('P', 'SHIBA', [
      equipment('left-sword', 'v4-growing-chew-sword', 0, 'SILVER'),
      equipment('fang', 'v4-blood-contract-fang', 2, 'DIAMOND'),
      equipment('right-bite', 'starter-1', 4, 'BRONZE'),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [
      equipment('enemy-bite', 'starter-1', 0, 'BRONZE'),
    ])

    const result = simulateBattle(player, opponent, 'blood-contract-both')
    const leftHeal = result.events.find((event) => event.itemId === 'left-sword' && event.effectType === 'HEAL')
    const rightHeal = result.events.find((event) => event.itemId === 'right-bite' && event.effectType === 'HEAL')

    expect(leftHeal).toMatchObject({ actor: 'player', target: 'player' })
    expect(rightHeal).toMatchObject({ actor: 'player', target: 'player' })
  })
```

- [ ] **Step 3: 写护盾不回血失败测试**

```ts
  it('does not heal lifesteal for damage absorbed by shield', () => {
    const player = lateGameFighter('P', 'SHIBA', [
      equipment('sword', 'v4-growing-chew-sword', 0, 'SILVER'),
      equipment('fang', 'v4-blood-contract-fang', 2, 'GOLD'),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [
      equipment('shield', 'v3-golden-kennel', 0, 'DIAMOND'),
    ])

    const result = simulateBattle(player, opponent, 'blood-contract-shield')
    const shieldedDamage = result.events.find((event) => event.itemId === 'sword' && event.effectType === 'DAMAGE' && event.targetHpDelta === 0)
    const healAfterShieldedDamage = result.events.find((event) => event.time === shieldedDamage?.time && event.itemId === 'sword' && event.effectType === 'HEAL')

    expect(shieldedDamage).toBeDefined()
    expect(healAfterShieldedDamage).toBeUndefined()
  })
```

- [ ] **Step 4: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game.test.ts -t "blood contract"
```

Expected: FAIL，事件中没有吸血赋予和吸血治疗。

- [ ] **Step 5: 扩展战斗状态**

在 `src/server/game/battle.ts` 的 `BattleSideState` 增加：

```ts
  lifestealItemIds: string[]
```

在 `createSideState()` 返回值增加：

```ts
    lifestealItemIds: [],
```

- [ ] **Step 6: 增加相邻吸血赋能逻辑**

在 `executeItem()` 内，`advanced === 'GRANT_LIFESTEAL_ADJACENT'` 分支放在其他高级效果分支之前：

```ts
    if (!sacrificeReplacesSmallEffect && advanced === 'GRANT_LIFESTEAL_ADJACENT') {
      const adjacent = adjacentItems(actor, item)
      const targets = quality === 'DIAMOND'
        ? adjacent
        : adjacent.filter((entry) => entry.x < item.x)
      const granted = targets.filter((entry) => !actorState.lifestealItemIds.includes(entry.id))
      for (const entry of granted) actorState.lifestealItemIds.push(entry.id)
      if (granted.length > 0) {
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'UTILITY',
          amount: granted.length,
          target: actorSide,
          sourceHp: getHp(actorSide),
          targetHp: getHp(targetSide),
          sourceHpDelta: 0,
          targetHpDelta: 0,
          roll,
          text: `${itemName(def, quality)} 使${quality === 'DIAMOND' ? '左右相邻' : '左侧'}装备获得【吸血】`,
        })
      }
    }
```

- [ ] **Step 7: 在直接伤害后触发吸血**

在 `executeItem()` 的直接伤害分支中，当前已有：

```ts
      const after = getHp(targetSide)
```

紧接伤害事件 `triggers.push(...)` 后面追加：

```ts
      const actualHealthDamage = before - after
      if (actualHealthDamage > 0 && actorState.lifestealItemIds.includes(item.id) && advanced !== 'BOOM_COUNTER') {
        const healed = applyHeal(actorSide, actualHealthDamage)
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'HEAL',
          amount: actualHealthDamage,
          target: actorSide,
          sourceHp: healed.after,
          targetHp: getHp(targetSide),
          sourceHpDelta: healed.delta,
          targetHpDelta: 0,
          roll,
          text: `${itemName(def, quality)} 吸取 ${actualHealthDamage} 点生命`,
        })
      }
```

- [ ] **Step 8: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game.test.ts -t "blood contract"
```

Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add src/server/game/battle.ts src/server/game.test.ts
git commit -m "feat: grant lifesteal from blood contract fang"
```

## Task 3: 爆鸣计数器 30 次爆发

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\battle.ts`
- Test: `E:\AI-GPT\DogFight\src\server\game.test.ts`

- [ ] **Step 1: 写黄金爆发失败测试**

```ts
  it('makes boom counter explode for 300 damage after 30 successful equipment triggers', () => {
    const player = lateGameFighter('P', 'MUTT', [
      ...Array.from({ length: 5 }, (_, index) => equipment(`bite-${index}`, 'starter-1', index, 'BRONZE')),
      equipment('counter', 'v4-boom-counter', 6, 'GOLD'),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [])

    const result = simulateBattle(player, opponent, 'boom-counter-30')
    const boom = result.events.find((event) => event.itemId === 'counter' && event.text.includes('爆鸣计数达到 30'))

    expect(boom).toMatchObject({
      actor: 'player',
      effectType: 'DAMAGE',
      amount: 300,
      target: 'opponent',
      targetHpDelta: -300,
    })
  })
```

- [ ] **Step 2: 写钻石伤害失败测试**

```ts
  it('keeps boom counter threshold at 30 while diamond quality raises damage to 450', () => {
    const player = lateGameFighter('P', 'MUTT', [
      ...Array.from({ length: 5 }, (_, index) => equipment(`bite-${index}`, 'starter-1', index, 'BRONZE')),
      equipment('counter', 'v4-boom-counter', 6, 'DIAMOND'),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [])

    const result = simulateBattle(player, opponent, 'boom-counter-diamond')
    const boom = result.events.find((event) => event.itemId === 'counter' && event.text.includes('爆鸣计数达到 30'))

    expect(boom).toMatchObject({ amount: 450, targetHpDelta: -450 })
  })
```

- [ ] **Step 3: 写爆发不吸血失败测试**

```ts
  it('does not let boom counter explosion trigger lifesteal', () => {
    const player = lateGameFighter('P', 'MUTT', [
      equipment('fang', 'v4-blood-contract-fang', 0, 'DIAMOND'),
      equipment('counter', 'v4-boom-counter', 2, 'GOLD'),
      ...Array.from({ length: 5 }, (_, index) => equipment(`bite-${index}`, 'starter-1', index + 4, 'BRONZE')),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [])

    const result = simulateBattle(player, opponent, 'boom-counter-no-lifesteal')
    const boom = result.events.find((event) => event.itemId === 'counter' && event.text.includes('爆鸣计数达到 30'))
    const boomHeal = result.events.find((event) => event.time === boom?.time && event.itemId === 'counter' && event.effectType === 'HEAL')

    expect(boom).toBeDefined()
    expect(boomHeal).toBeUndefined()
  })
```

- [ ] **Step 4: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game.test.ts -t "boom counter"
```

Expected: FAIL，找不到爆鸣事件。

- [ ] **Step 5: 扩展战斗状态**

在 `BattleSideState` 增加：

```ts
  boomCounter: number
```

在 `createSideState()` 返回值增加：

```ts
    boomCounter: 0,
```

- [ ] **Step 6: 增加成功触发计数函数**

在 `executeItem()` 内部、禁用检查之后、特性倍率计算之前加入局部函数：

```ts
    const recordSuccessfulTrigger = () => {
      actorState.boomCounter += 1
      if (actorState.boomCounter < 30) return
      actorState.boomCounter = 0
      const boomItems = triggerOrder(actor.items).filter((entry) => itemDef(entry.defId).advancedEffect === 'BOOM_COUNTER')
      const boomItem = boomItems[0]
      if (!boomItem) return
      const boomDef = itemDef(boomItem.defId)
      const boomQuality = normalizeQuality(boomItem.quality)
      const boomDamage = qualityAmountFrom(boomDef.effect.amount, boomQuality, boomDef.effect.qualityBase)
      const beforeBoom = getHp(targetSide)
      const boomResult = applyDirectHealthDamage(targetSide, boomDamage)
      triggers.push({
        itemId: boomItem.id,
        defId: boomItem.defId,
        quality: boomQuality,
        effectType: 'DAMAGE',
        amount: beforeBoom - boomResult.after,
        target: targetSide,
        sourceHp: getHp(actorSide),
        targetHp: boomResult.after,
        sourceHpDelta: 0,
        targetHpDelta: boomResult.delta,
        roll,
        text: `爆鸣计数达到 30，造成 ${beforeBoom - boomResult.after} 点伤害`,
      })
    }

    recordSuccessfulTrigger()
```

这段代码必须放在两个禁用返回之后：

```ts
    if (actorState.disabledItemIds.includes(item.id)) { ... return triggers }
    if (actorState.disabledLarge > 0 && isLarge(def, actor)) { ... return triggers }
```

这样被失效抵消的装备不计入成功触发。

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game.test.ts -t "boom counter"
```

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add src/server/game/battle.ts src/server/game.test.ts
git commit -m "feat: add boom counter trigger payoff"
```

## Task 4: 磨牙成长剑无限成长

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\battle.ts`
- Test: `E:\AI-GPT\DogFight\src\server\game.test.ts`

- [ ] **Step 1: 写白银成长失败测试**

```ts
  it('lets growing chew sword start at 1 damage and gain 3 damage every trigger without a growth cap', () => {
    const player = lateGameFighter('P', 'SHIBA', [
      equipment('sword', 'v4-growing-chew-sword', 0, 'SILVER'),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [])

    const result = simulateBattle(player, opponent, 'growing-chew-sword')
    const swordHits = result.events.filter((event) => event.itemId === 'sword' && event.effectType === 'DAMAGE')

    expect(swordHits.slice(0, 5).map((event) => event.amount)).toEqual([1, 4, 7, 10, 13])
    expect(Math.max(...swordHits.map((event) => event.amount ?? 0))).toBeGreaterThan(25)
  })
```

- [ ] **Step 2: 写黄金和钻石成长失败测试**

```ts
  it('scales growing chew sword base damage and growth by quality', () => {
    const gold = simulateBattle(
      lateGameFighter('P', 'SHIBA', [equipment('gold-sword', 'v4-growing-chew-sword', 0, 'GOLD')]),
      lateGameFighter('O', 'SHIBA', []),
      'growing-chew-sword-gold',
    )
    const diamond = simulateBattle(
      lateGameFighter('P', 'SHIBA', [equipment('diamond-sword', 'v4-growing-chew-sword', 0, 'DIAMOND')]),
      lateGameFighter('O', 'SHIBA', []),
      'growing-chew-sword-diamond',
    )

    expect(gold.events.filter((event) => event.itemId === 'gold-sword' && event.effectType === 'DAMAGE').slice(0, 3).map((event) => event.amount)).toEqual([2, 7, 12])
    expect(diamond.events.filter((event) => event.itemId === 'diamond-sword' && event.effectType === 'DAMAGE').slice(0, 3).map((event) => event.amount)).toEqual([3, 10, 17])
  })
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game.test.ts -t "growing chew sword"
```

Expected: FAIL，成长剑伤害固定。

- [ ] **Step 4: 扩展战斗状态**

在 `BattleSideState` 增加：

```ts
  growthDamageByItemId: Record<string, number>
```

在 `createSideState()` 返回值增加：

```ts
    growthDamageByItemId: {},
```

- [ ] **Step 5: 在伤害计算中接入成长伤害**

在 `executeItem()` 的 `amount` 计算后追加：

```ts
    if (advanced === 'GROWTH_DAMAGE') {
      amount = actorState.growthDamageByItemId[item.id] ?? amount
    }
```

在直接伤害事件和吸血处理后追加：

```ts
      if (advanced === 'GROWTH_DAMAGE') {
        const growth = quality === 'DIAMOND' ? 7 : quality === 'GOLD' ? 5 : 3
        actorState.growthDamageByItemId[item.id] = amount + growth
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'UTILITY',
          amount: growth,
          target: actorSide,
          sourceHp: getHp(actorSide),
          targetHp: getHp(targetSide),
          sourceHpDelta: 0,
          targetHpDelta: 0,
          roll,
          text: `${itemName(def, quality)} 后续伤害提高 ${growth}`,
        })
      }
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game.test.ts -t "growing chew sword"
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/server/game/battle.ts src/server/game.test.ts
git commit -m "feat: add unlimited growth damage equipment"
```

## Task 5: 逆毛净化梳清增益并回血

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\battle.ts`
- Test: `E:\AI-GPT\DogFight\src\server\game.test.ts`

- [ ] **Step 1: 写清荆棘并回血失败测试**

```ts
  it('lets reverse fur comb purge enemy thorns first and heal by removed layers', () => {
    const player = lateGameFighter('P', 'SHIBA', [
      equipment('comb', 'v4-reverse-fur-comb', 0, 'SILVER'),
    ])
    const opponent: FighterSnapshot = {
      ...lateGameFighter('O', 'SAMOYED', [
        equipment('thorn-a', 'v3-spiked-vest', 0, 'BRONZE'),
        equipment('thorn-b', 'v3-spiked-vest', 2, 'BRONZE'),
        equipment('thorn-c', 'v3-spiked-vest', 4, 'BRONZE'),
      ]),
      relics: [{ id: 'thorn-relic', relicId: 'v3-fluffed-spike-collar', quality: 'GOLD', slot: 0 }],
    }

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-thorns')
    const purge = result.events.find((event) => event.itemId === 'comb' && event.text.includes('清除'))

    expect(purge).toMatchObject({ amount: 3, target: 'player', effectType: 'HEAL' })
    expect(purge?.text).toContain('清除 3 层增益')
    expect(purge?.playerHp).toBeGreaterThan(0)
    expect(purge?.opponentStatuses?.positive).not.toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 5 }))
  })
```

- [ ] **Step 2: 写护盾折算失败测试**

```ts
  it('lets reverse fur comb convert every 8 enemy shield into one purged layer after thorns', () => {
    const player = lateGameFighter('P', 'SHIBA', [
      equipment('comb', 'v4-reverse-fur-comb', 0, 'SILVER'),
    ])
    const opponent = lateGameFighter('O', 'SHIBA', [
      equipment('shield-a', 'v3-wooden-shield', 0, 'DIAMOND'),
      equipment('shield-b', 'v3-wooden-shield', 2, 'DIAMOND'),
    ])

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-shield')
    const shieldBefore = result.events.find((event) => event.itemId === 'shield-a' || event.itemId === 'shield-b')
    const purge = result.events.find((event) => event.itemId === 'comb' && event.text.includes('清除'))

    expect(shieldBefore?.opponentShield).toBeGreaterThanOrEqual(8)
    expect(purge).toMatchObject({ amount: 3, effectType: 'HEAL' })
    expect((shieldBefore?.opponentShield ?? 0) - (purge?.opponentShield ?? 0)).toBeGreaterThanOrEqual(8)
  })
```

- [ ] **Step 3: 写品质缩放失败测试**

```ts
  it('scales reverse fur comb purge limit and healing by quality', () => {
    const player = lateGameFighter('P', 'SHIBA', [
      equipment('comb', 'v4-reverse-fur-comb', 0, 'DIAMOND'),
    ])
    const opponent: FighterSnapshot = {
      ...lateGameFighter('O', 'SAMOYED', []),
      relics: [{ id: 'thorn-relic', relicId: 'v3-fluffed-spike-collar', quality: 'DIAMOND', slot: 0 }],
    }

    const result = simulateBattle(player, opponent, 'reverse-fur-comb-diamond')
    const purge = result.events.find((event) => event.itemId === 'comb' && event.text.includes('清除'))

    expect(purge).toMatchObject({ amount: 7, effectType: 'HEAL' })
    expect(purge?.sourceHpDelta).toBeGreaterThanOrEqual(0)
    expect(purge?.text).toContain('恢复 77 点生命')
  })
```

- [ ] **Step 4: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game.test.ts -t "reverse fur comb"
```

Expected: FAIL，净化事件不存在。

- [ ] **Step 5: 增加净化辅助函数**

在 `simulateBattle()` 内、`addWeak()` 后追加：

```ts
  const purgePositiveBuffs = (target: Side, maxLayers: number) => {
    let remaining = maxLayers
    let removed = 0

    const removeThorns = Math.min(state[target].thorns, remaining)
    state[target].thorns -= removeThorns
    remaining -= removeThorns
    removed += removeThorns

    const removeSpeed = Math.min(state[target].shibaSpeedStacks, remaining)
    state[target].shibaSpeedStacks -= removeSpeed
    remaining -= removeSpeed
    removed += removeSpeed

    while (remaining > 0 && state[target].shield >= 8) {
      state[target].shield -= 8
      remaining -= 1
      removed += 1
    }

    return removed
  }
```

- [ ] **Step 6: 在装备执行中接入净化**

在 `executeItem()` 中、护盾类效果之前追加：

```ts
    if (!sacrificeReplacesSmallEffect && advanced === 'PURGE_ENEMY_BUFFS') {
      const maxLayers = qualityAmountFrom(def.effect.amount, quality, def.effect.qualityBase)
      const healPerLayer = quality === 'DIAMOND' ? 11 : quality === 'GOLD' ? 8 : 5
      const removed = purgePositiveBuffs(targetSide, maxLayers)
      if (removed > 0 && !recoveryBlocked) {
        const healed = applyHeal(actorSide, removed * healPerLayer)
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'HEAL',
          amount: removed,
          target: actorSide,
          sourceHp: healed.after,
          targetHp: getHp(targetSide),
          sourceHpDelta: healed.delta,
          targetHpDelta: 0,
          roll,
          text: `${itemName(def, quality)} 清除 ${removed} 层增益，恢复 ${removed * healPerLayer} 点生命`,
        })
      } else {
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'UTILITY',
          amount: 0,
          target: targetSide,
          sourceHp: getHp(actorSide),
          targetHp: getHp(targetSide),
          sourceHpDelta: 0,
          targetHpDelta: 0,
          roll,
          text: `${itemName(def, quality)} 没有清除到增益`,
        })
      }
    }
```

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game.test.ts -t "reverse fur comb"
```

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add src/server/game/battle.ts src/server/game.test.ts
git commit -m "feat: add enemy buff purge equipment"
```

## Task 6: 客户端文案与单文件同步

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\App.effect-text.test.ts`
- Modify: `E:\AI-GPT\DogFight\scripts\package-click-index.mjs`
- Modify: `E:\AI-GPT\DogFight\scripts\package-click-index.test.mjs`

- [ ] **Step 1: 写客户端文案失败测试**

在 `src/App.effect-text.test.ts` 中追加或扩展现有描述测试：

```ts
  it('contains labels for new common archetype effects', () => {
    expect(app).toContain('吸血')
    expect(app).toContain('爆鸣计数')
    expect(app).toContain('后续伤害')
    expect(app).toContain('清除')
  })
```

- [ ] **Step 2: 写单文件包含新装备失败测试**

在 `scripts/package-click-index.test.mjs` 的 `default standalone mock includes current class rewards...` 测试中追加：

```js
      expect(html).toContain('v4-blood-contract-fang')
      expect(html).toContain('v4-boom-counter')
      expect(html).toContain('v4-growing-chew-sword')
      expect(html).toContain('v4-reverse-fur-comb')
      expect(html).toContain('GRANT_LIFESTEAL_ADJACENT')
      expect(html).toContain('BOOM_COUNTER')
      expect(html).toContain('GROWTH_DAMAGE')
      expect(html).toContain('PURGE_ENEMY_BUFFS')
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
npm test -- src/App.effect-text.test.ts scripts/package-click-index.test.mjs -t "new common archetype|current class rewards"
```

Expected: FAIL，单文件 mock 中缺少新装备或新效果。

- [ ] **Step 4: 同步 `scripts/package-click-index.mjs` 数据定义**

在脚本内找到 `ITEM_DEFS` 的 V3 通用装备列表，追加与 `src/server/game/data.ts` 完全一致的 4 个对象。名称、id、价格、触发点、标签、`advancedEffect`、`defaultQuality`、`qualityBase` 必须一致。

追加的定义内容：

```js
  slotItem('v4-blood-contract-fang', '血契犬牙', 2, 12, [1, 6], ['lifesteal', 'support', 'extreme'], { type: 'UTILITY', amount: 0 }, {
    description: '触发时，使左边 1 个相邻装备获得【吸血】直到战斗结束。钻石品质改为使左右相邻装备都获得【吸血】。',
    advancedEffect: 'GRANT_LIFESTEAL_ADJACENT',
    defaultQuality: 'GOLD',
  }),
  slotItem('v4-boom-counter', '爆鸣计数器', 2, 14, [1, 2, 3, 4, 5, 6], ['counter', 'trigger', 'damage'], { type: 'UTILITY', amount: 300, qualityBase: 'GOLD' }, {
    description: '己方装备每成功触发 1 次，获得 1 点爆鸣计数。达到 30 点后清零，对敌方造成 300 点直接伤害。升级只提高伤害。',
    advancedEffect: 'BOOM_COUNTER',
    defaultQuality: 'GOLD',
  }),
  slotItem('v4-growing-chew-sword', '磨牙成长剑', 2, 9, [2, 3, 4], ['growth', 'damage', 'stable'], { type: 'DAMAGE', amount: 1, qualityBase: 'SILVER' }, {
    description: '初始造成 1 点伤害。每次该装备成功触发后，本局内后续伤害 +3，无成长次数上限。',
    advancedEffect: 'GROWTH_DAMAGE',
    defaultQuality: 'SILVER',
  }),
  slotItem('v4-reverse-fur-comb', '逆毛净化梳', 1, 8, [3, 4], ['cleanse', 'heal', 'counter'], { type: 'UTILITY', amount: 3, qualityBase: 'SILVER' }, {
    description: '清除敌方最多 3 层正面增益；每实际清除 1 层，自己恢复 5 点生命。优先清除荆棘，再清除加速层数，最后每 8 点护盾折算 1 层。',
    advancedEffect: 'PURGE_ENEMY_BUFFS',
    defaultQuality: 'SILVER',
  }),
```

- [ ] **Step 5: 同步单文件战斗逻辑**

在 `scripts/package-click-index.mjs` 的 mock battle state 中同步增加：

```js
lifestealItemIds: [],
boomCounter: 0,
growthDamageByItemId: {},
```

把 Task 2 至 Task 5 中新增的吸血赋能、爆鸣计数、成长剑和净化梳逻辑同步到脚本中对应的 `executeItem` 或等价函数。脚本中的变量命名可能是普通 JavaScript，但事件文本、数值、触发顺序必须与服务端一致。

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
npm test -- src/App.effect-text.test.ts scripts/package-click-index.test.mjs -t "new common archetype|current class rewards"
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/App.effect-text.test.ts scripts/package-click-index.mjs scripts/package-click-index.test.mjs
git commit -m "feat: sync archetype equipment to standalone mock"
```

## Task 7: 数值 Excel 同步

**Files:**
- Modify: `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`

- [ ] **Step 1: 打开并读取工作簿**

使用 Spreadsheets 插件或本地表格库打开：

```text
C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx
```

检查工作表名称，确认存在或创建这些页：

```text
通用装备
数值模型-装备期望
数值模型-平衡看板
```

- [ ] **Step 2: 更新 `通用装备` 页**

追加 4 行：

```text
血契犬牙 | 2 | 12 | 黄金 | 1/6 | lifesteal,support,extreme | 触发时赋予左侧相邻装备吸血；钻石赋予左右相邻装备吸血
爆鸣计数器 | 2 | 14 | 黄金 | 1/2/3/4/5/6 | counter,trigger,damage | 己方装备成功触发 30 次后造成 300；钻石造成 450
磨牙成长剑 | 2 | 9 | 白银 | 2/3/4 | growth,damage,stable | 初始 1，每次触发后本局后续伤害 +3，无成长次数上限
逆毛净化梳 | 1 | 8 | 白银 | 3/4 | cleanse,heal,counter | 清除 3/5/7 层正面增益，每层回复 5/8/11
```

- [ ] **Step 3: 更新 `数值模型-装备期望` 页**

录入这些模型参数：

```text
血契犬牙：触发概率 2/6；自身无伤害；收益来自被赋能装备实际生命伤害的 100% 治疗
爆鸣计数器：单次触发计数 +1；30 次触发结算 300/450；平均每次成功触发贡献 10/15 终局伤害
磨牙成长剑：触发概率 3/6；白银第 N 次命中伤害 = 1 + 3*(N-1)
逆毛净化梳：触发概率 2/6；白银最大回血 15；黄金最大回血 40；钻石最大回血 77；护盾每 8 点折算 1 层
```

- [ ] **Step 4: 更新 `数值模型-平衡看板` 页**

在看板摘要加入：

```text
新增吸血摆位流：血契犬牙本身无输出，依赖相邻直接伤害装备，主要风险是成长剑后期吸血过高。
新增触发次数流：爆鸣计数器 30 次触发后 300/450 伤害，主要风险是土狗额外投掷与追车车触发密度过高。
新增无限成长流：磨牙成长剑前期 1 点伤害，后期随触发次数线性增长，主要风险是 120 秒长战斗中叠得过高。
新增反增益克制：逆毛净化梳优先清荆棘，再清加速层数和护盾，主要风险是钻石品质最大 77 回血。
```

- [ ] **Step 5: 保存工作簿并记录更新时间**

在工作簿中的维护记录或看板备注单元格写入：

```text
2026-05-20：同步通用装备流派补强，新增血契犬牙、爆鸣计数器、磨牙成长剑、逆毛净化梳。
```

- [ ] **Step 6: 提交源码侧变更**

Excel 不一定在 git 仓库内。若该文件不在仓库内，不提交 Excel；最终回复必须明确它已更新，给出绝对路径。

## Task 8: 全量验证与构建

**Files:**
- Generated: `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd`

- [ ] **Step 1: 运行服务端与脚本测试**

Run:

```bash
npm test
```

Expected: PASS，所有 Vitest 测试通过。

- [ ] **Step 2: 运行构建**

Run:

```bash
npm run build
```

Expected: PASS，并刷新：

```text
E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd
```

- [ ] **Step 3: 检查构建产物包含新装备**

Run:

```bash
rg -n "v4-blood-contract-fang|v4-boom-counter|v4-growing-chew-sword|v4-reverse-fur-comb" dist-click\DogFight-standalone.cmd
```

Expected: 输出 4 个装备 id 的匹配行。

- [ ] **Step 4: 检查 git 状态**

Run:

```bash
git status --short
```

Expected: 只包含本次实现相关源码、测试、打包产物变更；不包含临时文件。

- [ ] **Step 5: 最终提交**

```bash
git add src/server/game/types.ts src/server/game/data.ts src/server/game/battle.ts src/server/game.test.ts src/App.effect-text.test.ts scripts/package-click-index.mjs scripts/package-click-index.test.mjs dist-click/DogFight-standalone.cmd
git commit -m "feat: add general equipment archetypes"
```

## 自审记录

- Spec 覆盖：4 件装备定义、品质数值、吸血排除项、30 次触发爆发、无限成长、净化优先级、Excel 同步和构建要求均有任务覆盖。
- 文档完整性扫描：计划中的步骤、命令、测试代码和实现代码片段均已写明。
- 类型一致性：计划统一使用 `GRANT_LIFESTEAL_ADJACENT`、`BOOM_COUNTER`、`GROWTH_DAMAGE`、`PURGE_ENEMY_BUFFS`；装备 id 统一使用 `v4-blood-contract-fang`、`v4-boom-counter`、`v4-growing-chew-sword`、`v4-reverse-fur-comb`。
