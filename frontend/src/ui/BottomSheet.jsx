import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { cn } from '../utils/cn.js'

const SPRING = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }
const FLICK_VELOCITY = 450 // px/s
const DRAG_THRESHOLD = 4 // px before a press counts as a drag
const RUBBER_BAND = 0.2

/**
 * Two-state (peek / expanded) draggable bottom sheet for mobile.
 *
 * Controlled: parent owns `snap`. Only the handle strip starts a drag, so
 * scrolling the sheet's content never fights the gesture. Dragging is
 * pointer-driven (not framer's drag constraints, which re-scale position
 * on window resize — e.g. when a mobile address bar collapses).
 *
 * Positioning (bottom offset, height) is left to `className`. Changing
 * `scrollKey` (e.g. the route) scrolls the content back to the top.
 * `peekScroll` lets the content scroll while peeked, clipped to the visible
 * peek area, so actions below the fold stay reachable without expanding.
 */
export function BottomSheet({ snap, onSnapChange, peekHeight, peekScroll = false, header, children, className, label = 'Panel', scrollKey }) {
  const sheetRef = useRef(null)
  const handleRef = useRef(null)
  const contentRef = useRef(null)
  const [height, setHeight] = useState(0)
  const [handleHeight, setHandleHeight] = useState(0)
  const y = useMotionValue(0)
  const drag = useRef(null)
  const suppressClick = useRef(false)
  // Imperative animate() isn't covered by <MotionConfig reducedMotion>, so
  // honour prefers-reduced-motion here explicitly: snap instead of spring.
  const reduceMotion = useReducedMotion()
  const moveTo = (target) => {
    if (reduceMotion) {
      y.set(target)
      return { stop() {} }
    }
    return animate(y, target, SPRING)
  }

  useLayoutEffect(() => {
    const el = sheetRef.current
    const handle = handleRef.current
    const measure = () => {
      setHeight(el.offsetHeight)
      setHandleHeight(handle.offsetHeight)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(handle)
    measure()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [scrollKey])

  const peekY = Math.max(0, height - peekHeight)
  const targetFor = (s) => (s === 'expanded' ? 0 : peekY)

  // Jump into place on first measure; animate on later snap/size changes.
  const placed = useRef(false)
  useEffect(() => {
    if (!height) return undefined
    if (!placed.current) {
      placed.current = true
      y.set(targetFor(snap))
      return undefined
    }
    const controls = moveTo(targetFor(snap))
    return () => controls.stop()
  }, [snap, peekY, height])

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    y.stop()
    drag.current = { startY: e.clientY, originY: y.get(), lastY: e.clientY, lastT: e.timeStamp, velocity: 0, moved: false }
  }

  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.startY
    if (Math.abs(dy) > DRAG_THRESHOLD) d.moved = true

    let next = d.originY + dy
    if (next < 0) next *= RUBBER_BAND
    else if (next > peekY) next = peekY + (next - peekY) * RUBBER_BAND
    y.set(next)

    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.velocity = ((e.clientY - d.lastY) / dt) * 1000
    d.lastY = e.clientY
    d.lastT = e.timeStamp
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    suppressClick.current = Boolean(d?.moved)
    if (!d?.moved) return

    let next
    if (d.velocity > FLICK_VELOCITY) next = 'peek'
    else if (d.velocity < -FLICK_VELOCITY) next = 'expanded'
    else next = y.get() < peekY / 2 ? 'expanded' : 'peek'

    moveTo(targetFor(next))
    if (next !== snap) onSnapChange(next)
  }

  function onHandleClick() {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onSnapChange(snap === 'expanded' ? 'peek' : 'expanded')
  }

  return (
    <motion.section
      ref={sheetRef}
      aria-label={label}
      style={{ y, visibility: height ? 'visible' : 'hidden' }}
      className={cn('flex flex-col rounded-t-sheet bg-surface shadow-sheet', className)}
    >
      <div
        ref={handleRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
      >
        <button
          type="button"
          onClick={onHandleClick}
          aria-expanded={snap === 'expanded'}
          aria-label={snap === 'expanded' ? `Collapse ${label}` : `Expand ${label}`}
          className="tap-transparent flex w-full justify-center pb-2 pt-3 max-md:pb-1.5 max-md:pt-2.5"
        >
          <span className="h-1 w-10 rounded-pill bg-line" />
        </button>
        {header}
      </div>
      <div
        ref={contentRef}
        className={cn('min-h-0 flex-1 overscroll-contain', snap === 'expanded' || peekScroll ? 'overflow-y-auto' : 'overflow-hidden')}
        style={peekScroll && snap !== 'expanded' ? { maxHeight: Math.max(0, peekHeight - handleHeight) } : undefined}
      >
        {children}
      </div>
    </motion.section>
  )
}
