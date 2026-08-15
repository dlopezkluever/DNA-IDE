import { describe, it, expect, beforeEach } from 'vitest'
import { useScenarioStore } from './scenarioStore'

beforeEach(() => {
  useScenarioStore.setState({ progress: {}, activeScenarioId: null })
})

describe('scenarioStore', () => {
  it('startScenario sets activeScenarioId; exitScenario clears it', () => {
    useScenarioStore.getState().startScenario('silence-the-glow')
    expect(useScenarioStore.getState().activeScenarioId).toBe('silence-the-glow')
    useScenarioStore.getState().exitScenario()
    expect(useScenarioStore.getState().activeScenarioId).toBeNull()
  })

  it('recordAttempt creates a fresh progress entry with attempts=1', () => {
    useScenarioStore.getState().recordAttempt('silence-the-glow', 2)
    expect(useScenarioStore.getState().progress['silence-the-glow']).toEqual({
      bestStars: 2,
      attempts: 1,
    })
  })

  it('recordAttempt increments attempts on every call, win or lose', () => {
    useScenarioStore.getState().recordAttempt('silence-the-glow', 0)
    useScenarioStore.getState().recordAttempt('silence-the-glow', 0)
    useScenarioStore.getState().recordAttempt('silence-the-glow', 1)
    expect(useScenarioStore.getState().progress['silence-the-glow'].attempts).toBe(3)
  })

  it('recordAttempt takes the max — a worse retry never lowers bestStars', () => {
    useScenarioStore.getState().recordAttempt('silence-the-glow', 3)
    useScenarioStore.getState().recordAttempt('silence-the-glow', 1)
    expect(useScenarioStore.getState().progress['silence-the-glow'].bestStars).toBe(3)
  })

  it('recordAttempt raises bestStars when a later retry does better', () => {
    useScenarioStore.getState().recordAttempt('silence-the-glow', 1)
    useScenarioStore.getState().recordAttempt('silence-the-glow', 3)
    expect(useScenarioStore.getState().progress['silence-the-glow'].bestStars).toBe(3)
  })

  it('tracks progress per scenario id independently', () => {
    useScenarioStore.getState().recordAttempt('silence-the-glow', 3)
    useScenarioStore.getState().recordAttempt('break-the-lock', 1)
    const { progress } = useScenarioStore.getState()
    expect(progress['silence-the-glow'].bestStars).toBe(3)
    expect(progress['break-the-lock'].bestStars).toBe(1)
  })
})
