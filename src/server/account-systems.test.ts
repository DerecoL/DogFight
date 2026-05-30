import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  SHOP_CATALOG,
  claimAchievementReward,
  createInitialDailyTasks,
  equipCosmetic,
  grantMatchCurrency,
  progressAchievements,
  purchaseCatalogItem,
  refreshDailyTasks,
} from './account-systems'

describe('account achievement and shop systems', () => {
  it('ships a broad first achievement pack with hidden achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(40)
    expect(ACHIEVEMENTS.filter((entry) => entry.hidden)).toHaveLength(4)
    expect(ACHIEVEMENTS.filter((entry) => entry.category === '职业特色')).toHaveLength(20)
  })

  it('updates achievement progress from account events and allows one reward claim', () => {
    const progressed = progressAchievements([], { kind: 'RUN_CREATED', dogType: 'SHIBA' })
    const firstRun = progressed.find((entry) => entry.achievementId === 'first-run')
    expect(firstRun).toMatchObject({ progress: 1, completedAt: expect.any(String), claimedAt: null })

    const wallet = { balance: 0, dailyEarned: 0 }
    const claimed = claimAchievementReward(wallet, progressed, 'first-run')
    expect(claimed.wallet.balance).toBeGreaterThan(0)
    expect(claimed.progress.find((entry) => entry.achievementId === 'first-run')?.claimedAt).toEqual(expect.any(String))
    expect(() => claimAchievementReward(claimed.wallet, claimed.progress, 'first-run')).toThrow(/already claimed/i)
  })

  it('creates three typed daily tasks and refreshes only unfinished tasks once', () => {
    const first = createInitialDailyTasks('user-1', '2026-05-30')
    expect(first.tasks).toHaveLength(3)
    expect(first.tasks.map((task) => task.slot)).toEqual(['PARTICIPATION', 'BUILD', 'BATTLE'])

    const completedTaskId = first.tasks[0].taskId
    const beforeRefresh = {
      ...first,
      tasks: first.tasks.map((task) => task.taskId === completedTaskId ? { ...task, progress: task.target, claimedAt: '2026-05-30T00:00:00.000Z' } : task),
    }
    const refreshed = refreshDailyTasks(beforeRefresh, 'user-1')
    expect(refreshed.refreshUsed).toBe(true)
    expect(refreshed.tasks.find((task) => task.taskId === completedTaskId)?.taskId).toBe(completedTaskId)
    expect(() => refreshDailyTasks(refreshed, 'user-1')).toThrow(/already used/i)
  })

  it('caps repeat match currency by daily earning limit', () => {
    const wallet = { balance: 0, dailyEarned: 0 }
    const first = grantMatchCurrency(wallet, { mode: 'CASUAL', winner: true })
    expect(first.wallet.balance).toBeGreaterThan(0)

    let current = first.wallet
    for (let index = 0; index < 100; index += 1) {
      current = grantMatchCurrency(current, { mode: 'LADDER', winner: true }).wallet
    }
    expect(current.dailyEarned).toBe(240)
    expect(current.balance).toBe(240)
  })

  it('prevents duplicate purchases and equipping unowned cosmetics', () => {
    const wallet = { balance: 500, dailyEarned: 0 }
    const title = SHOP_CATALOG.find((item) => item.type === 'TITLE')
    expect(title).toBeTruthy()

    const purchased = purchaseCatalogItem(wallet, [], title!.id)
    expect(purchased.wallet.balance).toBe(500 - title!.price)
    expect(purchased.inventory).toContainEqual({ catalogItemId: title!.id, acquiredAt: expect.any(String) })
    expect(() => purchaseCatalogItem(purchased.wallet, purchased.inventory, title!.id)).toThrow(/already owned/i)

    expect(equipCosmetic(purchased.inventory, [], title!.id)).toContainEqual({ slot: 'TITLE', catalogItemId: title!.id })
    const skin = SHOP_CATALOG.find((item) => item.type === 'DOG_SKIN' && item.id !== title!.id)
    expect(() => equipCosmetic(purchased.inventory, [], skin!.id)).toThrow(/not owned/i)
  })
})
