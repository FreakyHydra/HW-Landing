import '../styles/world-runtime.css'
import type { AppContext, Navigate } from '../app/router.ts'
import { escapeHtml } from '../app/html.ts'
import { cleanWorldRuntimeReply, WorldRuntimeNovelAiProvider, WORLD_RUNTIME_NAI_MODELS, type WorldRuntimeNovelAiModel } from '../runtime/novelai.ts'
import { clearNovelAiToken, getNovelAiRuntimeSettings, saveNovelAiRuntimeSettings } from '../runtime/novelai-settings.ts'
import { LocalRelationshipRepository, DEFAULT_PERSONA_ID, evaluateRelationshipTurn, relationshipTier, type RelationshipRecord } from '../runtime/relationship-v2.ts'
import { getRoleplayTextColors } from '../runtime/roleplay-visual-settings.ts'
import { compileWorldRuntimePrompt, LocalWorldRuntimeSessionRepository, resolveRuntimeInhabitants, type RuntimeInhabitant, type WorldRuntimeMessage, type WorldRuntimeSession } from '../runtime/world-brain.ts'
import { cleanImpersonatedPlayerTurn, compileWorldImpersonationPrompt, removeRelationshipTurn } from '../runtime/world-turn-tools.ts'

function directlyAddressedInhabitants(value: string, inhabitants: RuntimeInhabitant[]): RuntimeInhabitant[] {
  const lower = value.toLowerCase()
  const firstNameCounts = new Map<string, number>()
  for (const inhabitant of inhabitants) {
    const first = inhabitant.name.trim().split(/\s+/)[0]?.toLowerCase()
    if (first) firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1)
  }
  return inhabitants.filter((inhabitant) => {
    const full = inhabitant.name.toLowerCase()
    if (new RegExp(`\\b${full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) return true
    const first = inhabitant.name.trim().split(/\s+/)[0]?.toLowerCase()
    if (!first || firstNameCounts.get(first) !== 1) return false
    return new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)
  })
}

function appendColoredText(target: HTMLElement, text: string): void {
  const colors = getRoleplayTextColors()
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|“[^”\n]+”|"[^"\n]+")/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      const narration = document.createElement('span')
      narration.className = 'world-runtime-narration'
      narration.style.color = colors.narration
      narration.textContent = text.slice(cursor, index)
      target.append(narration)
    }
    const token = match[0]
    const span = document.createElement('span')
    if (token.startsWith('**')) {
      span.className = 'world-runtime-dialogue'
      span.style.color = colors.dialogue
      span.textContent = token.slice(2, -2)
    } else if (token.startsWith('*')) {
      span.className = 'world-runtime-action'
      span.style.color = colors.action
      span.textContent = token.slice(1, -1)
    } else {
      span.className = 'world-runtime-dialogue'
      span.style.color = colors.dialogue
      span.textContent = token
    }
    target.append(span)
    cursor = index + token.length
  }
  if (cursor < text.length) {
    const narration = document.createElement('span')
    narration.className = 'world-runtime-narration'
    narration.style.color = colors.narration
    narration.textContent = text.slice(cursor)
    target.append(narration)
  }
}

function relationshipMetric(record: RelationshipRecord | undefined, key: 'trust' | 'respect'): number {
  return Math.max(0, Math.min(100, (record?.dimensions[key] ?? 0) + 50))
}

function relationshipTension(record: RelationshipRecord | undefined): number {
  const dimensions = record?.dimensions
  if (!dimensions) return 0
  return Math.max(0, Math.min(100, Math.max(dimensions.fear, dimensions.suspicion, dimensions.resentment)))
}

export async function renderWorldRuntime(root: HTMLElement, context: AppContext, navigate: Navigate, id: string): Promise<void> {
  const world = (await context.worlds.get(id)) ?? (await context.publicWorlds.get(id))
  if (!world) {
    navigate('/forge/worlds/')
    return
  }
  const activeWorld = world

  const [characters, personas] = await Promise.all([context.characters.list(), context.personas.list()])
  const sessionRepository = new LocalWorldRuntimeSessionRepository()
  const relationshipRepository = new LocalRelationshipRepository()
  const provider = new WorldRuntimeNovelAiProvider()
  const freshSession = new URLSearchParams(location.search).get('new') === '1'
  const session = freshSession ? sessionRepository.reset(world) : sessionRepository.get(world.id) ?? sessionRepository.create(world)
  const persona = session.personaId ? personas.find((item) => item.id === session.personaId) : personas[0]
  if (!session.personaId && persona) {
    session.personaId = persona.id
    sessionRepository.save(session)
  }
  const inhabitants = resolveRuntimeInhabitants(world, characters, session.currentLocationId)
  const inhabitantNames = inhabitants.map((inhabitant) => inhabitant.name)

  let historyChanged = false
  session.history = session.history.map((message) => {
    if (message.sender !== 'world') return message
    const cleaned = cleanWorldRuntimeReply(message.text, inhabitantNames)
    if (cleaned !== message.text) historyChanged = true
    return { ...message, text: cleaned || message.text }
  })
  if (historyChanged) sessionRepository.save(session)

  root.innerHTML = `
    <main class="world-runtime" data-world-id="${escapeHtml(world.id)}" aria-label="${escapeHtml(world.identity.name)}">
      <canvas class="world-runtime-particles" aria-hidden="true"></canvas>
      <div class="world-runtime-atmosphere" aria-hidden="true"></div>
      <div class="world-runtime-identity" aria-hidden="true"><span>${escapeHtml(world.identity.name)}</span></div>
      <aside class="world-runtime-rs" aria-label="Relationship status"></aside>
      <section class="world-runtime-story" aria-live="polite" aria-label="World narrative"></section>
      <form class="world-runtime-prompt" autocomplete="off">
        <span class="world-runtime-prompt-mark">›</span>
        <textarea rows="1" aria-label="World prompt" placeholder="What do you do?  /exit to leave"></textarea>
        <button type="button" class="world-runtime-impersonate" aria-label="Impersonate player" title="Impersonate">IMP</button>
        <button type="submit" aria-label="Send prompt">↵</button>
      </form>
    </main>
  `

  const runtime = root.querySelector<HTMLElement>('.world-runtime')!
  const story = root.querySelector<HTMLElement>('.world-runtime-story')!
  const rsPanel = root.querySelector<HTMLElement>('.world-runtime-rs')!
  const canvas = root.querySelector<HTMLCanvasElement>('.world-runtime-particles')!
  const input = root.querySelector<HTMLTextAreaElement>('.world-runtime-prompt textarea')!
  const form = root.querySelector<HTMLFormElement>('.world-runtime-prompt')!
  const submit = root.querySelector<HTMLButtonElement>('.world-runtime-prompt button[type="submit"]')!
  const impersonateButton = root.querySelector<HTMLButtonElement>('.world-runtime-impersonate')!
  const context2d = canvas.getContext('2d')
  let frame = 0
  let width = 0
  let height = 0
  let pointerX = -1000
  let pointerY = -1000
  let busy = false

  function setBusy(value: boolean): void {
    busy = value
    submit.disabled = value
    impersonateButton.disabled = value
    input.disabled = value
  }

  function renderRelationshipVisuals(): void {
    const personaId = persona?.id || DEFAULT_PERSONA_ID
    const visible = inhabitants.slice(0, 3)
    if (!visible.length) {
      rsPanel.hidden = true
      return
    }
    rsPanel.hidden = false
    rsPanel.innerHTML = `<header><span>RELATIONSHIPS</span><small>RS</small></header>${visible.map((inhabitant) => {
      const record = relationshipRepository.get(inhabitant.id, personaId)
      const trust = relationshipMetric(record, 'trust')
      const respect = relationshipMetric(record, 'respect')
      const tension = relationshipTension(record)
      return `<section class="world-runtime-rs-character"><div class="world-runtime-rs-name"><strong>${escapeHtml(inhabitant.name)}</strong><span>${escapeHtml(relationshipTier(record?.score ?? 0))}</span></div><div class="world-runtime-rs-row"><span>Trust</span><i><b style="width:${trust}%"></b></i><em>${Math.round(trust)}</em></div><div class="world-runtime-rs-row"><span>Tension</span><i><b style="width:${tension}%"></b></i><em>${Math.round(tension)}</em></div><div class="world-runtime-rs-row"><span>Respect</span><i><b style="width:${respect}%"></b></i><em>${Math.round(respect)}</em></div></section>`
    }).join('')}`
  }

  function messageElement(message: WorldRuntimeMessage): HTMLElement {
    const article = document.createElement('article')
    article.className = `world-runtime-message ${message.sender}`
    article.dataset.messageId = message.id
    const body = document.createElement('div')
    body.className = 'world-runtime-message-body'
    if (message.sender === 'world') appendColoredText(body, message.text)
    else body.textContent = message.text
    article.append(body)
    if (message.sender === 'player' || message.sender === 'world') {
      const actions = document.createElement('div')
      actions.className = 'world-runtime-message-actions'
      const reroll = document.createElement('button')
      reroll.type = 'button'
      reroll.dataset.rerollMessage = message.id
      reroll.textContent = '↻'
      reroll.title = message.sender === 'player' ? 'Reroll player turn' : 'Reroll world response'
      reroll.setAttribute('aria-label', reroll.title)
      actions.append(reroll)
      article.append(actions)
    }
    return article
  }

  function renderStory(): void {
    story.replaceChildren(...session.history.map(messageElement))
    story.scrollTop = story.scrollHeight
  }

  const appendMessage = (message: WorldRuntimeMessage, persist = true) => {
    story.append(messageElement(message))
    story.scrollTop = story.scrollHeight
    if (persist) {
      session.history.push(message)
      session.updatedAt = message.createdAt
      sessionRepository.save(session)
    }
  }

  const appendSystem = (text: string) => appendMessage({ id: crypto.randomUUID(), sender: 'system', text, createdAt: new Date().toISOString() }, false)
  renderStory()
  renderRelationshipVisuals()
  if (freshSession) appendSystem('New world session started. World canon and relationship state were kept.')

  function turnInhabitantsFor(value: string): RuntimeInhabitant[] {
    const addressed = directlyAddressedInhabitants(value, inhabitants)
    if (!addressed.length) return inhabitants
    const addressedIds = new Set(addressed.map((inhabitant) => inhabitant.id))
    return [...addressed, ...inhabitants.filter((inhabitant) => !addressedIds.has(inhabitant.id))]
  }

  function saveSessionHistory(history: WorldRuntimeMessage[]): void {
    session.history = history
    session.updatedAt = new Date().toISOString()
    sessionRepository.save(session)
    renderStory()
  }

  async function generateWorldReply(playerMessage: WorldRuntimeMessage): Promise<void> {
    const personaId = persona?.id || DEFAULT_PERSONA_ID
    const turnInhabitants = turnInhabitantsFor(playerMessage.text)
    const relationshipMap = Object.fromEntries(turnInhabitants.map((inhabitant) => [inhabitant.id, relationshipRepository.get(inhabitant.id, personaId)]))
    const prompt = compileWorldRuntimePrompt({ world: activeWorld, session, playerTurn: playerMessage.text, inhabitants: turnInhabitants, persona, relationships: relationshipMap })
    const nai = getNovelAiRuntimeSettings()
    const reply = await provider.generate({
      prompt,
      model: nai.model,
      maxTokens: nai.maxTokens,
      temperature: nai.temperature,
      characterNames: inhabitantNames,
    }, nai.token)
    appendMessage({ id: crypto.randomUUID(), sender: 'world', text: reply, createdAt: new Date().toISOString() })

    const combined = `${playerMessage.text}\n${reply}`.toLowerCase()
    for (const inhabitant of turnInhabitants) {
      const first = inhabitant.name.split(/\s+/)[0].toLowerCase()
      if (!combined.includes(inhabitant.name.toLowerCase()) && !playerMessage.text.toLowerCase().includes(first)) continue
      const previous = relationshipRepository.get(inhabitant.id, personaId)
      relationshipRepository.apply(evaluateRelationshipTurn({
        characterId: inhabitant.id,
        personaId,
        previousScore: previous?.score ?? 0,
        playerMessage: playerMessage.text,
        characterReply: reply,
        turnId: playerMessage.id,
      }))
    }
    renderRelationshipVisuals()
  }

  async function impersonate(direction = '', baseSession: WorldRuntimeSession = session): Promise<string> {
    const nai = getNovelAiRuntimeSettings()
    const personaId = persona?.id || DEFAULT_PERSONA_ID
    const relationships = Object.fromEntries(inhabitants.map((inhabitant) => [inhabitant.id, relationshipRepository.get(inhabitant.id, personaId)]))
    const prompt = compileWorldImpersonationPrompt({ world: activeWorld, session: baseSession, persona, inhabitants, relationships, direction })
    const raw = await provider.generateRaw({
      prompt,
      model: nai.model,
      maxTokens: Math.min(nai.maxTokens, 320),
      temperature: Math.max(nai.temperature, 0.82),
      characterNames: inhabitantNames,
    }, nai.token)
    const draft = cleanImpersonatedPlayerTurn(raw, inhabitantNames)
    if (!draft) throw new Error('NovelAI returned no usable impersonated player turn.')
    return draft
  }

  async function rerollWorldMessage(messageId: string): Promise<void> {
    const worldIndex = session.history.findIndex((message) => message.id === messageId && message.sender === 'world')
    if (worldIndex < 0) return
    let playerIndex = worldIndex - 1
    while (playerIndex >= 0 && session.history[playerIndex].sender !== 'player') playerIndex -= 1
    if (playerIndex < 0) return appendSystem('No player turn exists before that response.')
    const playerMessage = session.history[playerIndex]
    removeRelationshipTurn(playerMessage.id)
    saveSessionHistory(session.history.slice(0, worldIndex))
    renderRelationshipVisuals()
    setBusy(true)
    try { await generateWorldReply(playerMessage) }
    catch (error) { appendSystem(error instanceof Error ? error.message : 'Could not reroll the world response.') }
    finally { setBusy(false); input.focus() }
  }

  async function rerollPlayerMessage(messageId: string): Promise<void> {
    const playerIndex = session.history.findIndex((message) => message.id === messageId && message.sender === 'player')
    if (playerIndex < 0) return
    const original = session.history[playerIndex]
    const baseHistory = session.history.slice(0, playerIndex)
    const baseSession: WorldRuntimeSession = { ...session, history: baseHistory }
    removeRelationshipTurn(original.id)
    renderRelationshipVisuals()
    setBusy(true)
    try {
      const replacement = await impersonate(`Write a fresh alternative to the previous player turn without copying its wording. Preserve the same broad situation and player persona. Previous turn: ${original.text}`, baseSession)
      const nextPlayer: WorldRuntimeMessage = { ...original, text: replacement, createdAt: new Date().toISOString() }
      saveSessionHistory([...baseHistory, nextPlayer])
      await generateWorldReply(nextPlayer)
    } catch (error) {
      appendSystem(error instanceof Error ? error.message : 'Could not reroll the player turn.')
    } finally {
      setBusy(false)
      input.focus()
    }
  }

  async function rerollLatestWorld(): Promise<void> {
    const latest = [...session.history].reverse().find((message) => message.sender === 'world')
    if (!latest) return appendSystem('There is no world response to reroll yet.')
    await rerollWorldMessage(latest.id)
  }

  async function rerollLatestPlayer(): Promise<void> {
    const latest = [...session.history].reverse().find((message) => message.sender === 'player')
    if (!latest) return appendSystem('There is no player turn to reroll yet.')
    await rerollPlayerMessage(latest.id)
  }

  const particles = Array.from({ length: 72 }, () => ({
    x: Math.random(), y: Math.random(),
    driftX: (Math.random() - 0.5) * 0.00008,
    driftY: (Math.random() - 0.5) * 0.00006,
    size: 0.6 + Math.random() * 1.6,
    alpha: 0.12 + Math.random() * 0.32,
  }))

  function resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context2d?.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  function draw(): void {
    if (!context2d || !runtime.isConnected) return
    context2d.clearRect(0, 0, width, height)
    for (const particle of particles) {
      particle.x = (particle.x + particle.driftX + 1) % 1
      particle.y = (particle.y + particle.driftY + 1) % 1
      const x = particle.x * width
      const y = particle.y * height
      const dx = x - pointerX
      const dy = y - pointerY
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 180)
      context2d.beginPath()
      context2d.arc(x, y, particle.size + glow * 1.8, 0, Math.PI * 2)
      context2d.fillStyle = `rgba(218, 146, 86, ${particle.alpha + glow * 0.42})`
      context2d.fill()
      if (glow > 0.16) {
        context2d.beginPath()
        context2d.moveTo(pointerX, pointerY)
        context2d.lineTo(x, y)
        context2d.strokeStyle = `rgba(218, 146, 86, ${glow * 0.08})`
        context2d.lineWidth = 0.7
        context2d.stroke()
      }
    }
    frame = requestAnimationFrame(draw)
  }

  function exitWorld(): void {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
    navigate('/')
  }

  runtime.addEventListener('pointermove', (event) => { pointerX = event.clientX; pointerY = event.clientY })
  runtime.addEventListener('pointerleave', () => { pointerX = -1000; pointerY = -1000 })
  input.addEventListener('input', () => {
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      form.requestSubmit()
    }
  })

  story.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-reroll-message]')
    if (!button || busy) return
    const message = session.history.find((item) => item.id === button.dataset.rerollMessage)
    if (!message) return
    if (message.sender === 'world') void rerollWorldMessage(message.id)
    if (message.sender === 'player') void rerollPlayerMessage(message.id)
  })

  impersonateButton.addEventListener('click', async () => {
    if (busy) return
    setBusy(true)
    try {
      input.value = await impersonate(input.value.trim())
      input.style.height = 'auto'
      input.style.height = `${Math.min(input.scrollHeight, 180)}px`
    } catch (error) {
      appendSystem(error instanceof Error ? error.message : 'Could not impersonate the player.')
    } finally {
      setBusy(false)
      input.focus()
    }
  })

  const handleCommand = async (value: string): Promise<boolean> => {
    const command = value.trim()
    const lower = command.toLowerCase()
    if (lower === '/exit' || lower === '/home' || lower === '/leave') { exitWorld(); return true }
    if (lower === '/new') {
      sessionRepository.reset(world)
      navigate(`/roleplay/world/${encodeURIComponent(world.id)}/`)
      return true
    }
    if (lower === '/clear') {
      saveSessionHistory([])
      appendSystem('Current world conversation cleared. World canon and relationships were not reset.')
      return true
    }
    if (lower === '/reroll') { await rerollLatestWorld(); return true }
    if (lower === '/reroll me' || lower === '/reroll player') { await rerollLatestPlayer(); return true }
    if (lower === '/impersonate' || lower.startsWith('/impersonate ')) {
      const direction = command.slice('/impersonate'.length).trim()
      setBusy(true)
      try { input.value = await impersonate(direction) }
      catch (error) { appendSystem(error instanceof Error ? error.message : 'Could not impersonate the player.') }
      finally { setBusy(false); input.focus() }
      return true
    }
    if (lower === '/where') {
      const location = world.locations.find((item) => item.id === session.currentLocationId)
      appendSystem(location ? `${location.name} · ${location.kind}` : 'Your exact location is not established.')
      return true
    }
    if (lower === '/who') {
      appendSystem(inhabitants.length ? `Nearby or locally relevant: ${inhabitants.map((item) => item.name).join(', ')}` : 'No named inhabitant is currently resolved nearby.')
      return true
    }
    if (lower === '/nai clear') {
      clearNovelAiToken()
      appendSystem('NovelAI token removed from this device.')
      return true
    }
    if (lower.startsWith('/nai token ')) {
      const token = command.slice('/nai token '.length).trim()
      if (!token) appendSystem('Usage: /nai token YOUR_PERSISTENT_TOKEN')
      else {
        const settings = getNovelAiRuntimeSettings()
        saveNovelAiRuntimeSettings({ ...settings, token })
        appendSystem('NovelAI token saved on this device.')
      }
      return true
    }
    if (lower.startsWith('/nai model ')) {
      const model = lower.slice('/nai model '.length).trim()
      if (WORLD_RUNTIME_NAI_MODELS.includes(model as WorldRuntimeNovelAiModel)) {
        const settings = getNovelAiRuntimeSettings()
        saveNovelAiRuntimeSettings({ ...settings, model: model as WorldRuntimeNovelAiModel })
        appendSystem(`NovelAI model saved on this device: ${model}`)
      } else appendSystem(`Available models: ${WORLD_RUNTIME_NAI_MODELS.join(', ')}`)
      return true
    }
    if (lower === '/help') {
      appendSystem('/exit · /new · /clear · /reroll · /reroll me · /impersonate [direction] · /where · /who · NovelAI configuration is available in Settings')
      return true
    }
    return false
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const value = input.value.trim()
    if (!value || busy) return
    input.value = ''
    input.style.height = 'auto'
    if (await handleCommand(value)) return

    const playerMessage: WorldRuntimeMessage = { id: crypto.randomUUID(), sender: 'player', text: value, createdAt: new Date().toISOString() }
    appendMessage(playerMessage)
    setBusy(true)
    try { await generateWorldReply(playerMessage) }
    catch (error) { appendSystem(error instanceof Error ? error.message : 'The world runtime could not generate a reply.') }
    finally { setBusy(false); input.focus() }
  })

  window.addEventListener('resize', resize)
  resize()
  draw()
  input.focus()
}
