import type { WorldRecord } from '../domain/world.ts'
import { BITTERROOT_PUBLIC_WORLD_ID, PublicWorldRepository } from './public-worlds'
import { applyBitterrootHoltCanon } from './bitterroot-canon'

export class CanonicalPublicWorldRepository extends PublicWorldRepository {
  override async list(): Promise<WorldRecord[]> {
    return (await super.list()).map((world) => world.id === BITTERROOT_PUBLIC_WORLD_ID ? applyBitterrootHoltCanon(world) : world)
  }

  override async get(id: string): Promise<WorldRecord | undefined> {
    const world = await super.get(id)
    return world && world.id === BITTERROOT_PUBLIC_WORLD_ID ? applyBitterrootHoltCanon(world) : world
  }
}
