import { forwardRef, useId } from 'react'
import type { ButtonHTMLAttributes, ForwardedRef, HTMLAttributes, ReactNode } from 'react'

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export type HanddrawnFrameProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div' | 'aside' | 'span'
  variant?: 'panel' | 'card' | 'hud' | 'tray' | 'floating'
  ornament?: 'plain' | 'corner' | 'wood' | 'bone' | 'ribbon'
  selected?: boolean
  tone?: string
  children: ReactNode
}

export function HanddrawnFrame({
  as = 'div',
  variant = 'panel',
  ornament = 'corner',
  selected = false,
  tone,
  className,
  children,
  ...props
}: HanddrawnFrameProps) {
  const Component = as
  return (
    <Component
      className={joinClasses(
        'handdrawn-frame',
        `handdrawn-frame-${variant}`,
        `handdrawn-frame-${ornament}`,
        tone && `handdrawn-frame-tone-${tone}`,
        selected && 'selected',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export type HanddrawnButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
  pressed?: boolean
  wide?: boolean
}

export function HanddrawnButton({
  variant = 'primary',
  pressed = false,
  wide = false,
  className,
  children,
  ...props
}: HanddrawnButtonProps) {
  return (
    <button
      className={joinClasses(
        'handdrawn-button',
        `handdrawn-button-${variant}`,
        pressed && 'pressed',
        wide && 'wide',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({ className, ...props }: Omit<HanddrawnButtonProps, 'variant'>) {
  return <HanddrawnButton variant="icon" className={joinClasses('icon-button', className)} {...props} />
}

export function ResourcePill({ icon, label, value, tone, className }: { icon: ReactNode; label: string; value: string | number; tone: string; className?: string }) {
  return (
    <span className={joinClasses('resource-pill', 'handdrawn-resource-pill', tone, className)} title={label}>
      {icon}<small>{label}</small><b>{value}</b>
    </span>
  )
}

export function HanddrawnTextButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={joinClasses('handdrawn-text-button', className)} {...props} />
}

export function HanddrawnTabButton({ active = false, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button type={type} className={joinClasses('handdrawn-tab-button', active && 'active', className)} {...props} />
}

export function HanddrawnListButton({ selected = false, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type={type} className={joinClasses('handdrawn-list-button', selected && 'selected', className)} {...props} />
}

export function HanddrawnNumberButton({ selected = false, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type={type} className={joinClasses('handdrawn-number-button', selected && 'selected', className)} {...props} />
}

export function HanddrawnSlotButton({ nodeRef, over = false, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { nodeRef?: (node: HTMLButtonElement | null) => void; over?: boolean }) {
  return <button ref={nodeRef} type={type} className={joinClasses('slot', 'handdrawn-slot-button', over && 'over', className)} {...props} />
}

export function RelicIconButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={joinClasses('relic-icon-button', 'handdrawn-relic-icon-button', className)} {...props} />
}

export function ChoiceCard({ selected = false, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { selected?: boolean }) {
  return (
    <div className={joinClasses('choice', 'paper-card', 'sticker-card', 'handdrawn-choice-card', selected && 'selected', className)} {...props}>
      {children}
    </div>
  )
}

type ItemFrameSharedProps = {
  as?: 'div' | 'button'
  children: ReactNode
}

export type ItemFrameProps =
  | (HTMLAttributes<HTMLDivElement> & ItemFrameSharedProps & { as?: 'div' })
  | (ButtonHTMLAttributes<HTMLButtonElement> & ItemFrameSharedProps & { as: 'button' })

export const ItemFrame = forwardRef<HTMLDivElement | HTMLButtonElement, ItemFrameProps>(function ItemFrame(
  props,
  ref,
) {
  if (props.as === 'button') {
    const { as, className, children, ...buttonProps } = props
    return (
      <button ref={ref as ForwardedRef<HTMLButtonElement>} className={joinClasses('item-card', 'paper-item-card', 'handdrawn-item-frame', className)} {...buttonProps}>
        {children}
      </button>
    )
  }

  const { as, className, children, ...divProps } = props
  return (
    <div ref={ref as ForwardedRef<HTMLDivElement>} className={joinClasses('item-card', 'paper-item-card', 'handdrawn-item-frame', className)} {...divProps}>
      {children}
    </div>
  )
})

export type DogBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  dogType: string
  src: string
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'battle'
  side?: 'player' | 'opponent'
  selected?: boolean
  status?: 'poison' | 'shield' | 'winner' | 'loser'
  skinClass?: string
}

export function DogBadge({
  dogType,
  src,
  alt = '',
  size = 'md',
  side,
  selected = false,
  status,
  skinClass,
  className,
  ...props
}: DogBadgeProps) {
  return (
    <span
      className={joinClasses(
        'dog-badge',
        `dog-badge-${size}`,
        side && `dog-badge-${side}`,
        selected && 'selected',
        status && `dog-badge-${status}`,
        skinClass,
        className,
      )}
      data-dog-type={dogType}
      {...props}
    >
      <img className="dog-badge-image" src={src} alt={alt} />
      <i className="dog-badge-ring" aria-hidden="true" />
    </span>
  )
}

export type BoneHealthBarProps = HTMLAttributes<HTMLDivElement> & {
  name: string
  hp: number
  maxHp: number
  shield?: number
  poisonPreviewDamage?: number
  side?: 'player' | 'opponent'
  statusSlotTop?: ReactNode
  statusSlotBottom?: ReactNode
}

export function BoneHealthBar({
  name,
  hp,
  maxHp,
  shield = 0,
  poisonPreviewDamage = 0,
  side,
  statusSlotTop,
  statusSlotBottom,
  className,
  children,
  ...props
}: BoneHealthBarProps) {
  const rawClipId = useId()
  const clipId = `bone-health-${rawClipId.replace(/:/g, '')}`
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0
  const shieldValue = Math.max(0, Math.round(shield))
  const shieldPercent = maxHp > 0 ? (shieldValue / maxHp) * 100 : 0
  const poisonPreviewPercent = maxHp > 0 ? (poisonPreviewDamage / maxHp) * 100 : 0
  const poisonPreviewLeft = Math.max(0, Math.min(100, hpPercent - poisonPreviewPercent))
  const hpWidth = Math.max(0, Math.min(100, hpPercent))
  const shieldWidth = Math.max(6, Math.min(100, shieldPercent))
  const poisonLeft = Math.max(0, Math.min(100, poisonPreviewLeft))
  const poisonWidth = Math.max(3, Math.min(100, poisonPreviewPercent))
  const bonePath = 'M31 10 C33 5 38 2 43 4 C48 6 50 11 48 16 L192 16 C190 11 192 6 197 4 C202 2 207 5 209 10 C214 8 220 10 223 15 C226 20 224 26 219 29 C222 35 219 41 213 42 C207 43 203 39 202 34 L38 34 C37 39 33 43 27 42 C21 41 18 35 21 29 C16 26 14 20 17 15 C20 10 26 8 31 10 Z'

  return (
    <div className={joinClasses('hp', 'bone-health', side && `bone-health-${side}`, className)} {...props}>
      <span className="bone-health-title">{name}</span>
      {statusSlotTop}
      <div className="bone-health-bar hp-bar" aria-label={`${name} ${Math.max(0, Math.round(hp))}/${maxHp}`}>
        <svg className="bone-health-svg" viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={clipId}>
              <path d={bonePath} />
            </clipPath>
          </defs>
          <path className="bone-health-track" d={bonePath} />
          <rect className="bone-health-fill hp-current" x="0" y="0" width={`${hpWidth}%`} height="44" clipPath={`url(#${clipId})`} />
          {shieldValue > 0 && <rect className="bone-health-shield hp-shield" x="0" y="0" width={`${shieldWidth}%`} height="44" clipPath={`url(#${clipId})`} />}
          {poisonPreviewPercent > 0 && <rect className="bone-health-poison hp-preview poison" x={`${poisonLeft}%`} y="0" width={`${poisonWidth}%`} height="44" clipPath={`url(#${clipId})`} />}
          <path className="bone-health-outline" d={bonePath} />
        </svg>
      </div>
      {statusSlotBottom}
      <b>{Math.max(0, Math.round(hp))}/{maxHp}</b>
      {children}
    </div>
  )
}

const dotLayouts: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function DicePips({ roll }: { roll?: number }) {
  const dots = dotLayouts[roll ?? 0] ?? []
  return (
    <span className="dynamic-dice-pips" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i key={index} className={dots.includes(index) ? 'active' : ''} />)}
    </span>
  )
}

export type DynamicDiceProps = HTMLAttributes<HTMLDivElement> & {
  roll?: number
  actor?: 'player' | 'opponent' | 'system'
  rolling?: boolean
  label: string
}

export function DynamicDice({ roll, actor = 'system', rolling = false, label, className, ...props }: DynamicDiceProps) {
  const rollLabel = roll == null ? label : `${label}：${roll}点`
  return (
    <div
      className={joinClasses('battle-dice', 'handdrawn-dice', 'dynamic-dice', rolling && 'rolling', `dynamic-dice-${actor}`, className)}
      role="img"
      aria-label={rollLabel}
      {...props}
    >
      <div className="dynamic-dice-cube" aria-hidden="true">
        <span className="dynamic-dice-face front"><DicePips roll={roll} /></span>
        <span className="dynamic-dice-face top"><DicePips roll={roll ? ((roll % 6) + 1) : undefined} /></span>
        <span className="dynamic-dice-face side"><DicePips roll={roll ? (((roll + 2) % 6) + 1) : undefined} /></span>
      </div>
      <b className="dynamic-dice-value">{roll ?? '-'}</b>
    </div>
  )
}

export function StatusChip({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={joinClasses('status-chip', 'handdrawn-status-chip', className)} {...props}>
      {children}
    </button>
  )
}

export function FloatingPaperTip({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside className={joinClasses('floating-tip', 'paper-card', 'floating-paper-tip', className)} {...props}>
      {children}
    </aside>
  )
}
