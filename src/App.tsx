import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  ArrowRight,
  Backpack,
  BadgeDollarSign,
  Coins,
  Crown,
  Dice5,
  Gamepad2,
  Grid3X3,
  HeartPulse,
  House,
  Lock,
  LogOut,
  Medal,
  Music,
  PackagePlus,
  RadioTower,
  RefreshCcw,
  Shield,
  ShoppingBag,
  Swords,
  Trophy,
  VolumeX,
} from 'lucide-react'
import './App.css'

type DogType = 'SHIBA' | 'SAMOYED' | 'MUTT' | 'BULLY' | 'EMPEROR'
type Phase = 'SHOP' | 'CHOICE' | 'CLASS_REWARD' | 'RELIC_CHOICE' | 'PREP' | 'MATCH' | 'BATTLE' | 'COMPLETE'
type Area = 'EQUIPMENT' | 'BAG'
type ShopType = 'GENERAL' | 'LARGE' | 'MEDIUM' | 'SMALL' | 'SMALL_DICE' | 'BIG_DICE' | 'RELIC'
type ItemQuality = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
type GameMode = 'CASUAL' | 'LADDER' | 'DOGFIGHT' | 'PEAK'
type AppScreen = 'LOBBY' | 'CASUAL' | 'DOGFIGHT' | 'PEAK'

type ItemDef = {
  id: string
  name: string
  size: 1 | 2 | 3 | 4
  width: number
  height: number
  price: number
  dice: number[]
  tags: string[]
  description?: string
  defaultQuality?: ItemQuality
  effect: { type: string; amount: number }
}
type Item = { id: string; defId: string; quality: ItemQuality; area: Area; x: number; y: number; def: ItemDef }
type ShopOffer = { offerId: string; defId: string; price: number; discount: number; quality?: ItemQuality; def?: ItemDef }
type ClassRewardChoice = { defId: string; quality: ItemQuality; def: ItemDef }
type RelicDef = { id: string; name: string; defaultQuality: ItemQuality; tags: string[]; description: string; effect: string }
type Relic = { id: string; relicId: string; quality: ItemQuality; slot: number; def: RelicDef }
type RelicChoice = { relicId: string; quality: ItemQuality; def: RelicDef }
type BattleActor = 'player' | 'opponent' | 'system'
type BattleTarget = 'player' | 'opponent' | 'both' | 'none'
type BattleSnapshot = { name: string; dogType: DogType; luckyNumber?: number | null; wins: number; losses: number; round: number; items: Item[]; relics?: Relic[] }
type BattleStatusEntry = {
  type: 'shield' | 'thorns' | 'extraRoll' | 'poison' | 'weak' | 'freeze' | 'disabled' | string
  label: string
  tone: 'positive' | 'negative'
  amount?: number
  stacks?: number
  remaining?: number
  nextTickIn?: number
  tickDamage?: number
}
type BattleStatusRows = { positive: BattleStatusEntry[]; negative: BattleStatusEntry[] }
type BattleEvent = {
  time: number
  actor: BattleActor
  kind: 'ROLL' | 'ITEM' | 'POISON' | 'END' | string
  text: string
  playerHp: number
  opponentHp: number
  playerMaxHp: number
  opponentMaxHp: number
  playerShield?: number
  opponentShield?: number
  playerStatuses?: BattleStatusRows
  opponentStatuses?: BattleStatusRows
  statusChanged?: string[]
  roll?: number
  itemId?: string
  defId?: string
  effectType?: string
  amount?: number
  target?: BattleTarget
  sourceHpDelta?: number
  targetHpDelta?: number
}
type Battle = {
  winner: string
  duration: number
  playerHp: number
  opponentHp: number
  playerMaxHp: number
  opponentMaxHp: number
  events: BattleEvent[]
  playerSnapshot?: BattleSnapshot
  opponentSnapshot?: BattleSnapshot
}
type Run = {
  id: string
  dogType: DogType
  luckyNumber?: number | null
  wins: number
  losses: number
  round: number
  gold: number
  phase: Phase
  status: string
  shopType: ShopType
  shopItems: ShopOffer[]
  choices: ShopType[]
  classRewardChoices: ClassRewardChoice[]
  relicChoices: RelicChoice[]
  relics: Relic[]
  refreshCost: number
  matchedGhost: null | { name: string; dogType: DogType; luckyNumber?: number | null; wins: number; losses: number; round: number }
  lastBattle: Battle | null
  items: Item[]
}
type AuthUser = { id: string; email: string; nickname: string | null }
type TipAnchor = { x: number; y: number }
type ApexEntry = {
  id: string
  sourceRunId: string | null
  name: string
  dogType: DogType
  luckyNumber?: number | null
  wins: number
  losses: number
  round: number
  rank: number
  challengeWins: number
  isSeed: boolean
  createdAt: string
  items: Item[]
  relics: Relic[]
}
type ApexBattleSummary = {
  opponentId: string
  opponentRank: number
  opponentName: string
  winner: 'player' | 'opponent'
  duration: number
  playerHp: number
  opponentHp: number
}
type ApexChallengeReport = {
  placementRank: number
  challengeWins: number
  battles: ApexBattleSummary[]
}
type ApexOverview = { leaderboard: ApexEntry[]; candidates: Run[] }
type ApexSubmitResponse = { entry: ApexEntry; report: ApexChallengeReport; leaderboard: ApexEntry[] }
type DogfightRoomStatus = 'WAITING' | 'ACTIVE' | 'COMPLETE'
type DogfightMember = {
  id: string
  userId: string
  runId: string
  nickname: string
  isHost: boolean
  ready: boolean
  eliminated: boolean
  eliminatedRound?: number | null
  placement?: number | null
  dogType: DogType
  wins: number
  losses: number
  round: number
  gold: number
  phase: Phase
  status: string
}
type DogfightBattleSummary = {
  id: string
  round: number
  participantAId: string
  participantBId?: string | null
  opponentKind: 'PLAYER' | 'OFFLINE'
  winnerSide: string
  winnerParticipantId?: string | null
  createdAt: string
}
type DogfightRoom = {
  id: string
  hostUserId: string
  status: DogfightRoomStatus
  currentRound: number
  maxPlayers: number
  readyDeadline: string | null
  winnerParticipantId?: string | null
  isHost: boolean
  spectator: boolean
  members: DogfightMember[]
  currentRun: Run | null
  battles: DogfightBattleSummary[]
}
type DogfightRoomSummary = {
  id: string
  status: DogfightRoomStatus
  currentRound: number
  maxPlayers: number
  memberCount: number
  aliveCount: number
  readyDeadline: string | null
  winnerParticipantId?: string | null
  isMember: boolean
  isHost: boolean
  spectator: boolean
  hostName: string
}
type DogfightRoomsResponse = { rooms: DogfightRoomSummary[] }
type DogfightRoomResponse = { room: DogfightRoom }
type DogfightBattleResponse = { battle: { id: string; roomId: string; round: number; opponentKind: string; result: Battle } }

