import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  DAILY_CURRENCY_LIMIT,
  SHOP_CATALOG,
  claimAchievementReward,
  claimDailyTaskReward,
  createInitialDailyTasks,
  equipCosmetic,
  grantMatchCurrency,
  progressAchievements,
  progressDailyTasks,
  purchaseCatalogItem,
  refreshDailyTasks,
} from './account-systems'

describe('account shop and achievements domain', () => {
  it('defines the first release achievement shape', () => {
    expect(ACHIEVEMENTS).toHaveLength(40)
    expect(ACHIEVEMENTS.filter((entry) => entry.category === '职业特色')).toHaveLength(20)
    expect(ACHIEVEMENTS.filter((entry) => entry.hidden)).toHaveLength(5)
  })

  it('increments achievements, completes once, and rejects duplicate claims', () => {
    const progressed = progressAchievements([], { kind: 'RUN_CREATED', dogType: 'SHIBA' }, '2026-05-30T00:00:00.000Z')
    const firstRun = progressed.find((entry) => entry.achievementId === 'first-run')
    expect(firstRun).toMatchObject({ progress: 1, completedAt: '2026-05-30T00:00:00.000Z', claimedAt: null })

    const claimed = claimAchievementReward({ balance: 0, dailyEarned: 0 }, progressed, 'first-run', '2026-05-30T00:01:00.000Z')
    expect(claimed.wallet.balance).toBe(80)
    expect(() => claimAchievementReward(claimed.wallet, claimed.progress, 'first-run')).toThrow('Achievement already claimed')
  })

  it('draws three daily slots, refreshes only unclaimed tasks, and claims rewards', () => {
    const state = createInitialDailyTasks('user-a', '2026-05-30')
    expect(state.tasks.map((task) => task.slot).sort()).toEqual(['BATTLE', 'BUILD', 'PARTICIPATION'])

    const progressed = progressDailyTasks(state, { kind: 'RUN_CREATED', dogType: 'MUTT' })
    const refreshed = refreshDailyTasks(progressed, 'user-a')
    expect(refreshed.refreshUsed).toBe(true)
    expect(() => refreshDailyTasks(refreshed, 'user-a')).toThrow('Daily refresh already used')

    const completed = {
      ...state,
      tasks: state.tasks.map((task) => task.slot === 'BUILD' ? { ...task, progress: task.target } : task),
    }
    const claimed = claimDailyTaskReward({ balance: 10, dailyEarned: 0 }, completed, completed.tasks.find((task) => task.slot === 'BUILD')!.taskId)
    expect(claimed.wallet.balance).toBeGreaterThan(10)
    expect(() => refreshDailyTasks(claimed.state, 'user-a')).not.toThrow()
  })

  it('caps match currency by daily limit', () => {
    const first = grantMatchCurrency({ balance: 0, dailyEarned: DAILY_CURRENCY_LIMIT - 5 }, { mode: 'LADDER', winner: true })
    expect(first.amount).toBe(5)
    const capped = grantMatchCurrency(first.wallet, { mode: 'CASUAL', winner: true })
    expect(capped.amount).toBe(0)
  })

  it('blocks duplicate purchases and unowned equips', () => {
    const item = SHOP_CATALOG.find((entry) => entry.type === 'TITLE')!
    const purchased = purchaseCatalogItem({ balance: item.price, dailyEarned: 0 }, [], item.id, '2026-05-30T00:00:00.000Z')
    expect(purchased.wallet.balance).toBe(0)
    expect(() => purchaseCatalogItem({ balance: 999, dailyEarned: 0 }, purchased.inventory, item.id)).toThrow('Catalog item already owned')

    expect(equipCosmetic(purchased.inventory, [], item.id)).toEqual([{ slot: item.type, catalogItemId: item.id }])
    expect(() => equipCosmetic([], [], item.id)).toThrow('Catalog item not owned')
  })
})
