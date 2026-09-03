import { useCallback } from 'react'

// Generates a tone using the Web Audio API — no audio files needed
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainValue = 0.3
) {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

    gainNode.gain.setValueAtTime(gainValue, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)

    oscillator.onended = () => ctx.close()
  } catch {
    // Audio not supported — silently skip
  }
}

function triggerHaptic(pattern: VibratePattern) {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // Haptics not supported — silently skip
  }
}

export function useFeedback() {
  const playSuccess = useCallback(() => {
    // Two ascending tones — a welcoming "ding ding"
    playTone(880, 0.12, 'sine', 0.25)
    setTimeout(() => playTone(1100, 0.2, 'sine', 0.2), 120)
    // Short double pulse
    triggerHaptic([60, 40, 60])
  }, [])

  const playAlreadyScanned = useCallback(() => {
    // Mid-range descending tone — attention without alarm
    playTone(600, 0.15, 'triangle', 0.3)
    setTimeout(() => playTone(450, 0.25, 'triangle', 0.25), 150)
    // Long single buzz
    triggerHaptic([200])
  }, [])

  const playError = useCallback(() => {
    // Low buzzy tone — clearly wrong
    playTone(220, 0.1, 'sawtooth', 0.2)
    setTimeout(() => playTone(180, 0.35, 'sawtooth', 0.15), 100)
    // Three short sharp pulses
    triggerHaptic([80, 60, 80, 60, 80])
  }, [])

  return { playSuccess, playAlreadyScanned, playError }
}