const dogNames: Record<DogType, string> = { SHIBA: '柴犬', SAMOYED: '萨摩耶', MUTT: '土狗', BULLY: '恶霸', EMPEROR: '狗皇帝' }
const dogTraits: Record<DogType, string> = {
  SHIBA: '20% 概率改掷为小点 1/2/3',
  SAMOYED: '20% 概率改掷为大点 4/5/6',
  MUTT: '20% 概率额外投掷一次',
  BULLY: '40% 概率使本次触发的大型物品效果翻倍',
  EMPEROR: '指定幸运数字，命中时 50% 概率使触发效果翻倍',
}
const dogAssets: Record<DogType, string> = {
  SHIBA: '/assets/dogs/shiba.webp',
  SAMOYED: '/assets/dogs/samoyed.webp',
  MUTT: '/assets/dogs/mutt.webp',
  BULLY: '/assets/dogs/bully.webp',
  EMPEROR: '/assets/dogs/emperor.webp',
}
const gameIcon = '/assets/game-icon.png'
const backgroundMusicSrc = '/assets/audio/the-final-inventory.mp3'
const musicPreferenceKey = 'dogfight:background-music'
const shopNames: Record<ShopType, string> = {
  GENERAL: '通用商店',
  LARGE: '大物品商店',
  MEDIUM: '中物品商店',
  SMALL: '小物品商店',
  SMALL_DICE: '小点商店',
  BIG_DICE: '大点商店',
  RELIC: '遗物商店',
}
const itemIcons: Record<string, string> = {
  'starter-1': '/assets/items/bite.svg',
  'starter-2': '/assets/items/bite.svg',
  'starter-3': '/assets/items/bite.svg',
  'starter-4': '/assets/items/bite.svg',
  'starter-5': '/assets/items/bite.svg',
  'starter-6': '/assets/items/bite.svg',
  'small-bite': '/assets/items/small-bite.svg',
  'lucky-paw': '/assets/items/lucky-paw.svg',
  'milk-bone': '/assets/items/milk-bone.svg',
  'rubber-ball': '/assets/items/rubber-ball.svg',
  'spiked-collar': '/assets/items/spiked-collar.svg',
  'training-disc': '/assets/items/training-disc.svg',
  'guard-vest': '/assets/items/guard-vest.svg',
  'giant-bone': '/assets/items/giant-bone.svg',
  'dog-house': '/assets/items/dog-house.svg',
}
const qualityOrder: ItemQuality[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']
const qualityLabel: Record<ItemQuality, string> = {
  BRONZE: '青铜',
  SILVER: '白银',
  GOLD: '黄金',
  DIAMOND: '钻石',
}
const DOG_SELECTION_SLOT_COUNT = 8
const SHOP_CHOICE_SLOT_COUNT = 7
const BASE_MAX_HP = 100
const EARLY_ROUND_HP_GROWTH = 20
const LATE_ROUND_HP_GROWTH = 50
const EARLY_HP_GROWTH_ROUNDS = 6
const dogOptions: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']
const shopChoiceOrder: ShopType[] = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE', 'RELIC']
const dogStrategies: Record<DogType, string> = {
  SHIBA: '适合新手，专注于持续输出伤害',
  SAMOYED: '适合押大点构筑，爆发窗口更集中',
  MUTT: '适合随机和连击构筑，上限更高但波动更大',
  BULLY: '适合大型物品构筑，围绕 4 格道具打爆发',
  EMPEROR: '适合围绕一个核心点数堆叠道具，命中幸运数字时有爆发上限',
}
const dogTags: Record<DogType, string[]> = {
  SHIBA: ['进攻', '简单'],
  SAMOYED: ['爆发', '中等'],
  MUTT: ['随机', '困难'],
  BULLY: ['大型', '爆发'],
  EMPEROR: ['幸运', '爆发'],
}
const shopDescriptions: Record<ShopType, string> = {
  GENERAL: '提供各类基础道具，适合补齐构筑短板',
  LARGE: '提供高占格高收益道具，适合大件路线',
  MEDIUM: '提供稳定中型道具，适合均衡过渡',
  SMALL: '提供低占格道具，适合填补装备缝隙',
  SMALL_DICE: '偏向小点触发道具，适合小点战术',
  BIG_DICE: '偏向大点触发道具，适合高点爆发',
  RELIC: '免费选择一个遗物，强化骰子倾向和触发频率',
}
const ruleTerms: Record<string, { description: string; note: string }> = {
  相邻: { description: '该物品左边和右边的第1个物品', note: '无' },
  小点: { description: '投掷出1~3点', note: '无' },
  大点: { description: '投掷出4~6点', note: '无' },
  极值: { description: '投掷出1和6点', note: '无' },
  荆棘: { description: '每次受到攻击对敌方玩家造成3点伤害（可叠加）', note: '无' },
  中毒: { description: '造成2秒持续伤害，每秒结算1次（可叠加，叠加刷新持续时间）', note: '无' },
  虚弱: { description: '玩家的下次攻击造成的伤害减少50%（可叠加层数，不叠加效果）', note: '无' },
  大型物品: { description: '容量为4的物品', note: '恶霸袖标可让3格物品也按大型物品处理' },
  中型物品: { description: '容量为2或3的物品', note: '无' },
  小型物品: { description: '容量为1的物品', note: '无' },
  失效: { description: '下次生效将不会有任何行为，生效后去除一层该效果', note: '无' },
  天命数字: { description: '开局时确定的幸运数字', note: '狗皇帝专属规则' },
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers
  const res = await fetch(`/api${url}`, { credentials: 'include', headers, ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || '请求失败')
  return data
}

function itemTone(def: ItemDef) {
  if (def.tags.includes('starter')) return 'starter'
  if (def.tags.includes('heal')) return 'heal'
  if (def.tags.includes('large')) return 'large'
  if (def.tags.includes('big')) return 'big'
  return 'utility'
}

function itemIcon(def: ItemDef) {
  return itemIcons[def.id] ?? '/assets/items/bite.svg'
}

function normalizeQuality(quality?: string): ItemQuality {
  return qualityOrder.includes(quality as ItemQuality) ? quality as ItemQuality : 'BRONZE'
}

function qualityClass(quality?: string) {
  return `quality-${normalizeQuality(quality).toLowerCase()}`
}

function qualityAmount(amount: number, quality?: string) {
  return Math.round(amount * (1.5 ** qualityOrder.indexOf(normalizeQuality(quality))))
}

function effectText(def: ItemDef, quality: ItemQuality = 'BRONZE') {
  const amount = qualityAmount(def.effect.amount, quality)
  if (def.effect.type === 'HEAL') return `回复 ${amount} 生命`
  if (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD') return `造成 ${amount} 伤害`
  if (def.effect.type === 'UTILITY') {
    if (def.tags.includes('shield')) return `获得 ${amount} 护盾`
    if (def.tags.includes('poison')) return `施加 ${amount} 中毒`
    if (def.tags.includes('weak')) return `施加 ${amount} 虚弱`
    if (def.tags.includes('cleanse')) return `回复 ${amount} 生命`
    if (amount > 0) return `效果 ${amount}`
  }
  return '特殊效果'
}

function sellValueForItem(def: ItemDef) {
  return def.tags.includes('starter') ? 1 : Math.floor(def.price / 2)
}

function maxHealthForRound(round: number) {
  const completedRounds = Math.max(0, Math.floor(round))
  const earlyRounds = Math.min(completedRounds, EARLY_HP_GROWTH_ROUNDS)
  const lateRounds = Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS)
  return BASE_MAX_HP + earlyRounds * EARLY_ROUND_HP_GROWTH + lateRounds * LATE_ROUND_HP_GROWTH
}

function diceToneText(def: ItemDef) {
  const min = Math.min(...def.dice)
  const max = Math.max(...def.dice)
  if (max <= 3) return '小点'
  if (min >= 4) return '大点'
  return '混合'
}

function effectToneText(def: ItemDef) {
  if (def.effect.type === 'HEAL') return '回复'
  if (def.effect.type === 'UTILITY') {
    if (def.tags.includes('shield')) return '护盾'
    if (def.tags.includes('poison')) return '中毒'
    if (def.tags.includes('weak')) return '虚弱'
    if (def.tags.includes('cleanse')) return '净化'
    return '特殊'
  }
  return '攻击'
}

function canUpgradeItem(item: Item, items: Item[]) {
  const quality = normalizeQuality(item.quality)
  return quality !== 'DIAMOND' && items.some((entry) => entry.id !== item.id && entry.defId === item.defId && normalizeQuality(entry.quality) === quality)
}

function parseSlotId(id: string) {
  const [area, x, y] = id.split(':')
  if ((area !== 'EQUIPMENT' && area !== 'BAG') || x == null || y == null) return null
  return { area: area as Area, x: Number(x), y: Number(y) }
}

function getFloatingTipPosition(element: HTMLElement): TipAnchor {
  const rect = element.getBoundingClientRect()
  const gap = 12
  const edge = 14
  const tipWidth = Math.min(380, window.innerWidth - edge * 2)
  const tipHeight = Math.min(440, window.innerHeight - edge * 2)
  const rightX = rect.right + gap
  const leftX = rect.left - tipWidth - gap
  const x = rightX + tipWidth <= window.innerWidth - edge ? rightX : Math.max(edge, leftX)
  const centeredY = rect.top + rect.height / 2 - tipHeight / 2
  const y = Math.min(Math.max(edge, centeredY), Math.max(edge, window.innerHeight - tipHeight - edge))
  return { x, y }
}

function useOutsideTipDismiss(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.floating-tip')) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [active, onClose])
}

function RuleText({ text }: { text: string }) {
  const [openTerm, setOpenTerm] = useState<string | null>(null)
  const parts = text.split(/(【[^】]+】)/g).filter(Boolean)
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^【(.+)】$/)
        if (!match) return <span key={`${part}-${index}`}>{part}</span>
        const term = match[1]
        const entry = ruleTerms[term]
        if (!entry) return <strong key={`${term}-${index}`}>【{term}】</strong>
        return (
          <span className="rule-term-wrap" key={`${term}-${index}`}>
            <button type="button" className="rule-term" onClick={(event) => { event.stopPropagation(); setOpenTerm(openTerm === term ? null : term) }}>【{term}】</button>
            {openTerm === term && (
              <span className="rule-tip" role="tooltip">
                <b>{term}</b>
                <span>{entry.description}</span>
                {entry.note !== '无' && <small>{entry.note}</small>}
              </span>
            )}
          </span>
        )
      })}
    </>
  )
}

