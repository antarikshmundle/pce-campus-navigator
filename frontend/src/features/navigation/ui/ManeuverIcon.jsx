import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  GitMerge,
  Navigation,
  Redo2,
  RotateCcw,
  RotateCw,
  Undo2,
} from 'lucide-react'

// Google maneuver codes (normalized) → Lucide glyphs.
const ICONS = {
  DEPART: Navigation,
  STRAIGHT: ArrowUp,
  NAME_CHANGE: ArrowUp,
  TURN_LEFT: CornerUpLeft,
  TURN_RIGHT: CornerUpRight,
  TURN_SHARP_LEFT: CornerUpLeft,
  TURN_SHARP_RIGHT: CornerUpRight,
  TURN_SLIGHT_LEFT: ArrowUpLeft,
  TURN_SLIGHT_RIGHT: ArrowUpRight,
  FORK_LEFT: ArrowUpLeft,
  FORK_RIGHT: ArrowUpRight,
  RAMP_LEFT: ArrowUpLeft,
  RAMP_RIGHT: ArrowUpRight,
  UTURN_LEFT: Undo2,
  UTURN_RIGHT: Redo2,
  MERGE: GitMerge,
  ROUNDABOUT_LEFT: RotateCcw,
  ROUNDABOUT_RIGHT: RotateCw,
  ARRIVE: Flag,
}

export function ManeuverIcon({ maneuver, size = 20, strokeWidth = 2.25, className }) {
  const Icon = ICONS[maneuver] ?? ArrowUp
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />
}
