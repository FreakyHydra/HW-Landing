import { createEmptyCharacterCardV2, type CharacterCardV2 } from '../domain/character-card-v2.ts'

export type LegacyConversionResult = {
  card: CharacterCardV2
  warnings: string[]
  unclassified: Record<string, unknown>
}

// Intentionally isolated. Runtime, memory and relationship fields are never copied into the portable card.
export function legacyHwV2ToCharacterV2(input: Record<string, unknown>): LegacyConversionResult {
  const card = createEmptyCharacterCardV2()
  const source = (typeof input.character === 'object' && input.character !== null ? input.character : input) as Record<string, unknown>
  const mapping: Array<[keyof CharacterCardV2['data'], string]> = [
    ['name', 'name'], ['description', 'description'], ['personality', 'personality'], ['scenario', 'scenario'],
    ['first_mes', 'firstMessage'], ['mes_example', 'exampleDialogue'], ['creator_notes', 'creatorNotes'],
  ]
  for (const [target, legacy] of mapping) {
    if (typeof source[legacy] === 'string') (card.data[target] as string) = source[legacy] as string
  }
  const used = new Set(mapping.map(([, legacy]) => legacy))
  const unclassified = Object.fromEntries(Object.entries(source).filter(([key]) => !used.has(key)))
  return {
    card,
    warnings: Object.keys(unclassified).length ? ['Legacy-only fields were left unclassified and were not added to the V2 card.'] : [],
    unclassified,
  }
}
