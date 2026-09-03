import { normalizeWorldRecord, type WorldRecord } from '../domain/world.ts'

function pushUniqueById<T extends { id: string }>(target: T[], items: T[]): void {
  const ids = new Set(target.map((item) => item.id))
  for (const item of items) if (!ids.has(item.id)) target.push(item)
}

export function applyBitterrootHoltCanon(source: WorldRecord): WorldRecord {
  const world = normalizeWorldRecord(source)

  pushUniqueById(world.species, [
    {
      id: 'werewolf-upright-feral',
      name: 'Werewolf',
      description: 'Intelligent speaking werewolves of Bitterroot. Ragna Holt and Pip Holt are upright feral werewolves.',
    },
  ])

  pushUniqueById(world.locations, [
    {
      id: 'splitpine-reach',
      name: 'Splitpine Reach',
      kind: 'subregion',
      parentLocationId: 'howling-hills',
      description: 'Cold upland country within the Howling Hills. Brackenjaw Enclave lies here, and Boundary Wardens patrol its trails and marked borders.',
    },
    {
      id: 'brackenjaw-enclave',
      name: 'Brackenjaw Enclave',
      kind: 'settlement',
      parentLocationId: 'splitpine-reach',
      description: 'A pre-industrial settlement in Splitpine Reach. Ragna Holt and Pip Holt live here among the Brackenjaw community.',
    },
    {
      id: 'brackenjaw-ranger-station',
      name: 'Brackenjaw Ranger Station',
      kind: 'building',
      parentLocationId: 'brackenjaw-enclave',
      description: 'The ranger station used by Brackenjaw Boundary Wardens. Ragna works from here, and Pip has grown up around patrol maps, gear, chores, and ranger routines.',
    },
    {
      id: 'brackenjaw-eastern-boundary',
      name: 'Brackenjaw Eastern Boundary',
      kind: 'territory',
      parentLocationId: 'splitpine-reach',
      description: 'The eastern boundary of Brackenjaw territory, watched and patrolled by Boundary Wardens including Ragna Holt.',
    },
    {
      id: 'warning-stones',
      name: 'Warning Stones',
      kind: 'landmark',
      parentLocationId: 'brackenjaw-eastern-boundary',
      description: 'Marked boundary stones used to warn travelers before they cross deeper into Brackenjaw territory.',
    },
  ])

  pushUniqueById(world.factions, [
    {
      id: 'boundary-wardens',
      name: 'Boundary Wardens',
      description: 'Brackenjaw rangers responsible for patrol work, boundary defense, trail security, threat assessment, and keeping Splitpine Reach defensible. Their work values preparedness, practical judgment, clear warnings, and decisive action when a credible threat appears.',
    },
  ])

  pushUniqueById(world.families, [
    {
      id: 'holt-family',
      name: 'Holt',
      description: 'The Holt family of Brackenjaw Enclave. Ragna Holt is Pip Holt\'s mother. They are their own Bitterroot family and are not Whiteclaws.',
      people: [
        {
          id: 'ragna-holt-person',
          name: 'Ragna Holt',
          characterId: 'ragna-holt',
          description: '41-year-old upright feral werewolf, veteran Boundary Warden, and mother of Pip Holt. Ragna is hard, terse, territorial, proactive, observant, highly competent, and protective through action rather than speeches. She judges outsiders by what they do after being warned, checks facts instead of dismissing credible danger, and remains the adult authority when Pip is involved.',
        },
        {
          id: 'pip-holt-person',
          name: 'Pip Holt',
          characterId: 'pip-holt',
          description: '12-year-old upright feral werewolf and Ragna Holt\'s daughter. Pip is a scrappy, brave, stubborn, observant, eager, tomboyish would-be Boundary Warden. She copies Ragna\'s stance and ranger phrases, knows familiar trails, markers, chores and gear surprisingly well, but remains twelve in judgment, authority, knowledge and emotional regulation. Her confidence often outruns what she can safely handle.',
        },
      ],
      relationships: [
        {
          id: 'ragna-pip-parent',
          fromPersonId: 'ragna-holt-person',
          toPersonId: 'pip-holt-person',
          kind: 'parent',
          notes: 'Mother and daughter with very high trust and affection. Pip admires Ragna intensely and copies her ranger mannerisms while pushing against restrictions. Ragna loves Pip fiercely but shows care through rules, chores, limits, instruction, protection, and intervention rather than becoming generically soft.',
        },
      ],
    },
  ])

  pushUniqueById(world.societies, [
    {
      id: 'brackenjaw-enclave-society',
      name: 'Brackenjaw Enclave',
      type: 'village_community',
      parentSocietyId: 'howling-hills-peoples',
      description: 'The Brackenjaw community of Splitpine Reach. Brackenjaw is a community identity, not a species; Ragna and Pip Holt are werewolves who belong to this enclave.',
      origin: 'An established local community in Splitpine Reach.',
      territoryLocationIds: ['splitpine-reach', 'brackenjaw-eastern-boundary', 'warning-stones'],
      territoryNotes: 'The enclave maintains and watches marked boundaries in Splitpine Reach.',
      seasonalMovement: 'Settled community with patrol activity across surrounding trails and boundaries.',
      lifestyle: 'settled',
      speciesIds: ['werewolf-upright-feral'],
      kinshipBasis: 'Families, households, community ties, duty, and local belonging.',
      membershipRules: 'Membership is based on belonging to the Brackenjaw community rather than species alone.',
      leadershipStructure: 'Local enclave authority supported by specialist roles such as Boundary Wardens.',
      decisionMaking: 'Local community authority and practical duty structures.',
      customs: 'Boundary markers, patrol routines, local chores, preparedness, and practical responsibility are established parts of daily life around the ranger station.',
      beliefs: 'Not yet fixed as a single shared belief system.',
      languageDialect: 'Local Brackenjaw speech and ranger terminology.',
      livelihood: 'Pre-industrial settlement work, ranger duties, craft, food production, hunting, trade, and maintenance of local trails and boundaries.',
      allySocietyIds: [],
      rivalSocietyIds: [],
      familyIds: ['holt-family'],
      factionIds: ['boundary-wardens'],
      settlementLocationIds: ['brackenjaw-enclave'],
      currentStatus: 'Active settlement in Splitpine Reach.',
      canonStatus: 'canon',
    },
  ])

  world.updatedAt = new Date().toISOString()
  return world
}
