import { useEffect, useRef } from 'react'
import { navConfig } from '../navConfig.js'

function spokenDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} kilometres`
  const rounded = meters < 100 ? Math.max(10, Math.round(meters / 10) * 10) : Math.round(meters / 50) * 50
  return `${rounded} metres`
}

const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s)
const sentence = (s) => (/[.!?]$/.test(s) ? s : `${s}.`)

/**
 * Speaks guidance only at meaningful moments — never on every GPS update:
 * navigation start, a new current step, the next maneuver getting close,
 * going off route, and arrival.
 */
export function useNavigationAnnouncements(session, destinationName, say) {
  const { phase, route, progress, upcoming, offRoute, currentStep } = session
  const spoken = useRef({ started: false, route: null, stepIndex: null, nearIndex: null, offRoute: false, arrived: false })

  useEffect(() => {
    const s = spoken.current
    if (phase === 'arrived') {
      if (!s.arrived) {
        s.arrived = true
        say(`You've arrived at ${destinationName}.`)
      }
      return
    }
    if (phase !== 'navigating' || !progress || !upcoming) return

    if (offRoute) {
      if (!s.offRoute) {
        s.offRoute = true
        say("You're off route.")
      }
      return
    }
    s.offRoute = false

    const ahead = `In ${spokenDistance(upcoming.distanceMeters)}, ${lowerFirst(upcoming.instruction)}.`
    const near = upcoming.distanceMeters <= navConfig.maneuverPromptMeters

    if (!s.started) {
      s.started = true
      s.route = route
      s.stepIndex = progress.stepIndex
      s.nearIndex = near ? upcoming.index : null
      const first = currentStep ? `${sentence(currentStep.instruction)} ` : ''
      say(`Starting route to ${destinationName}. ${first}${near ? sentence(upcoming.instruction) : ahead}`)
      return
    }

    // A new step (or a new route after rerouting): announce what comes next.
    if (route !== s.route || progress.stepIndex !== s.stepIndex) {
      s.route = route
      s.stepIndex = progress.stepIndex
      s.nearIndex = near ? upcoming.index : null
      say(near ? sentence(upcoming.instruction) : ahead)
      return
    }

    // The maneuver is now close: say it once more, plainly.
    if (near && s.nearIndex !== upcoming.index) {
      s.nearIndex = upcoming.index
      say(upcoming.kind === 'arrive' ? `${destinationName} is just ahead.` : sentence(upcoming.instruction))
    }
  }, [phase, route, progress, upcoming, offRoute, currentStep, destinationName, say])
}