export default function App() {
  const [email, setEmail] = useState('player@dogdice.test')
  const [password, setPassword] = useState('dogdice')
  const [appScreen, setAppScreen] = useState<AppScreen>('LOBBY')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [needsNicknameSetup, setNeedsNicknameSetup] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [battle, setBattle] = useState<Battle | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [ceremonyDismissedRounds, setCeremonyDismissedRounds] = useState(() => new Set<string>())
  const [musicEnabled, setMusicEnabled] = useState(() => localStorage.getItem(musicPreferenceKey) !== 'off')
  const [musicBlocked, setMusicBlocked] = useState(false)
  const [appHasAudioFocus, setAppHasAudioFocus] = useState(() => !document.hidden && document.hasFocus())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const hasBattle = Boolean(battle)

  useEffect(() => {
    api<{ user: AuthUser; activeRun: Run | null }>('/me')
      .then((data) => {
        setUser(data.user)
        setRun(data.activeRun)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!battle) return
    const timer = window.setInterval(() => {
      setEventIndex((value) => Math.min(value + 1, battle.events.length - 1))
    }, 420 / speed)
    return () => window.clearInterval(timer)
  }, [battle, speed])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [run?.id, run?.phase, hasBattle, needsNicknameSetup])

  useEffect(() => {
    const syncPageAudioFocus = () => {
      const appHasAudioFocus = !document.hidden && document.hasFocus()
      setAppHasAudioFocus(appHasAudioFocus)
    }
    document.addEventListener('visibilitychange', syncPageAudioFocus)
    window.addEventListener('focus', syncPageAudioFocus)
    window.addEventListener('blur', syncPageAudioFocus)
    return () => {
      document.removeEventListener('visibilitychange', syncPageAudioFocus)
      window.removeEventListener('focus', syncPageAudioFocus)
      window.removeEventListener('blur', syncPageAudioFocus)
    }
  }, [])

  useEffect(() => {
    if (!user || !appHasAudioFocus) {
      audioRef.current?.pause()
      return
    }

    let audio = audioRef.current
    if (!audio) {
      audio = new Audio(backgroundMusicSrc)
      audio.loop = true
      audio.volume = 0.55
      audioRef.current = audio
    }

    if (!musicEnabled) {
      audio.pause()
      return
    }

    void audio.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true))
  }, [appHasAudioFocus, musicEnabled, user])

  const selectedItem = run?.items.find((item) => item.id === selectedItemId) || null
  const selectedOffer = run?.shopItems.find((offer) => offer.offerId === selectedOfferId) || null
  const draggingItem = run?.items.find((item) => item.id === draggingItemId) || null
  const currentEvent = battle?.events[eventIndex]
  const score = run ? run.wins * 100 + Math.max(0, 12 - run.losses * 2) * 5 : 0
  const classRewardCeremonyKey = run?.phase === 'CLASS_REWARD' ? `${run.id}:${run.round}` : ''
  const showClassRewardCeremony = Boolean(run?.phase === 'CLASS_REWARD' && classRewardCeremonyKey && !ceremonyDismissedRounds.has(classRewardCeremonyKey))

  const action = async (fn: () => Promise<{ run: Run; battle?: Battle } | { user: AuthUser | null; activeRun?: Run | null; needsNickname?: boolean }>) => {
    setError('')
    try {
      const data = await fn()
      if ('user' in data) {
        setUser(data.user)
        setAppScreen('LOBBY')
        if (!data.user) {
          setRun(null)
        } else if ('activeRun' in data) {
          setRun(data.activeRun ?? null)
        }
        setNeedsNicknameSetup(Boolean(data.user && data.needsNickname))
      } else {
        setRun(data.run)
        if (data.battle) {
          setEventIndex(0)
          setBattle(data.battle)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const moveItem = (itemId: string, area: Area, x: number, y: number) => {
    if (!run) return
    void action(() => api(`/runs/${run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId, area, x, y }) }))
  }

  const upgradeItem = (itemId: string, targetItemId?: string) => {
    if (!run) return
    setTipAnchor(null)
    void action(() => api(`/runs/${run.id}/items/upgrade`, { method: 'POST', body: JSON.stringify({ itemId, targetItemId }) }))
  }

  const finishBattle = async () => {
    if (!run) return
    setError('')
    try {
      const data = await api<{ run: Run }>(`/runs/${run.id}/battle/finish`, { method: 'POST' })
      setRun(data.run)
      setBattle(null)
      setEventIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const onInspectOffer = (offerId: string, element: HTMLElement) => {
    setSelectedOfferId(offerId)
    setSelectedItemId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const onInspectItem = (itemId: string, element: HTMLElement) => {
    setSelectedItemId(itemId)
    setSelectedOfferId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const closeShopTip = () => {
    setSelectedItemId(null)
    setSelectedOfferId(null)
    setTipAnchor(null)
  }

  const dismissClassRewardCeremony = (key: string) => {
    if (!key) return
    setCeremonyDismissedRounds((current) => new Set(current).add(key))
  }

  const toggleMusic = () => {
    const nextEnabled = !musicEnabled
    window.localStorage.setItem(musicPreferenceKey, nextEnabled ? 'on' : 'off')
    setMusicEnabled(nextEnabled)
    if (nextEnabled && appHasAudioFocus) {
      setMusicBlocked(false)
      void audioRef.current?.play().catch(() => setMusicBlocked(true))
    } else {
      audioRef.current?.pause()
      setMusicBlocked(false)
    }
  }

  const onDragStart = (event: DragStartEvent) => {
    setDraggingItemId(String(event.active.id))
    setTipAnchor(null)
  }
  const onDragEnd = (event: DragEndEvent) => {
    setDraggingItemId(null)
    const itemId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (overId.startsWith('UPGRADE_ITEM:')) {
      const targetItemId = overId.slice('UPGRADE_ITEM:'.length)
      if (targetItemId && targetItemId !== itemId) upgradeItem(itemId, targetItemId)
      return
    }
    if (String(event.over?.id) === 'SELL_ZONE' && run?.phase === 'SHOP') {
      setSelectedItemId(null)
      setTipAnchor(null)
      void action(() => api(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId }) }))
      return
    }
    const slot = event.over ? parseSlotId(overId) : null
    if (slot) moveItem(itemId, slot.area, slot.x, slot.y)
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand-block">
            <img className="game-logo" src={gameIcon} alt="" />
            <div>
              <h1>狗骰对战</h1>
              <p>摆好装备，掷骰触发，挑战异步狗狗对手。</p>
            </div>
          </div>
          <label>邮箱<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="action-button" onClick={() => action(() => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }))}>登录</button>
            <button className="secondary action-button" onClick={() => action(() => api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }))}>注册</button>
          </div>
        </section>
      </main>
    )
  }

  if (needsNicknameSetup) {
    return (
      <Shell error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <NicknameSetup onSubmit={(nickname) => action(() => api('/profile/nickname', { method: 'POST', body: JSON.stringify({ nickname }) }))} />
      </Shell>
    )
  }

  if (appScreen === 'LOBBY') {
    return (
      <Shell run={run ?? undefined} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <ModeLobby run={run} onEnterCasual={() => setAppScreen('CASUAL')} onEnterDogfight={() => setAppScreen('DOGFIGHT')} onEnterPeak={() => setAppScreen('PEAK')} />
      </Shell>
    )
  }

  if (appScreen === 'DOGFIGHT') {
    return (
      <Shell run={run ?? undefined} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <DogfightLobby />
      </Shell>
    )
  }

  if (appScreen === 'PEAK') {
    return (
      <Shell run={run ?? undefined} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <ApexArena />
      </Shell>
    )
  }

  if (!run) {
    return (
      <Shell error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <DogSelect onPick={(choice) => action(() => api('/runs', { method: 'POST', body: JSON.stringify(choice) }))} />
      </Shell>
    )
  }

  return (
    <Shell run={run} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
      {!battle && run.lastBattle && run.phase !== 'COMPLETE' && <LastBattleRecord run={run} />}

      {!battle && run.phase === 'CHOICE' && (
        <ShopChoiceSelect choices={run.choices} onPick={(shopType) => action(() => api(`/runs/${run.id}/choice/select`, { method: 'POST', body: JSON.stringify({ shopType }) }))} />
      )}

      {!battle && run.phase === 'CLASS_REWARD' && showClassRewardCeremony && (
        <ClassRewardCeremony
          run={run}
          choices={run.classRewardChoices}
          onDismiss={() => dismissClassRewardCeremony(classRewardCeremonyKey)}
        />
      )}

      {!battle && run.phase === 'CLASS_REWARD' && !showClassRewardCeremony && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <section className="reward-workbench">
            <ClassRewardSelect
              choices={run.classRewardChoices}
              onPick={(defId) => action(() => api(`/runs/${run.id}/class-reward/select`, { method: 'POST', body: JSON.stringify({ defId }) }))}
            />
            <InventoryBoard
              run={run}
              selectedItemId={selectedItemId}
              draggingItemId={draggingItemId}
              onSelectItem={onInspectItem}
              onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)}
            />
            <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={closeShopTip} onBuy={null} onSell={null} onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null} />
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay item={draggingItem} />
          </DragOverlay>
        </DndContext>
      )}

      {!battle && run.phase === 'RELIC_CHOICE' && (
        <RelicChoiceSelect choices={run.relicChoices} onPick={(relicId) => action(() => api(`/runs/${run.id}/relic/select`, { method: 'POST', body: JSON.stringify({ relicId }) }))} />
      )}

      {!battle && run.phase === 'SHOP' && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <section className="shop-workbench">
            <ShopShelf
              run={run}
              selectedOfferId={selectedOfferId}
              draggingItemId={draggingItemId}
              onInspectOffer={onInspectOffer}
              onReroll={() => action(() => api(`/runs/${run.id}/shop/reroll`, { method: 'POST' }))}
              onMatch={() => action(() => api(`/runs/${run.id}/battle/match`, { method: 'POST' }))}
            />
            <InventoryBoard
              run={run}
              selectedItemId={selectedItemId}
              draggingItemId={draggingItemId}
              onSelectItem={onInspectItem}
              onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)}
            />
            <FloatingTip
              run={run}
              item={selectedItem}
              offer={selectedOffer}
              anchor={tipAnchor}
              onClose={closeShopTip}
              onBuy={() => selectedOffer && action(() => api(`/runs/${run.id}/shop/buy`, { method: 'POST', body: JSON.stringify({ offerId: selectedOffer.offerId, area: 'BAG' }) }))}
              onSell={() => selectedItem && action(() => api(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId: selectedItem.id }) }))}
              onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null}
            />
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay item={draggingItem} />
          </DragOverlay>
        </DndContext>
      )}

      {!battle && (run.phase === 'MATCH' || run.phase === 'PREP') && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <section className="match-panel">
            {run.phase === 'MATCH' ? (
              <>
                <img className="dog-avatar large" src={dogAssets[run.matchedGhost?.dogType ?? 'SHIBA']} alt="" />
                <h2>匹配到 {run.matchedGhost?.name}</h2>
                <p>{dogNames[run.matchedGhost?.dogType ?? 'SHIBA']} · {run.matchedGhost?.wins}胜 {run.matchedGhost?.losses}败 · 第 {run.matchedGhost?.round} 回合</p>
              </>
            ) : (
              <>
                <h2>整备阶段</h2>
                <p>整理装备与遗物后再匹配对手。</p>
              </>
            )}
            <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)} />
            <FloatingTip
              run={run}
              item={selectedItem}
              offer={null}
              anchor={tipAnchor}
              onClose={closeShopTip}
              onBuy={null}
              onSell={null}
              onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null}
            />
            <button className="primary action-button" onClick={() => action(() => api(run.phase === 'PREP' ? `/runs/${run.id}/battle/match` : `/runs/${run.id}/battle/start`, { method: 'POST' }))}>
              <Dice5 size={18} /> {run.phase === 'PREP' ? '匹配对手' : '开始战斗'}
            </button>
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay item={draggingItem} />
          </DragOverlay>
        </DndContext>
      )}

      {(run.phase === 'BATTLE' || run.phase === 'COMPLETE' || battle) && (
        <BattleView
          run={run}
          battle={battle}
          currentEvent={currentEvent}
          eventIndex={eventIndex}
          speed={speed}
          score={score}
          onSpeed={setSpeed}
          onContinue={() => void finishBattle()}
          onRestart={() => setRun(null)}
        />
      )}
    </Shell>
  )
}

const modeCards: Array<{
  id: GameMode
  title: string
  description: string
  icon: React.ReactNode
  locked: boolean
}> = [
  {
    id: 'CASUAL',
    title: '休闲模式',
    description: '当前经典构筑、商店、匹配和自动战斗流程',
    icon: <Gamepad2 size={38} />,
    locked: false,
  },
  {
    id: 'LADDER',
    title: '天梯模式',
    description: '累计排名、积分、赛季冲榜，未开放',
    icon: <Medal size={38} />,
    locked: true,
  },
  {
    id: 'DOGFIGHT',
    title: '斗狗模式',
    description: '实时战斗，未开放',
    icon: <RadioTower size={38} />,
    locked: false,
  },
  {
    id: 'PEAK',
    title: '巅峰模式',
    description: '战斗结束后的狗进入巅峰竞技场，自动挑战榜单冲击排名',
    icon: <Crown size={38} />,
    locked: false,
  },
]

function ModeLobby({ run, onEnterCasual, onEnterDogfight, onEnterPeak }: { run: Run | null; onEnterCasual: () => void; onEnterDogfight: () => void; onEnterPeak: () => void }) {
  const casualAction = run ? '继续休闲模式' : '开始休闲模式'
  return (
    <section className="mode-lobby-screen">
      <div className="screen-heading centered">
        <h2>模式大厅</h2>
        <p>选择本次要进入的竞技方式。休闲模式结束后的狗可以送入巅峰竞技场。</p>
      </div>
      <div className="mode-grid">
        {modeCards.map((mode) => (
          <article key={mode.id} className={mode.locked ? 'mode-card locked' : 'mode-card available'}>
            <span className="mode-icon">{mode.icon}</span>
            {mode.locked && (
              <span className="lock-chain" aria-label={`${mode.title}未解锁`}>
                <Lock size={18} />
                未解锁
              </span>
            )}
            <div className="mode-copy">
              <strong>{mode.title}</strong>
              <p>{mode.description}</p>
            </div>
            {mode.id === 'CASUAL' ? (
              <button className="primary action-button mode-action" onClick={onEnterCasual}>{casualAction}</button>
            ) : mode.id === 'DOGFIGHT' ? (
              <button className="primary action-button mode-action" onClick={onEnterDogfight}>进入斗狗模式</button>
            ) : mode.id === 'PEAK' ? (
              <button className="primary action-button mode-action" onClick={onEnterPeak}>进入巅峰模式</button>
            ) : (
              <button className="secondary action-button mode-action" disabled>
                <Lock size={18} /> 未解锁
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function DogfightLobby() {
  const [rooms, setRooms] = useState<DogfightRoomSummary[]>([])
  const [room, setRoom] = useState<DogfightRoom | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'CREATE' | 'JOIN' | 'MATCH' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const roomId = room?.id ?? null

  const loadRooms = async () => {
    setError('')
    try {
      const data = await api<DogfightRoomsResponse>('/dogfight/rooms')
      setRooms(data.rooms)
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗房间加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadRoom = async (roomId: string) => {
    setError('')
    try {
      const data = await api<DogfightRoomResponse>('/dogfight/rooms/' + roomId)
      setRoom(data.room)
      setPendingAction(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗房间进入失败')
    }
  }

  useEffect(() => {
    let active = true
    api<DogfightRoomsResponse>('/dogfight/rooms')
      .then((data) => {
        if (active) setRooms(data.rooms)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '斗狗房间加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (roomId) {
        void loadRoom(roomId)
      } else {
        void loadRooms()
      }
    }, 2_000)
    return () => window.clearInterval(timer)
  }, [roomId])

  const enterWithDog = async (choice: { dogType: DogType; luckyNumber?: number }) => {
    setError('')
    try {
      let data: DogfightRoomResponse
      if (pendingAction === 'CREATE') {
        data = await api<DogfightRoomResponse>('/dogfight/rooms', { method: 'POST', body: JSON.stringify(choice) })
      } else if (pendingAction === 'MATCH') {
        data = await api<DogfightRoomResponse>('/dogfight/match', { method: 'POST', body: JSON.stringify(choice) })
      } else {
        const roomId = selectedRoomId
        if (!roomId) throw new Error('请先选择一个未开始的房间')
        data = await api<DogfightRoomResponse>(`/dogfight/rooms/${roomId}/join`, { method: 'POST', body: JSON.stringify(choice) })
      }
      setRoom(data.room)
      setPendingAction(null)
      void loadRooms()
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗房间操作失败')
    }
  }

  if (room) {
    return <DogfightRoomView room={room} onRoomChange={setRoom} onLeave={() => { setRoom(null); void loadRooms() }} />
  }

  return (
    <section className="dogfight-screen">
      <div className="screen-heading centered">
        <h2>斗狗模式</h2>
        <p>房间内同步推进回合，前三回合发育，之后玩家两两对战。</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dogfight-layout">
        <aside className="dogfight-actions">
          <button className="primary action-button" onClick={() => setPendingAction('CREATE')}><House size={18} /> 创建房间</button>
          <button className="secondary action-button" disabled={!selectedRoomId} onClick={() => setPendingAction('JOIN')}><Swords size={18} /> 加入房间</button>
          <button className="primary action-button" onClick={() => setPendingAction('MATCH')}><RadioTower size={18} /> 随机匹配</button>
          {pendingAction && (
            <div className="dogfight-picker">
              <h3>{pendingAction === 'CREATE' ? '创建房间' : pendingAction === 'MATCH' ? '随机匹配' : '加入房间'}</h3>
              <DogSelect onPick={enterWithDog} />
            </div>
          )}
        </aside>
        <section className="dogfight-room-list">
          <div className="panel-heading">
            <h3>房间列表</h3>
            <button className="secondary action-button" onClick={() => void loadRooms()} disabled={loading}><RefreshCcw size={18} /> 刷新</button>
          </div>
          {rooms.length === 0 ? (
            <p className="apex-empty">暂无房间，创建一个斗狗房间开始。</p>
          ) : rooms.map((room) => (
            <article key={room.id} className={`dogfight-room-card ${selectedRoomId === room.id ? 'selected' : ''}`}>
              <div>
                <strong>{room.hostName} 的房间</strong>
                <p>{room.status === 'WAITING' ? '等待中' : room.status === 'ACTIVE' ? `第 ${room.currentRound} 回合` : '已结束'} · {room.memberCount}/{room.maxPlayers} 人 · 存活 {room.aliveCount}</p>
              </div>
              <button
                className="primary action-button"
                onClick={() => {
                  if (room.status === 'WAITING') {
                    setSelectedRoomId(room.id)
                    setPendingAction('JOIN')
                  } else {
                    void loadRoom(room.id)
                  }
                }}
              >
                {room.status === 'WAITING' ? '加入房间' : '观战'}
              </button>
            </article>
          ))}
        </section>
      </div>
    </section>
  )
}

function DogfightRoomView({ room, onRoomChange, onLeave }: { room: DogfightRoom; onRoomChange: (room: DogfightRoom) => void; onLeave: () => void }) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [battle, setBattle] = useState<Battle | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const run = room.currentRun
  const selectedItem = run?.items.find((item) => item.id === selectedItemId) || null
  const selectedOffer = run?.shopItems.find((offer) => offer.offerId === selectedOfferId) || null
  const draggingItem = run?.items.find((item) => item.id === draggingItemId) || null
  const currentMember = run ? room.members.find((member) => member.runId === run.id) : null

  useEffect(() => {
    if (!battle) return
    const timer = window.setInterval(() => {
      setEventIndex((value) => Math.min(value + 1, battle.events.length - 1))
    }, 420 / speed)
    return () => window.clearInterval(timer)
  }, [battle, speed])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const refreshRoom = async () => {
    const data = await api<DogfightRoomResponse>('/dogfight/rooms/' + room.id)
    onRoomChange(data.room)
  }

  const runAction = async (fn: () => Promise<{ run?: Run } | DogfightRoomResponse>) => {
    setError('')
    try {
      const data = await fn()
      if ('room' in data) {
        onRoomChange(data.room)
      } else {
        await refreshRoom()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗操作失败')
    }
  }

  const startRoom = () => runAction(() => api<DogfightRoomResponse>(`/dogfight/rooms/${room.id}/start`, { method: 'POST' }))
  const readyRoom = () => runAction(() => api<DogfightRoomResponse>(`/dogfight/rooms/${room.id}/ready`, { method: 'POST' }))

  const loadBattle = async (battleId: string) => {
    setError('')
    try {
      const data = await api<DogfightBattleResponse>(`/dogfight/battles/${battleId}`)
      setBattle(data.battle.result)
      setEventIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '战报读取失败')
    }
  }

  const moveItem = (itemId: string, area: Area, x: number, y: number) => {
    if (!run) return
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId, area, x, y }) }))
  }

  const upgradeItem = (itemId: string, targetItemId?: string) => {
    if (!run) return
    setTipAnchor(null)
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/items/upgrade`, { method: 'POST', body: JSON.stringify({ itemId, targetItemId }) }))
  }

  const onInspectOffer = (offerId: string, element: HTMLElement) => {
    setSelectedOfferId(offerId)
    setSelectedItemId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const onInspectItem = (itemId: string, element: HTMLElement) => {
    setSelectedItemId(itemId)
    setSelectedOfferId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const closeTip = () => {
    setSelectedItemId(null)
    setSelectedOfferId(null)
    setTipAnchor(null)
  }

  const onDragStart = (event: DragStartEvent) => {
    setDraggingItemId(String(event.active.id))
    setTipAnchor(null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingItemId(null)
    if (!run) return
    const itemId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (overId.startsWith('UPGRADE_ITEM:')) {
      const targetItemId = overId.slice('UPGRADE_ITEM:'.length)
      if (targetItemId && targetItemId !== itemId) upgradeItem(itemId, targetItemId)
      return
    }
    if (String(event.over?.id) === 'SELL_ZONE' && run.phase === 'SHOP') {
      setSelectedItemId(null)
      setTipAnchor(null)
      void runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId }) }))
      return
    }
    const slot = event.over ? parseSlotId(overId) : null
    if (slot) moveItem(itemId, slot.area, slot.x, slot.y)
  }

  const battleRun = run ?? battleToRun(battle)
  const deadline = room.readyDeadline ? Math.max(0, Math.ceil((new Date(room.readyDeadline).getTime() - now) / 1000)) : 0

  return (
    <section className="dogfight-room-view">
      <div className="dogfight-room-toolbar">
        <button className="secondary action-button" onClick={onLeave}><House size={18} /> 返回房间列表</button>
        <button className="secondary action-button" onClick={() => void refreshRoom()}><RefreshCcw size={18} /> 刷新房间</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dogfight-room-status">
        <div>
          <h2>{room.status === 'WAITING' ? '等待开局' : room.status === 'ACTIVE' ? `第 ${room.currentRound} 回合` : '房间结束'}</h2>
          <p>{room.status === 'ACTIVE' ? `整备倒计时 ${deadline}s` : `玩家 ${room.members.length}/${room.maxPlayers}`}</p>
        </div>
        {room.currentRun && <span className="resource-pill safe"><Shield size={16} /> 失败容错 {`${5 - room.currentRun.losses}`}</span>}
        {room.isHost && room.status === 'WAITING' && <button className="primary action-button" onClick={startRoom}>开始房间</button>}
        {run && room.status === 'ACTIVE' && !currentMember?.ready && !currentMember?.eliminated && <button className="primary action-button" onClick={readyRoom}>准备本回合</button>}
      </div>

      <div className="dogfight-room-columns">
        <aside className="dogfight-member-list">
          <h3>房间玩家</h3>
          {room.members.map((member) => (
            <article key={member.id} className={member.eliminated ? 'eliminated' : ''}>
              <img className="dog-avatar small" src={dogAssets[member.dogType]} alt="" />
              <div>
                <strong>{member.nickname}{member.isHost ? ' · 房主' : ''}</strong>
                <p>{dogNames[member.dogType]} · {member.wins}胜 {member.losses}败 · {member.ready ? '已准备' : member.eliminated ? '已淘汰' : '整备中'}</p>
              </div>
            </article>
          ))}
        </aside>

        <main className="dogfight-play-area">
          {battle && battleRun ? (
            <BattleView run={battleRun} battle={battle} currentEvent={battle.events[eventIndex]} eventIndex={eventIndex} speed={speed} score={0} onSpeed={setSpeed} onContinue={() => setBattle(null)} onRestart={() => setBattle(null)} />
          ) : run ? (
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <DogfightRunWorkbench
                run={run}
                selectedItemId={selectedItemId}
                selectedOfferId={selectedOfferId}
                draggingItemId={draggingItemId}
                onInspectOffer={onInspectOffer}
                onInspectItem={onInspectItem}
                onMoveItem={moveItem}
                onReroll={() => runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/reroll`, { method: 'POST' }))}
                onBuy={() => selectedOffer && runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/buy`, { method: 'POST', body: JSON.stringify({ offerId: selectedOffer.offerId, area: 'BAG' }) }))}
                onSell={() => selectedItem && runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId: selectedItem.id }) }))}
                onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null}
                onChoice={(shopType) => runAction(() => api<{ run: Run }>(`/runs/${run.id}/choice/select`, { method: 'POST', body: JSON.stringify({ shopType }) }))}
                onClassReward={(defId) => runAction(() => api<{ run: Run }>(`/runs/${run.id}/class-reward/select`, { method: 'POST', body: JSON.stringify({ defId }) }))}
                onRelic={(relicId) => runAction(() => api<{ run: Run }>(`/runs/${run.id}/relic/select`, { method: 'POST', body: JSON.stringify({ relicId }) }))}
                selectedItem={selectedItem}
                selectedOffer={selectedOffer}
                tipAnchor={tipAnchor}
                onCloseTip={closeTip}
              />
              <DragOverlay dropAnimation={null} zIndex={1000}>
                <DraggingItemOverlay item={draggingItem} />
              </DragOverlay>
            </DndContext>
          ) : (
            <p className="apex-empty">你正在观战这个房间。可以查看房间战况和历史战报。</p>
          )}

          <section className="dogfight-battle-list">
            <h3>战报</h3>
            {room.battles.length === 0 ? <p className="apex-empty">暂无战报</p> : room.battles.slice().reverse().map((entry) => (
              <button key={entry.id} className="dogfight-battle-row" onClick={() => void loadBattle(entry.id)}>
                第 {entry.round} 回合 · {entry.opponentKind === 'PLAYER' ? '玩家对战' : '离线训练'} · 回放
              </button>
            ))}
          </section>
        </main>
      </div>
    </section>
  )
}

