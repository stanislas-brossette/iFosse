export const levelCategories = ['E3', 'E2', 'E1', 'N4', 'N3', 'PN3', 'PN2', 'PN1', 'Autres / non classés'] as const
export type LevelCategory = typeof levelCategories[number]
type Levels = { current_level: string; preparing_level: string | null }
export function levelCategory(person: Levels): LevelCategory {
  const current = person.current_level.trim().toUpperCase()
  const preparing = person.preparing_level?.trim().toUpperCase()
  if (current === 'MF1' || current === 'E3') return 'E3'
  if (current === 'E2' || current === 'E1' || current === 'N4' || current === 'N3') return current
  if (preparing === 'N3') return 'PN3'
  if (preparing === 'N2') return 'PN2'
  if (preparing === 'N1') return 'PN1'
  return 'Autres / non classés'
}
export function levelSummary(people: Levels[]) {
  const counts = Object.fromEntries(levelCategories.map(category => [category, 0])) as Record<LevelCategory, number>
  for (const person of people) counts[levelCategory(person)]++
  return counts
}
