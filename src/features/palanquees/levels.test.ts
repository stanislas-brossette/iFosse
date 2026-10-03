import { describe, expect, it } from 'vitest'
import { levelCategory, levelCategories, levelSummary } from './levels'
describe('informational qualification categories', () => {
  it('applies the frozen current-level precedence and preparation categories', () => {
    expect(levelCategory({ current_level: ' mf1 ', preparing_level: 'N3' })).toBe('E3')
    for (const level of ['E3', 'E2', 'E1', 'N4', 'N3'] as const) expect(levelCategory({ current_level: level, preparing_level: 'N3' })).toBe(level)
    for (const level of ['N3', 'N2', 'N1']) expect(levelCategory({ current_level: 'N1', preparing_level: level })).toBe(`P${level}`)
  })
  it('accounts for every participant including unfamiliar and missing levels', () => {
    const people = [{ current_level: 'MF1', preparing_level: null }, { current_level: 'N2', preparing_level: null }, { current_level: 'Autre fédération', preparing_level: null }, { current_level: '', preparing_level: null }]
    const counts = levelSummary(people)
    expect(counts.E3).toBe(1); expect(counts['Autres / non classés']).toBe(3)
    expect(levelCategories.reduce((sum, category) => sum + counts[category], 0)).toBe(people.length)
    expect(levelSummary([])['Autres / non classés']).toBe(0)
  })
})