function DogfightRunWorkbench({ run, selectedItemId, selectedOfferId, draggingItemId, selectedItem, selectedOffer, tipAnchor, onInspectOffer, onInspectItem, onMoveItem, onReroll, onBuy, onSell, onUpgrade, onChoice, onClassReward, onRelic, onCloseTip }: {
  run: Run
  selectedItemId: string | null
  selectedOfferId: string | null
  draggingItemId: string | null
  selectedItem: Item | null
  selectedOffer: ShopOffer | null
  tipAnchor: TipAnchor | null
  onInspectOffer: (offerId: string, element: HTMLElement) => void
  onInspectItem: (itemId: string, element: HTMLElement) => void
  onMoveItem: (itemId: string, area: Area, x: number, y: number) => void
  onReroll: () => void
  onBuy: () => void
  onSell: () => void
  onUpgrade: (() => void) | null
  onChoice: (shopType: ShopType) => void
  onClassReward: (defId: string) => void
  onRelic: (relicId: string) => void
  onCloseTip: () => void
}) {
  if (run.phase === 'CHOICE') return <ShopChoiceSelect choices={run.choices} onPick={onChoice} />
  if (run.phase === 'CLASS_REWARD') {
    return (
      <section className="reward-workbench">
        <ClassRewardSelect choices={run.classRewardChoices} onPick={onClassReward} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && onMoveItem(selectedItemId, area, x, y)} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={onUpgrade} />
      </section>
    )
  }
  if (run.phase === 'RELIC_CHOICE') return <RelicChoiceSelect choices={run.relicChoices} onPick={onRelic} />
  return (
    <section className="shop-workbench dogfight-workbench">
      {run.phase === 'SHOP' && <ShopShelf run={run} selectedOfferId={selectedOfferId} draggingItemId={draggingItemId} onInspectOffer={onInspectOffer} onReroll={onReroll} onMatch={() => undefined} />}
      <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && onMoveItem(selectedItemId, area, x, y)} />
      <FloatingTip run={run} item={selectedItem} offer={selectedOffer} anchor={tipAnchor} onClose={onCloseTip} onBuy={selectedOffer ? onBuy : null} onSell={selectedItem ? onSell : null} onUpgrade={onUpgrade} />
    </section>
  )
}

function battleToRun(battle: Battle | null): Run | null {
  const snapshot = battle?.playerSnapshot
  if (!snapshot) return null
  return {
    id: 'dogfight-spectator-battle',
    dogType: snapshot.dogType,
    luckyNumber: snapshot.luckyNumber,
    wins: snapshot.wins,
    losses: snapshot.losses,
    round: snapshot.round,
    gold: 0,
    phase: 'BATTLE',
    status: 'DOGFIGHT_SPECTATING',
    shopType: 'GENERAL',
    shopItems: [],
    choices: [],
    classRewardChoices: [],
    relicChoices: [],
    relics: snapshot.relics ?? [],
    refreshCost: 1,
    matchedGhost: null,
    lastBattle: null,
    items: snapshot.items,
  }
}

