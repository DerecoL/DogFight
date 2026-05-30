type OptimisticShopOffer = {
  offerId: string
  price: number
}

type OptimisticShopRun = {
  gold: number
  refreshCost: number
  shopItems: OptimisticShopOffer[]
}

type DogfightRunPreview = {
  id: string
  gold: number
  phase: string
  status: string
  wins: number
  losses: number
  round: number
}

type DogfightMemberPreview = {
  runId: string | null
  gold: number
  phase: string
  status: string
  wins: number
  losses: number
  round: number
}

type DogfightRoomPreview<Run extends DogfightRunPreview, Member extends DogfightMemberPreview> = {
  currentRun: Run | null
  currentRunMember: Member | null
  members: Member[]
}

export function previewShopPurchase<T extends OptimisticShopRun>(run: T, offerId: string): T | null {
  const offer = run.shopItems.find((entry) => entry.offerId === offerId)
  if (!offer || run.gold < offer.price) return null

  return {
    ...run,
    gold: run.gold - offer.price,
    shopItems: run.shopItems.filter((entry) => entry.offerId !== offerId),
  }
}

export function previewShopReroll<T extends OptimisticShopRun>(run: T): T | null {
  if (run.gold < run.refreshCost) return null

  return {
    ...run,
    gold: run.gold - run.refreshCost,
    refreshCost: run.refreshCost + 1,
  }
}

export function mergeDogfightRunPreview<
  Run extends DogfightRunPreview,
  Member extends DogfightMemberPreview,
  Room extends DogfightRoomPreview<Run, Member>,
>(room: Room, nextRun: Run): Room {
  const mergeMember = (member: Member): Member => {
    if (member.runId !== nextRun.id) return member
    return {
      ...member,
      gold: nextRun.gold,
      phase: nextRun.phase,
      status: nextRun.status,
      wins: nextRun.wins,
      losses: nextRun.losses,
      round: nextRun.round,
    }
  }

  return {
    ...room,
    currentRun: nextRun,
    currentRunMember: room.currentRunMember ? mergeMember(room.currentRunMember) : null,
    members: room.members.map(mergeMember),
  }
}
