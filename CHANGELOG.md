# Changelog

All notable changes to the next-generation Howling Whispers platform are tracked here while development continues on `rebrand-v2`.

This file is intentionally user-facing. Keep implementation details in commit history and use this changelog for features, behavior changes, UX changes, migrations, and important fixes that may later be published as release notes.

## Unreleased

### Platform foundation
- Expanded the Landing codebase into the foundation for the next-generation RP platform.
- Made World Forge the root of the new creation flow.
- Established the new application hierarchy around Forge, Worlds, Characters, Personas, Archive, Settings, and the future Roleplay area.
- Kept the existing legacy RP arena outside the new feature roadmap while the replacement platform is built.

### Design and themes
- Adopted the newer copper and bronze visual identity inspired by the Analog design system.
- Added first-class Dark, Light, and System appearance modes.
- Added a warm ivory and cream light theme while preserving copper and bronze as the shared brand accent.
- Refined the Forge dashboard toward the approved cleaner dashboard layout with calmer spacing, lighter panel weight, compact navigation, recent-world cards, overview panels, and reduced visual noise.
- Preserved responsive desktop, tablet, and mobile behavior.

### World Forge
- Added world-first creation and editing.
- Added world identity, description, genre, tone, technology, society, world rules, and magic or physics fields.
- Added structured species, locations, factions, families, and family relationships.
- Added hierarchical locations with parent locations.
- Added family tree source data instead of storing family trees as static text.
- Added persistent World Memory records for events, discoveries, deaths, conflicts, and lasting world changes.
- Added memory visibility and references to affected locations, factions, families, and characters.
- Added world validation for duplicate IDs, invalid relationships, missing references, and invalid location nesting.

### Character and Persona foundation
- Returned to standard Character Card V2 as the canonical portable character format.
- Added Character Card V2 validation, JSON import, JSON export, alternate greetings, extensions, and Character Book support.
- Added world-bound Character Records around the portable V2 card.
- Added separate Persona records so player identity remains independent from characters.
- Added character observations and evolution proposal data structures.
- Added proposal states for pending, accepted, retained as memory, and rejected changes.
- Added an isolated legacy HWV2 conversion boundary rather than carrying HWV2 into the new core schema.

### Local data and privacy foundation
- Added repository abstractions for Worlds, Characters, and Personas.
- Added local browser persistence for early development.
- Established the architecture rule that future cloud sync may contain shared canon such as worlds, lore, characters, families, locations, timelines, and World Memory.
- Established that private RP chats, story transcripts, generated replies, branches, and private scene history remain local-only and are not part of cloud world storage.

### NovelAI ImageGen 5
- Added the first NovelAI ImageGen 5 integration foundation for Forge.
- Added free-first generation presets for Landscape, Portrait, and Square output.
- Added a 28-step, single-image default intended to remain within the known 0-Anlas eligible Opus generation path when the user's NovelAI account qualifies.
- Added generation-cost eligibility checks so Forge can distinguish free-friendly settings from settings that may consume Anlas.
- Added automatic World image prompt construction from world data.
- Added Character prompt-building foundation for future portrait generation.
- Added a provider abstraction so image generation is not permanently hard-wired to NovelAI.
- Added a server-side NovelAI image proxy so API requests do not need to be made directly from the browser.
- Added local generated-image persistence using IndexedDB rather than localStorage.
- Added the Forge Image Studio route with world selection, prompt editing, negative prompts, aspect selection, generation preview, and local image saving.
- Added tests for image-generation presets and prompt construction.

### Coda
- Coda integration is intentionally paused while the old Admin Coda identity and Discord dependency are recovered or replaced.
- The new platform does not depend on the old Discord server for its core architecture.
- Existing Coda integration boundaries may remain as future-facing interfaces, but no new Coda feature work is part of the current active phase.

## Changelog rule

From this point onward, every meaningful user-facing feature, behavior change, migration, design change, privacy/storage change, or important fix added to `rebrand-v2` should also update the `Unreleased` section of this file in the same development cycle.

Minor refactors, formatting-only changes, test-only maintenance, and internal implementation details do not need a public changelog entry unless they materially affect users.