function ApexArena() {
  const [overview, setOverview] = useState<ApexOverview | null>(null)
  const [report, setReport] = useState<ApexChallengeReport | null>(null)
  const [submittedEntry, setSubmittedEntry] = useState<ApexEntry | null>(null)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submittingRunId, setSubmittingRunId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadApex = async () => {
    setError('')
    setLoading(true)
    try {
      setOverview(await api<ApexOverview>('/apex'))
    } catch (err) {
      setError(err instanceof Error ? err.message : '巅峰竞技场加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api<ApexOverview>('/apex')
      .then((data) => {
        if (active) setOverview(data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '巅峰竞技场加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const submitRun = async (runId: string) => {
    setError('')
    setSubmittingRunId(runId)
    try {
      const result = await api<ApexSubmitResponse>('/apex/submit', { method: 'POST', body: JSON.stringify({ runId }) })
      setReport(result.report)
      setSubmittedEntry(result.entry)
      setOverview((current) => ({
        leaderboard: result.leaderboard,
        candidates: current?.candidates.filter((run) => run.id !== runId) ?? [],
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交巅峰竞技场失败')
    } finally {
      setSubmittingRunId(null)
    }
  }

  const leaderboard = overview?.leaderboard ?? []
  const candidates = overview?.candidates ?? []

  return (
    <section className="apex-screen">
      <div className="screen-heading centered">
        <h2>巅峰竞技场</h2>
        <p>保存战斗结束后的死数据，自动从榜尾向上挑战，失败后固定在当前名次。</p>
      </div>
      <div className="apex-toolbar">
        <button className="secondary action-button" onClick={() => void loadApex()} disabled={loading}>
          <RefreshCcw size={18} /> 刷新
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {report && submittedEntry && (
        <div className="apex-report">
          <Trophy size={30} />
          <div>
            <h3>{submittedEntry.name} 登记为第 {report.placementRank} 名</h3>
            <p>连续击败 {report.challengeWins} 个对手，共进行了 {report.battles.length} 场挑战。</p>
          </div>
        </div>
      )}
      <div className="apex-layout">
        <section className="apex-candidates">
          <div className="panel-heading">
            <h3>可投入的完成狗</h3>
            <p>{candidates.length > 0 ? '选择一只狗进入巅峰竞技场。每只完成局只能提交一次。' : '暂无可提交的完成局。'}</p>
          </div>
          <div className="apex-candidate-list">
            {loading ? (
              <p className="apex-empty">正在读取巅峰数据...</p>
            ) : candidates.length === 0 ? (
              <p className="apex-empty">先在休闲模式完成一局，再回来冲榜。</p>
            ) : candidates.map((candidate) => (
              <article className="apex-candidate-card" key={candidate.id}>
                <img className="dog-avatar small" src={dogAssets[candidate.dogType]} alt="" />
                <div>
                  <strong>{dogNames[candidate.dogType]} · {candidate.wins}胜{candidate.losses}败</strong>
                  <p>第 {candidate.round} 回合 · 遗物 {candidate.relics.length} · 装备 {candidate.items.length}</p>
                </div>
                <button className="primary action-button" disabled={Boolean(submittingRunId)} onClick={() => void submitRun(candidate.id)}>
                  <Crown size={18} /> {submittingRunId === candidate.id ? '挑战中' : '投入巅峰'}
                </button>
              </article>
            ))}
          </div>
        </section>
        <section className="apex-leaderboard">
          <div className="panel-heading">
            <h3>巅峰榜</h3>
            <p>初始50个种子数据会随着玩家提交逐步被挤下去。</p>
          </div>
          <div className="apex-rank-list">
            {leaderboard.map((entry) => (
              <div className="apex-rank-entry" key={entry.id}>
                <article className={`apex-rank-row ${entry.isSeed ? 'seed' : 'player-entry'}`}>
                  <b>#{entry.rank}</b>
                  <img className="dog-avatar small" src={dogAssets[entry.dogType]} alt="" />
                  <div>
                    <strong>{entry.name}</strong>
                    <p>{dogNames[entry.dogType]} · {entry.wins}胜{entry.losses}败 · 第 {entry.round} 回合</p>
                  </div>
                  <span>{entry.isSeed ? '种子' : `${entry.challengeWins}连胜`}</span>
                  <button className="secondary action-button apex-config-toggle" onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}>
                    {expandedEntryId === entry.id ? '收起配置' : '查看配置'}
                  </button>
                </article>
                {expandedEntryId === entry.id && <ApexSnapshotDetails entry={entry} />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function ApexSnapshotDetails({ entry }: { entry: ApexEntry }) {
  const equipment = entry.items.filter((item) => item.area === 'EQUIPMENT')
  const bag = entry.items.filter((item) => item.area === 'BAG')
  return (
    <div className="apex-snapshot-details">
      <div className="battle-equipment-row player apex-equipment-preview">
        <div className="battle-row-title">
          <span>巅峰装备栏</span>
          <small>{entry.name} · {dogNames[entry.dogType]}</small>
        </div>
        <div className="battle-slot-grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
          {Array.from({ length: 12 }).map((_, x) => <i key={x} className="battle-slot" style={{ gridColumn: x + 1, gridRow: 1 }} />)}
          {equipment.map((item) => (
            <div
              key={item.id}
              className={`battle-item item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
              style={{ gridColumn: `${item.x + 1} / span ${item.def.width}`, gridRow: 1 }}
              title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${effectText(item.def, normalizeQuality(item.quality))}`}
            >
              <img className="item-icon" src={itemIcon(item.def)} alt="" />
              <span className="quality-chip">{qualityLabel[normalizeQuality(item.quality)]}</span>
              <span>{item.def.name}</span>
              <small><Dice5 size={12} /> {item.def.dice.join('/')}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="apex-relic-preview">
        <RelicRail relics={entry.relics} />
        <p>{entry.relics.length > 0 ? `遗物 ${entry.relics.length} 个` : '没有遗物'} · 背包物品 {bag.length} 个</p>
      </div>
    </div>
  )
}

function DogSelect({ onPick }: { onPick: (choice: { dogType: DogType; luckyNumber?: number }) => void }) {
  const [selectedDog, setSelectedDog] = useState<DogType>('SHIBA')
  const [luckyNumber, setLuckyNumber] = useState(1)
  const slots = Array.from({ length: DOG_SELECTION_SLOT_COUNT }, (_, index) => dogOptions[index] ?? null)
  const startRun = () => {
    onPick(selectedDog === 'EMPEROR' ? { dogType: selectedDog, luckyNumber } : { dogType: selectedDog })
  }
  return (
    <section className="dog-select-screen">
      <div className="screen-heading">
        <h2>选择你的狗狗伙伴</h2>
        <p>每个狗狗都有独特的被动特性和策略玩法</p>
      </div>
      <div className="dog-select">
        <div className="dog-card-grid">
          {slots.map((dog, index) => dog ? (
            <button className={`dog-card ${selectedDog === dog ? 'selected' : ''}`} key={dog} onClick={() => setSelectedDog(dog)}>
              <span className="dog-art-frame">
                <img className="dog-avatar" src={dogAssets[dog]} alt="" />
              </span>
              <strong>{dogNames[dog]}</strong>
              <small>{dogTraits[dog]}</small>
              <span className="tag-row">{dogTags[dog].map((tag) => <b key={tag}>{tag}</b>)}</span>
            </button>
          ) : (
            <div className="dog-card placeholder" key={`dog-placeholder-${index}`} aria-hidden="true" />
          ))}
        </div>
        <aside className="dog-detail-panel">
          <span className="dog-detail-art">
            <img className="dog-avatar large" src={dogAssets[selectedDog]} alt="" />
          </span>
          <h2>{dogNames[selectedDog]}</h2>
          <div className="detail-box">
            <strong>被动特性</strong>
            <p>{dogTraits[selectedDog]}</p>
          </div>
          <div className="detail-box">
            <strong>策略说明</strong>
            <p>{dogStrategies[selectedDog]}</p>
          </div>
          <div className="tag-row">
            {dogTags[selectedDog].map((tag) => <b key={tag}>{tag}</b>)}
          </div>
          {selectedDog === 'EMPEROR' && (
            <div className="lucky-number-picker">
              <strong>幸运数字</strong>
              <div>
                {[1, 2, 3, 4, 5, 6].map((number) => (
                  <button
                    key={number}
                    type="button"
                    className={luckyNumber === number ? 'selected' : ''}
                    onClick={() => setLuckyNumber(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="primary action-button" onClick={startRun}>开始一局</button>
        </aside>
      </div>
    </section>
  )
}

function Shell({ children, run, error, musicEnabled, musicBlocked, onToggleMusic, onOpenLobby, onLogout }: { children: React.ReactNode; run?: Run; error?: string; musicEnabled: boolean; musicBlocked: boolean; onToggleMusic: () => void; onOpenLobby?: () => void; onLogout: () => void }) {
  return (
    <main className="app-shell">
      <TopBar run={run} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={onToggleMusic} onOpenLobby={onOpenLobby} onLogout={onLogout} />
      {error && <p className="error">{error}</p>}
      <div className="screen-content">{children}</div>
    </main>
  )
}

function TopBar({ run, musicEnabled, musicBlocked, onToggleMusic, onOpenLobby, onLogout }: { run?: Run; musicEnabled: boolean; musicBlocked: boolean; onToggleMusic: () => void; onOpenLobby?: () => void; onLogout: () => void }) {
  const musicTitle = musicEnabled ? (musicBlocked ? '音乐待播放，点击重试' : '关闭音乐') : '开启音乐'
  return (
    <header className="topbar">
      <div className="brand-block compact">
        <img className="game-logo" src={gameIcon} alt="" />
        <div>
          <h1>狗骰对战</h1>
        </div>
      </div>
      {run && (
        <div className="stats">
          <ResourcePill icon={<Trophy size={16} />} label="胜场" value={`${run.wins}/12`} tone="win" />
          <ResourcePill icon={<Shield size={16} />} label="容错" value={`${3 - run.losses}`} tone={3 - run.losses <= 1 ? 'danger' : 'safe'} />
          <ResourcePill icon={<Coins size={16} />} label="金币" value={run.gold} tone="gold" />
          <ResourcePill icon={<Dice5 size={16} />} label="回合" value={run.round} tone="round" />
        </div>
      )}
      <div className="topbar-actions">
        {onOpenLobby && (
          <button className="icon-button" title="模式大厅" aria-label="模式大厅" onClick={onOpenLobby}>
            <House size={18} />
          </button>
        )}
        <IconButton title={musicTitle} onClick={onToggleMusic}>
          {musicEnabled ? <Music size={18} /> : <VolumeX size={18} />}
        </IconButton>
        <IconButton title="退出登录" onClick={onLogout}><LogOut size={18} /></IconButton>
      </div>
    </header>
  )
}

function NicknameSetup({ onSubmit }: { onSubmit: (nickname: string) => void | Promise<void> }) {
  const [nickname, setNickname] = useState('')
  const trimmed = nickname.trim()
  return (
    <section className="nickname-setup">
      <div className="screen-heading centered">
        <h2>设置昵称</h2>
        <p>昵称会显示在匹配和战斗记录里。</p>
      </div>
      <form
        className="nickname-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed.length >= 2) void onSubmit(trimmed)
        }}
      >
        <label>
          昵称
          <input value={nickname} maxLength={16} onChange={(event) => setNickname(event.target.value)} autoFocus />
        </label>
        <button className="primary action-button wide" disabled={trimmed.length < 2}>确认</button>
      </form>
    </section>
  )
}

function ResourcePill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <span className={`resource-pill ${tone}`} title={label}>
      {icon}<small>{label}</small><b>{value}</b>
    </span>
  )
}

function IconButton({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return <button className="icon-button" title={title} aria-label={title} disabled={disabled} onClick={onClick}>{children}</button>
}

function ShopChoiceSelect({ choices, onPick }: { choices: ShopType[]; onPick: (shopType: ShopType) => void }) {
  const [selectedChoice, setSelectedChoice] = useState<ShopType | null>(choices[0] ?? null)
  const slots = Array.from({ length: SHOP_CHOICE_SLOT_COUNT }, (_, index) => {
    const shopType = shopChoiceOrder[index]
    return choices.includes(shopType) ? shopType : null
  })
  return (
    <section className="shop-choice-screen">
      <div className="screen-heading centered">
        <h2>选择本回合要访问的商店</h2>
        <p>不同商店提供不同类型的道具，选择适合你战术的商店</p>
      </div>
      <div className="choice-grid">
        {slots.map((choice, index) => choice ? (
          <button key={choice} className={`choice ${selectedChoice === choice ? 'selected' : ''}`} onClick={() => setSelectedChoice(choice)}>
            <span className="choice-icon">{shopChoiceIcon(choice)}</span>
            <strong>{shopNames[choice]}</strong>
            <span>{shopDescriptions[choice]}</span>
          </button>
        ) : (
          <div className="choice placeholder" key={`choice-placeholder-${index}`} aria-hidden="true" />
        ))}
      </div>
      <button className="primary action-button choice-submit" disabled={!selectedChoice} onClick={() => selectedChoice && onPick(selectedChoice)}>
        进入 {selectedChoice ? shopNames[selectedChoice] : '商店'}
      </button>
    </section>
  )
}

function shopChoiceIcon(shopType: ShopType) {
  if (shopType === 'RELIC') return <Trophy size={36} />
  if (shopType === 'LARGE') return <Backpack size={36} />
  if (shopType === 'MEDIUM') return <Shield size={36} />
  if (shopType === 'SMALL') return <ShoppingBag size={36} />
  if (shopType === 'SMALL_DICE') return <Dice5 size={36} />
  if (shopType === 'BIG_DICE') return <Coins size={36} />
  return <Swords size={36} />
}

function handleChoiceCardKeyDown(event: KeyboardEvent<HTMLElement>, onChoose: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onChoose()
  }
}

function ClassRewardCeremony({ run, choices, onDismiss }: { run: Run; choices: ClassRewardChoice[]; onDismiss: () => void }) {
  const finalAwakening = run.round >= 6
  const title = finalAwakening ? '终阶觉醒' : '职业觉醒'
  const subtitle = finalAwakening ? '终阶职业装备已经解锁，构筑的核心能力将在这一回合定型。' : '职业路线开始成型，选择一件专属装备改变接下来的战斗节奏。'

  function handleCeremonyKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onDismiss()
    }
  }

  return (
    <section
      className="class-reward-ceremony"
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={handleCeremonyKeyDown}
      aria-label={`${dogNames[run.dogType]}${title}`}
    >
      <div className="ceremony-stage">
        <div className="ceremony-round-badge">第 {run.round} 回合</div>
        <img className="ceremony-dog-avatar" src={dogAssets[run.dogType]} alt="" />
        <div className="ceremony-copy">
          <span>{dogNames[run.dogType]} 专属装备授予</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="ceremony-reward-preview" aria-label="本次可选职业装备">
          {choices.map((choice) => (
            <span key={choice.defId} className={`ceremony-reward-chip ${qualityClass(choice.quality)}`}>
              <strong>{choice.def.name}</strong>
              <small>{choice.def.size}格 · {choice.def.dice.join('/')}</small>
            </span>
          ))}
        </div>
        <span className="ceremony-skip-hint">点击任意处继续</span>
      </div>
    </section>
  )
}

function ClassRewardSelect({ choices, onPick }: { choices: ClassRewardChoice[]; onPick: (defId: string) => void }) {
  const [selected, setSelected] = useState(choices[0]?.defId ?? '')
  return (
    <section className="reward-panel">
      <div className="screen-heading centered">
        <h2>选择职业装备</h2>
        <p>先整理背包，再选择一个职业装备放入背包。</p>
      </div>
      <div className="reward-choice-grid">
        {choices.map((choice) => (
          <div key={choice.defId} role="button" tabIndex={0} className={`choice reward-choice ${selected === choice.defId ? 'selected' : ''}`} onClick={() => setSelected(choice.defId)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelected(choice.defId))}>
            <strong>{choice.def.name}</strong>
            <span className={`tip-tag ${qualityClass(choice.quality)}`}>{qualityLabel[choice.quality]}</span>
            <span>{choice.def.size}格 · {choice.def.dice.join('/')}</span>
            <span><RuleText text={choice.def.description ?? effectText(choice.def, choice.quality)} /></span>
          </div>
        ))}
      </div>
      <button className="primary action-button choice-submit" disabled={!selected} onClick={() => selected && onPick(selected)}>领取职业装备</button>
    </section>
  )
}

function RelicChoiceSelect({ choices, onPick }: { choices: RelicChoice[]; onPick: (relicId: string) => void }) {
  const [selected, setSelected] = useState(choices[0]?.relicId ?? '')
  return (
    <section className="shop-choice-screen">
      <div className="screen-heading centered">
        <h2>选择遗物</h2>
        <p>免费选择一个遗物；重复遗物会直接升级。</p>
      </div>
      <div className="choice-grid relic-choice-grid">
        {choices.map((choice) => (
          <div key={choice.relicId} role="button" tabIndex={0} className={`choice relic-choice ${selected === choice.relicId ? 'selected' : ''}`} onClick={() => setSelected(choice.relicId)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelected(choice.relicId))}>
            <Trophy size={36} />
            <strong>{choice.def.name}</strong>
            <span className={`tip-tag ${qualityClass(choice.quality)}`}>{qualityLabel[choice.quality]}</span>
            <span><RuleText text={choice.def.description} /></span>
          </div>
        ))}
      </div>
      <button className="primary action-button choice-submit" disabled={!selected} onClick={() => selected && onPick(selected)}>获得遗物</button>
    </section>
  )
}

function ShopShelf({ run, selectedOfferId, draggingItemId, onInspectOffer, onReroll, onMatch }: { run: Run; selectedOfferId: string | null; draggingItemId: string | null; onInspectOffer: (offerId: string, element: HTMLElement) => void; onReroll: () => void; onMatch: () => void }) {
  return (
    <section className="shop-shelf">
      <div className="section-title">
        <div>
          <h2>{shopNames[run.shopType]}</h2>
          <p>点击商品查看详情，确认后再购买。</p>
        </div>
        <div className="shop-actions">
          <SellDropZone active={Boolean(draggingItemId)} />
          <button className="reroll-button" onClick={onReroll} title={`刷新商店：${run.refreshCost} 金币`}>
            <RefreshCcw size={18} />
            <span className="price-tag"><Coins size={14} />{run.refreshCost}</span>
          </button>
        </div>
      </div>
      <div className="offer-row">
        {run.shopItems.map((offer) => (
          <ShopCard key={offer.offerId} offer={offer} selected={selectedOfferId === offer.offerId} onClick={(element) => onInspectOffer(offer.offerId, element)} />
        ))}
      </div>
      <button className="primary action-button match-button" onClick={onMatch}>
        <Swords size={18} /> 匹配
      </button>
    </section>
  )
}

function SellDropZone({ active }: { active: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'SELL_ZONE' })
  return (
    <div ref={setNodeRef} className={`sell-zone ${active ? 'active' : ''} ${isOver ? 'over' : ''}`}>
      <BadgeDollarSign size={18} />
      <span>拖到这里出售</span>
    </div>
  )
}

function ShopCard({ offer, selected, onClick }: { offer: ShopOffer; selected: boolean; onClick: (element: HTMLElement) => void }) {
  const def = offer.def
  const quality = normalizeQuality(offer.quality)
  return (
    <button className={`shop-card ${qualityClass(offer.quality)} ${selected ? 'selected' : ''}`} onClick={(event) => onClick(event.currentTarget)}>
      <span className="quality-chip shop-quality-chip">{qualityLabel[quality]}</span>
      {def && <img className="shop-item-icon" src={itemIcon(def)} alt="" />}
      <div className="shop-card-main">
        <span className={`size-badge ${def ? itemTone(def) : 'utility'}`}>{def?.size ?? '?'}格</span>
        <strong>{def?.name ?? offer.defId}</strong>
      </div>
      {def && <SizePreview size={def.size} />}
      <span className="dice-line"><Dice5 size={15} /> {def?.dice.join(' / ') ?? '-'}</span>
      <span className="effect-line">{def ? effectText(def, quality) : '未知效果'}</span>
      <span className="price-tag"><Coins size={14} />{offer.price}{offer.discount < 1 ? ` · ${Math.round(offer.discount * 10)}折` : ''}</span>
    </button>
  )
}

function SizePreview({ size }: { size: number }) {
  return (
    <span className="size-preview" aria-label={`占用 ${size} 格`}>
      {[1, 2, 3, 4].map((slot) => <i key={slot} className={slot <= size ? 'filled' : ''} />)}
    </span>
  )
}

function InventoryBoard({ run, selectedItemId, draggingItemId, onSelectItem, onSlotClick }: { run: Run; selectedItemId: string | null; draggingItemId: string | null; onSelectItem: (itemId: string, element: HTMLElement) => void; onSlotClick: (area: Area, x: number, y: number) => void }) {
  return (
    <section className="inventory-board expanded">
      <GridPanel title="装备栏" subtitle="12 格单行，从左向右触发" icon={<Grid3X3 size={18} />} area="EQUIPMENT" w={12} h={1} items={run.items} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSelectItem={onSelectItem} onSlotClick={onSlotClick} />
      <div className="bag-relic-row">
        <RelicRail relics={run.relics ?? []} />
        <GridPanel title="背包" subtitle="12 格单行，战斗中默认不生效" icon={<Backpack size={18} />} area="BAG" w={12} h={1} items={run.items} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSelectItem={onSelectItem} onSlotClick={onSlotClick} />
      </div>
    </section>
  )
}

function RelicRail({ relics }: { relics: Relic[] }) {
  const [selectedRelicId, setSelectedRelicId] = useState<string | null>(null)
  const [relicTipAnchor, setRelicTipAnchor] = useState<TipAnchor | null>(null)
  const selectedRelic = relics.find((relic) => relic.id === selectedRelicId) ?? null
  return (
    <aside className="relic-rail">
      <div className="grid-heading">
        <h3><Trophy size={18} />遗物</h3>
        <p>6槽，重复获得升级</p>
      </div>
      <div className="relic-slot-grid">
        {Array.from({ length: 6 }).map((_, index) => {
          const relic = relics.find((entry) => entry.slot === index)
          return (
            <div key={index} className={`relic-slot ${relic ? qualityClass(relic.quality) : ''}`}>
              {relic ? (
                <button
                  type="button"
                  className="relic-icon-button"
                  aria-label={`${qualityLabel[relic.quality]}遗物：${relic.def.name}`}
                  aria-pressed={selectedRelicId === relic.id}
                  title={`${qualityLabel[relic.quality]} ${relic.def.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedRelicId(selectedRelicId === relic.id ? null : relic.id)
                    setRelicTipAnchor(selectedRelicId === relic.id ? null : getFloatingTipPosition(event.currentTarget))
                  }}
                >
                  <RelicGlyph relic={relic} size={30} />
                  <span className="relic-quality-dot" aria-hidden="true" />
                </button>
              ) : <span className="relic-empty-mark" aria-hidden="true" />}
            </div>
          )
        })}
      </div>
      <RelicFloatingTip relic={selectedRelic} anchor={relicTipAnchor} onClose={() => { setSelectedRelicId(null); setRelicTipAnchor(null) }} />
    </aside>
  )
}

function RelicGlyph({ relic, size }: { relic: Relic; size: number }) {
  const effect = relic.def.effect
  if (effect.includes('MIRROR') || effect.includes('GOLD')) return <BadgeDollarSign size={size} aria-hidden="true" />
  if (effect.includes('ROLL') || effect.includes('DIE') || effect.includes('BIAS') || effect.includes('ONLY_')) return <Dice5 size={size} aria-hidden="true" />
  if (effect.includes('SAFETY') || effect.includes('THORNS')) return <Shield size={size} aria-hidden="true" />
  if (effect.includes('EQUIPMENT')) return <Backpack size={size} aria-hidden="true" />
  return <Trophy size={size} aria-hidden="true" />
}

function RelicFloatingTip({ relic, anchor, onClose }: { relic: Relic | null; anchor: TipAnchor | null; onClose: () => void }) {
  useOutsideTipDismiss(Boolean(relic), onClose)
  if (!relic) return null
  const style = anchor ? { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties : undefined
  return (
    <aside className="relic-floating-tip floating-tip" style={style}>
      <div className="tip-tags">
        <span className={`tip-tag ${qualityClass(relic.quality)}`}>{qualityLabel[relic.quality]}</span>
        {relic.def.tags.map((tag) => <span key={tag} className="tip-tag">{tag}</span>)}
      </div>
      <div className="relic-tip-identity">
        <span className={`relic-tip-icon ${qualityClass(relic.quality)}`}>
          <RelicGlyph relic={relic} size={44} />
        </span>
        <h3>{relic.def.name}</h3>
      </div>
      <p className="tip-description"><RuleText text={relic.def.description} /></p>
    </aside>
  )
}

function GridPanel({ title, subtitle, icon, area, w, h, items, selectedItemId, draggingItemId, onSelectItem, onSlotClick }: { title: string; subtitle: string; icon: React.ReactNode; area: Area; w: number; h: number; items: Item[]; selectedItemId: string | null; draggingItemId: string | null; onSelectItem: (itemId: string, element: HTMLElement) => void; onSlotClick: (area: Area, x: number, y: number) => void }) {
  return (
    <div className="grid-panel">
      <div className="grid-heading">
        <h3>{icon}{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="slot-grid" style={{ gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${h}, var(--board-slot-h))` }}>
        {Array.from({ length: w * h }).map((_, index) => {
          const x = index % w
          const y = Math.floor(index / w)
          return <Slot key={`${area}:${x}:${y}`} id={`${area}:${x}:${y}`} x={x} y={y} title={`${title} ${x + 1}-${y + 1}`} onClick={() => onSlotClick(area, x, y)} />
        })}
        {items.filter((item) => item.area === area).map((item) => (
          <DraggableItem key={item.id} item={item} selected={selectedItemId === item.id} dragging={draggingItemId === item.id} upgradeable={canUpgradeItem(item, items)} onSelect={(element) => onSelectItem(item.id, element)} />
        ))}
      </div>
    </div>
  )
}

function Slot({ id, x, y, title, onClick }: { id: string; x: number; y: number; title: string; onClick: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return <button ref={setNodeRef} style={{ gridColumn: x + 1, gridRow: y + 1 }} className={`slot ${isOver ? 'over' : ''}`} onClick={onClick} aria-label={title} title={title} />
}

function DraggableItem({ item, selected, dragging, upgradeable, onSelect }: { item: Item; selected: boolean; dragging: boolean; upgradeable: boolean; onSelect: (element: HTMLElement) => void }) {
  const { attributes, listeners, setNodeRef: setDraggableNodeRef } = useDraggable({ id: item.id })
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({ id: `UPGRADE_ITEM:${item.id}`, disabled: !upgradeable })
  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableNodeRef(node)
    setDropNodeRef(node)
  }
  const style = {
    gridColumn: `${item.x + 1} / span ${item.def.width}`,
    gridRow: `${item.y + 1} / span ${item.def.height}`,
  }
  return (
    <button
      ref={setNodeRef}
      className={`item-card ${itemTone(item.def)} ${qualityClass(item.quality)} ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${upgradeable ? 'can-upgrade' : ''} ${isOver ? 'upgrade-over' : ''}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(event.currentTarget)
      }}
      title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${item.def.size}格 · 点数 ${item.def.dice.join('/')}`}
      {...listeners}
      {...attributes}
    >
      <ItemCardContent item={item} upgradeable={upgradeable} />
    </button>
  )
}

function ItemCardContent({ item, upgradeable = false }: { item: Item; upgradeable?: boolean }) {
  return (
    <>
      <span className="quality-chip">{qualityLabel[normalizeQuality(item.quality)]}</span>
      {upgradeable && <span className="upgrade-indicator" title="可升级">↑</span>}
      <img className="item-icon" src={itemIcon(item.def)} alt="" />
      <span>{item.def.name}</span>
      <SizePreview size={item.def.size} />
      <small><Dice5 size={12} /> {item.def.dice.join('/')}</small>
      <small className="item-effect">{effectText(item.def, normalizeQuality(item.quality))}</small>
    </>
  )
}

function DraggingItemOverlay({ item }: { item: Item | null }) {
  if (!item) return null
  return (
    <div
      className={`drag-overlay-item item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
      style={{ width: `calc(${item.def.width} * var(--slot-w))`, height: `calc(${item.def.height} * var(--board-slot-h))` }}
    >
      <ItemCardContent item={item} />
    </div>
  )
}

function FloatingTip({ run, item, offer, anchor, onClose, onBuy, onSell, onUpgrade }: { run: Run; item: Item | null; offer: ShopOffer | null; anchor: TipAnchor | null; onClose: () => void; onBuy: (() => void) | null; onSell: (() => void) | null; onUpgrade: (() => void) | null }) {
  const def = item?.def ?? offer?.def
  useOutsideTipDismiss(Boolean(def), onClose)
  if (!def) return null
  const isOffer = Boolean(offer)
  const quality = normalizeQuality(item?.quality ?? offer?.quality)
  const canAfford = !offer || run.gold >= offer.price
  const sellValue = item ? sellValueForItem(item.def) : null
  const style = anchor ? { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties : undefined
  return (
    <aside className="floating-tip" style={style}>
      <div className="tip-tags">
        <span className={`size-badge ${itemTone(def)}`}>{def.size}格</span>
        <span className={`tip-tag ${qualityClass(quality)}`}>{qualityLabel[quality]}</span>
        <span className="tip-tag">{diceToneText(def)}</span>
        <span className="tip-tag">{effectToneText(def)}</span>
      </div>
      <div className="tip-body">
        <div className="tip-identity">
          <span className={`tip-icon-frame ${itemTone(def)}`}>
            <img className="tip-icon" src={itemIcon(def)} alt="" />
          </span>
          <h3>{def.name}</h3>
        </div>
        <div className="tip-grid-preview">
          <SizePreview size={def.size} />
          <span>占用 {def.size} 格</span>
        </div>
      </div>
      <div className="tip-dice" aria-label={`触发点数 ${def.dice.join('/')}`}>
        <Dice5 size={22} />
        {def.dice.map((face) => <span key={face}>{face}</span>)}
      </div>
      <p className="tip-description"><RuleText text={def.description ?? effectText(def, quality)} /></p>
      {isOffer && (
        <div className="tip-price">
          <Coins size={16} />
          <span>价格 {offer?.price}{offer && offer.discount < 1 ? ` · ${Math.round(offer.discount * 10)}折` : ''}</span>
        </div>
      )}
      <div className="tip-actions">
        {isOffer && onBuy ? (
          <button className="primary action-button wide" disabled={!canAfford} onClick={onBuy}>
            <PackagePlus size={18} /> 购买到背包
          </button>
        ) : (
          <>
            {onUpgrade && (
              <button className="primary action-button wide" onClick={onUpgrade}>
                <PackagePlus size={18} /> 升级
              </button>
            )}
            {onSell ? (
              <button className="danger-button wide" onClick={onSell}>
                <BadgeDollarSign size={18} /> 出售 +{sellValue}
              </button>
            ) : !onUpgrade ? (
              <small className="disabled-reason">战斗中仅查看物品详情</small>
            ) : null}
          </>
        )}
        {!canAfford && <small className="disabled-reason">金币不足，还差 {(offer?.price ?? 0) - run.gold} 金币。</small>}
      </div>
    </aside>
  )
}

function LastBattleRecord({ run }: { run: Run }) {
  const [battleTip, setBattleTip] = useState<{ item: Item; anchor: TipAnchor } | null>(null)
  const battle = run.lastBattle
  if (!battle) return null
  const snapshot = battle.playerSnapshot ?? {
    name: '你的狗狗',
    dogType: run.dogType,
    luckyNumber: run.luckyNumber,
    wins: run.wins,
    losses: run.losses,
    round: Math.max(0, run.round - 1),
    items: run.items,
  }
  const opponentSnapshot = battle.opponentSnapshot ?? {
    name: run.matchedGhost?.name ?? '上一局对手',
    dogType: run.matchedGhost?.dogType ?? 'MUTT',
    luckyNumber: run.matchedGhost?.luckyNumber ?? null,
    wins: run.matchedGhost?.wins ?? 0,
    losses: run.matchedGhost?.losses ?? 0,
    round: Math.max(0, run.round - 1),
    items: [] as Item[],
  }
  const resultText = battle.winner === 'player' ? '胜利' : '失败'
  const hpText = `${Math.max(0, Math.round(battle.playerHp))}/${battle.playerMaxHp} vs ${Math.max(0, Math.round(battle.opponentHp))}/${battle.opponentMaxHp}`

  return (
    <section className="last-battle-record">
      <div className="last-battle-summary">
        <div>
          <span>上一局对战记录</span>
          <h2>{resultText} · {snapshot.wins}胜 {snapshot.losses}败</h2>
        </div>
        <p>对手 {opponentSnapshot.name} · {dogNames[opponentSnapshot.dogType]} · 结束血量 {hpText}</p>
      </div>
      <BattleEquipmentRow owner="player" snapshot={snapshot} onInspect={(item, element) => setBattleTip({ item, anchor: getFloatingTipPosition(element) })} />
      <BattleEquipmentRow owner="opponent" snapshot={opponentSnapshot} onInspect={(item, element) => setBattleTip({ item, anchor: getFloatingTipPosition(element) })} />
      {battleTip && (
        <FloatingTip
          run={run}
          item={battleTip.item}
          offer={null}
          anchor={battleTip.anchor}
          onClose={() => setBattleTip(null)}
          onBuy={null}
          onSell={null}
          onUpgrade={null}
        />
      )}
    </section>
  )
}

function BattleView({ run, battle, currentEvent, eventIndex, speed, score, onSpeed, onContinue, onRestart }: { run: Run; battle: Battle | null; currentEvent?: BattleEvent; eventIndex: number; speed: number; score: number; onSpeed: (speed: number) => void; onContinue: () => void; onRestart: () => void }) {
  const [logOpen, setLogOpen] = useState(false)
  const [battleTip, setBattleTip] = useState<{ item: Item; anchor: TipAnchor } | null>(null)
  const playback = battle ?? run.lastBattle
  const events = playback?.events ?? []
  const displayIndex = battle ? eventIndex : Math.max(0, events.length - 1)
  const event = currentEvent ?? events[Math.min(displayIndex, Math.max(0, events.length - 1))]
  const playerSnapshot = playback?.playerSnapshot ?? {
    name: '你的狗狗',
    dogType: run.dogType,
    luckyNumber: run.luckyNumber,
    wins: run.wins,
    losses: run.losses,
    round: run.round,
    items: run.items,
  }
  const opponentSnapshot = playback?.opponentSnapshot ?? {
    name: run.matchedGhost?.name ?? '离线狗狗',
    dogType: run.matchedGhost?.dogType ?? 'MUTT',
    luckyNumber: run.matchedGhost?.luckyNumber ?? null,
    wins: run.matchedGhost?.wins ?? 0,
    losses: run.matchedGhost?.losses ?? 0,
    round: run.matchedGhost?.round ?? run.round,
    items: [] as Item[],
  }
  const lastRollEvent = events.slice(0, displayIndex + 1).reverse().find((entry) => entry.kind === 'ROLL')
  const isFinished = Boolean(playback && (!battle || eventIndex >= events.length - 1))

  return (
    <section className="battle-panel visual-battle">
      <div className="battle-toolbar">
        <div>
          <h2>自动战斗</h2>
          <p>{event ? `${event.time}s · ${event.text}` : '准备播放战斗结果'}</p>
        </div>
        <div className="speed-row" aria-label="战斗速度">
          {[1, 2, 4].map((value) => <button key={value} className={speed === value ? 'active' : ''} onClick={() => onSpeed(value)}>{value}x</button>)}
        </div>
      </div>

      <BattleEquipmentRow owner="opponent" snapshot={opponentSnapshot} activeEvent={event} onInspect={(item, element) => setBattleTip({ item, anchor: getFloatingTipPosition(element) })} />
      <BattleStage
        player={playerSnapshot}
        opponent={opponentSnapshot}
        event={event}
        lastRoll={lastRollEvent}
        speed={speed}
        finished={isFinished}
        winner={playback?.winner}
      />
      <BattleEquipmentRow owner="player" snapshot={playerSnapshot} activeEvent={event} onInspect={(item, element) => setBattleTip({ item, anchor: getFloatingTipPosition(element) })} />
      {battleTip && (
        <FloatingTip
          run={run}
          item={battleTip.item}
          offer={null}
          anchor={battleTip.anchor}
          onClose={() => setBattleTip(null)}
          onBuy={null}
          onSell={null}
          onUpgrade={null}
        />
      )}

      {run.phase === 'COMPLETE' ? (
        <div className="result">
          <Trophy size={32} />
          <h2>跑局结束</h2>
          <p>{run.wins} 胜 / {run.losses} 败 · 积分 {score}</p>
          <button className="primary action-button" onClick={onRestart}>重新选择狗狗</button>
        </div>
      ) : run.phase === 'BATTLE' && isFinished && (
        <div className="battle-continue-row">
          <button className="primary action-button" onClick={onContinue}>
            <ArrowRight size={18} /> 继续
          </button>
        </div>
      )}

      <CollapsedBattleLog events={events} eventIndex={displayIndex} open={logOpen} onToggle={() => setLogOpen((value) => !value)} />
    </section>
  )
}

function BattleEquipmentRow({ owner, snapshot, activeEvent, onInspect }: { owner: 'player' | 'opponent'; snapshot: BattleSnapshot; activeEvent?: BattleEvent; onInspect: (item: Item, element: HTMLElement) => void }) {
  const items = snapshot.items.filter((item) => item.area === 'EQUIPMENT')
  const activeItemId = activeEvent?.actor === owner && activeEvent.kind === 'ITEM' ? activeEvent.itemId : null
  return (
    <div className={`battle-equipment-row ${owner}`}>
      <div className="battle-row-title">
        <span>{owner === 'player' ? '你的装备栏' : '对手装备栏'}</span>
        <small>{snapshot.name} · {dogNames[snapshot.dogType]}</small>
      </div>
      <div className="battle-slot-grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
        {Array.from({ length: 12 }).map((_, x) => <i key={x} className="battle-slot" style={{ gridColumn: x + 1, gridRow: 1 }} />)}
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`battle-item item-card ${itemTone(item.def)} ${qualityClass(item.quality)} ${activeItemId === item.id ? 'active' : ''}`}
            style={{
              gridColumn: `${item.x + 1} / span ${item.def.width}`,
              gridRow: 1,
            }}
            title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${effectText(item.def, normalizeQuality(item.quality))}`}
            onClick={(event) => onInspect(item, event.currentTarget)}
          >
            <img className="item-icon" src={itemIcon(item.def)} alt="" />
            <span className="quality-chip">{qualityLabel[normalizeQuality(item.quality)]}</span>
            <span>{item.def.name}</span>
            <small><Dice5 size={12} /> {item.def.dice.join('/')}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

function BattleStage({ player, opponent, event, lastRoll, speed, finished, winner }: { player: BattleSnapshot; opponent: BattleSnapshot; event?: BattleEvent; lastRoll?: BattleEvent; speed: number; finished: boolean; winner?: string }) {
  const playerMaxHp = event?.playerMaxHp ?? maxHealthForRound(player.round)
  const opponentMaxHp = event?.opponentMaxHp ?? maxHealthForRound(opponent.round)
  const playerHp = event?.playerHp ?? playerMaxHp
  const opponentHp = event?.opponentHp ?? opponentMaxHp
  const playerShield = event?.playerShield ?? 0
  const opponentShield = event?.opponentShield ?? 0
  return (
    <div className="battle-stage">
      <BattleFxCanvas event={event} speed={speed} />
      <BattleDog
        side="opponent"
        snapshot={opponent}
        hp={opponentHp}
        maxHp={opponentMaxHp}
        shield={opponentShield}
        event={event}
        finished={finished}
        winner={winner}
      />
      <BattleDice event={event} lastRoll={lastRoll} />
      <BattleDog
        side="player"
        snapshot={player}
        hp={playerHp}
        maxHp={playerMaxHp}
        shield={playerShield}
        event={event}
        finished={finished}
        winner={winner}
      />
    </div>
  )
}

function BattleDog({ side, snapshot, hp, maxHp, shield, event, finished, winner }: { side: 'player' | 'opponent'; snapshot: BattleSnapshot; hp: number; maxHp: number; shield: number; event?: BattleEvent; finished: boolean; winner?: string }) {
  const isActor = event?.actor === side
  const isTarget = event?.target === side || event?.target === 'both'
  const healing = isActor && event?.effectType === 'HEAL'
  const lost = finished && winner && winner !== side
  const won = finished && winner === side
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0
  const shieldValue = Math.max(0, Math.round(shield))
  const shieldPercent = maxHp > 0 ? (shieldValue / maxHp) * 100 : 0
  const rows = side === 'player' ? event?.playerStatuses : event?.opponentStatuses
  const positiveStatuses = rows?.positive ?? []
  const negativeStatuses = rows?.negative ?? []
  const poisonStatus = negativeStatuses.find((status) => status.type === 'poison')
  const poisonPreviewPercent = maxHp > 0 ? ((poisonStatus?.tickDamage ?? 0) / maxHp) * 100 : 0
  const poisonPreviewLeft = Math.max(0, Math.min(100, hpPercent - poisonPreviewPercent))
  return (
    <div className={`battle-dog ${side} ${isActor ? 'attacking' : ''} ${isTarget && event?.effectType !== 'HEAL' ? 'hit' : ''} ${healing ? 'healing' : ''} ${poisonStatus ? 'poisoned' : ''} ${won ? 'winner' : ''} ${lost ? 'loser' : ''}`}>
      <div className="hp">
        <span><HeartPulse size={16} /> {snapshot.name}</span>
        <StatusEffectRow tone="positive" statuses={positiveStatuses} />
        <div className="hp-bar">
          {shieldValue > 0 && <i className="hp-shield" style={{ width: `${Math.max(6, Math.min(100, shieldPercent))}%` }} />}
          <i className="hp-current" style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
          {poisonPreviewPercent > 0 && <i className="hp-preview poison" style={{ left: `${poisonPreviewLeft}%`, width: `${Math.max(3, Math.min(100, poisonPreviewPercent))}%` }} />}
        </div>
        <StatusEffectRow tone="negative" statuses={negativeStatuses} />
        <b>{Math.max(0, Math.round(hp))}/{maxHp}</b>
        {shieldValue > 0 && (
          <div className="shield-bar" aria-label={`护盾 ${shieldValue}`}>
            <i style={{ width: `${Math.max(6, Math.min(100, shieldPercent))}%` }} />
            <span><Shield size={13} /> 护盾 {shieldValue}</span>
          </div>
        )}
      </div>
      <img className="battle-dog-img" src={dogAssets[snapshot.dogType]} alt="" />
      <strong>{dogNames[snapshot.dogType]}</strong>
    </div>
  )
}

function StatusEffectRow({ tone, statuses }: { tone: 'positive' | 'negative'; statuses: BattleStatusEntry[] }) {
  const visible = statuses.slice(0, 3)
  const hidden = statuses.length - visible.length
  return (
    <div className={`status-effects ${tone}`}>
      {visible.map((status) => <span key={`${tone}-${status.type}`} className={`status-chip ${status.type}`}>{statusText(status)}</span>)}
      {hidden > 0 && <span className="status-chip more" title={statuses.map(statusText).join(' / ')}>+{hidden}</span>}
    </div>
  )
}

function statusText(status: BattleStatusEntry) {
  if (status.type === 'poison') return `${status.label} ${status.stacks ?? 0}层 · ${status.nextTickIn ?? 1}s`
  if (status.stacks != null) return `${status.label} ${status.stacks}层`
  if (status.amount != null) return `${status.label} ${status.amount}`
  if (status.remaining != null) return `${status.label} ${status.remaining}s`
  return status.label
}

function BattleDice({ event, lastRoll }: { event?: BattleEvent; lastRoll?: BattleEvent }) {
  const actor = event?.kind === 'ROLL' ? event.actor : lastRoll?.actor ?? event?.actor
  const roll = event?.roll ?? lastRoll?.roll
  return (
    <div className={`battle-dice ${event?.kind === 'ROLL' ? 'rolling' : ''}`}>
      <Dice5 size={32} />
      <b>{roll ?? '-'}</b>
      <span>{actor === 'opponent' ? '对手掷骰' : actor === 'player' ? '玩家掷骰' : '战斗结算'}</span>
    </div>
  )
}

function BattleFxCanvas({ event, speed }: { event?: BattleEvent; speed: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !event) return
    const context = canvas.getContext('2d')
    if (!context) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const scale = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * scale))
      canvas.height = Math.max(1, Math.floor(rect.height * scale))
      context.setTransform(scale, 0, 0, scale, 0, 0)
      return rect
    }
    let rect = resize()
    const targetX = event.target === 'player' ? rect.width * 0.74 : event.target === 'opponent' ? rect.width * 0.26 : rect.width * 0.5
    const actorX = event.actor === 'player' ? rect.width * 0.74 : event.actor === 'opponent' ? rect.width * 0.26 : rect.width * 0.5
    const centerY = rect.height * 0.5
    const particles = createBattleParticles(event, event.effectType === 'HEAL' ? actorX : targetX, centerY)
    const started = performance.now()
    const duration = Math.max(260, 760 / speed)
    let frame = 0

    const draw = (now: number) => {
      rect = resize()
      const t = Math.min(1, (now - started) / duration)
      context.clearRect(0, 0, rect.width, rect.height)
      for (const particle of particles) {
        const x = particle.x + particle.vx * t
        const y = particle.y + particle.vy * t
        context.globalAlpha = Math.max(0, 1 - t) * particle.alpha
        context.fillStyle = particle.color
        context.strokeStyle = particle.color
        context.lineWidth = particle.size
        if (particle.kind === 'slash') {
          context.beginPath()
          context.moveTo(x - 18, y - 8)
          context.lineTo(x + 18, y + 8)
          context.stroke()
        } else {
          context.beginPath()
          context.arc(x, y, particle.size + t * particle.grow, 0, Math.PI * 2)
          context.fill()
        }
      }
      if (event.amount && event.kind !== 'ROLL') {
        context.globalAlpha = Math.max(0, 1 - t)
        context.font = '900 28px Inter, Microsoft YaHei, sans-serif'
        context.textAlign = 'center'
        context.fillStyle = event.effectType === 'HEAL' ? '#16a34a' : event.effectType === 'POISON' ? '#7c3aed' : '#ef4444'
        const prefix = event.effectType === 'HEAL' ? '+' : '-'
        context.fillText(`${prefix}${event.amount}`, targetX, centerY - 46 - t * 34)
      }
      context.globalAlpha = 1
      if (t < 1) frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [event, speed])

  return <canvas ref={canvasRef} className="battle-fx-canvas" aria-hidden="true" />
}

function createBattleParticles(event: BattleEvent, x: number, y: number) {
  const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; grow: number; alpha: number; color: string; kind: 'dot' | 'slash' }> = []
  const palette = event.effectType === 'HEAL'
    ? ['#34d399', '#86efac', '#22c55e']
    : event.effectType === 'POISON'
      ? ['#7c3aed', '#84cc16', '#a7f3d0']
      : event.kind === 'ROLL'
        ? ['#60a5fa', '#fbbf24', '#ffffff']
        : ['#ef4444', '#fb7185', '#fbbf24']
  const count = event.effectType === 'POISON' ? 32 : event.kind === 'ROLL' ? 18 : 24
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count
    const distance = 30 + (index % 5) * 12
    particles.push({
      x: x + Math.cos(angle) * 12,
      y: y + Math.sin(angle) * 8,
      vx: Math.cos(angle) * distance,
      vy: Math.sin(angle) * distance - (index % 3) * 10,
      size: event.effectType === 'POISON' ? 9 + (index % 4) : 3 + (index % 5),
      grow: event.effectType === 'POISON' ? 16 : event.effectType === 'HEAL' ? 10 : 4,
      alpha: event.effectType === 'POISON' ? 0.32 : 0.82,
      color: palette[index % palette.length],
      kind: event.effectType === 'DAMAGE' && index % 4 === 0 ? 'slash' : 'dot',
    })
  }
  return particles
}

function CollapsedBattleLog({ events, eventIndex, open, onToggle }: { events: BattleEvent[]; eventIndex: number; open: boolean; onToggle: () => void }) {
  const visible = open ? events.slice(Math.max(0, eventIndex - 40), eventIndex + 1) : events.slice(Math.max(0, eventIndex - 3), eventIndex + 1)
  return (
    <div className={`battle-log-shell ${open ? 'open' : ''}`}>
      <button className="log-toggle" onClick={onToggle}>{open ? '收起日志' : '展开日志'}</button>
      <div className="battle-log">
        {visible.map((event, index) => (
          <p key={`${event.time}-${index}-${event.text}`} className={event.actor}>{event.time}s · {event.text}</p>
        ))}
      </div>
    </div>
  )
}
