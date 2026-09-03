import '../styles/world-runtime.css'
import type { AppContext, Navigate } from '../app/router.ts'
import { escapeHtml } from '../app/html.ts'
import { cleanWorldRuntimeReply, WorldRuntimeNovelAiProvider, WORLD_RUNTIME_NAI_MODELS, type WorldRuntimeNovelAiModel } from '../runtime/novelai.ts'
import { clearNovelAiToken, getNovelAiRuntimeSettings, saveNovelAiRuntimeSettings } from '../runtime/novelai-settings.ts'
import { LocalRelationshipRepository, DEFAULT_PERSONA_ID, evaluateRelationshipTurn } from '../runtime/relationship-v2.ts'
import { compileWorldRuntimePrompt, LocalWorldRuntimeSessionRepository, resolveRuntimeInhabitants, type WorldRuntimeMessage } from '../runtime/world-brain.ts'

export async function renderWorldRuntime(root: HTMLElement, context: AppContext, navigate: Navigate, id: string): Promise<void> {
  const world = (await context.worlds.get(id)) ?? (await context.publicWorlds.get(id))
  if (!world) {
    navigate('/forge/worlds/')
    return
  }

  const [characters, personas] = await Promise.all([context.characters.list(), context.personas.list()])
  const sessionRepository = new LocalWorldRuntimeSessionRepository()
  const relationshipRepository = new LocalRelationshipRepository()
  const provider = new WorldRuntimeNovelAiProvider()
  const freshSession = new URLSearchParams(location.search).get('new') === '1'
  const session = freshSession
    ? sessionRepository.reset(world)
    : sessionRepository.get(world.id) ?? sessionRepository.create(world)
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
      <section class="world-runtime-story" aria-live="polite" aria-label="World narrative"></section>
      <form class="world-runtime-prompt" autocomplete="off">
        <span class="world-runtime-prompt-mark">›</span>
        <textarea rows="1" aria-label="World prompt" placeholder="What do you do?  /exit to leave"></textarea>
        <button type="submit" aria-label="Send prompt">↵</button>
      </form>
    </main>
  `

  const runtime = root.querySelector<HTMLElement>('.world-runtime')!
  const story = root.querySelector<HTMLElement>('.world-runtime-story')!
  const canvas = root.querySelector<HTMLCanvasElement>('.world-runtime-particles')!
  const input = root.querySelector<HTMLTextAreaElement>('.world-runtime-prompt textarea')!
  const form = root.querySelector<HTMLFormElement>('.world-runtime-prompt')!
  const submit = root.querySelector<HTMLButtonElement>('.world-runtime-prompt button')!
  const context2d = canvas.getContext('2d')
  let frame = 0
  let width = 0
  let height = 0
  let pointerX = -1000
  let pointerY = -1000
  let busy = false

  const appendMessage = (message: WorldRuntimeMessage, persist = true) => {
    const article = document.createElement('article')
    article.className = `world-runtime-message ${message.sender}`
    article.textContent = message.text
    story.append(article)
    story.scrollTop = story.scrollHeight
    if (persist) {
      session.history.push(message)
      session.updatedAt = message.createdAt
      sessionRepository.save(session)
    }
  }

  const appendSystem = (text: string) => appendMessage({ id: crypto.randomUUID(), sender: 'system', text, createdAt: new Date().toISOString() }, false)
  session.history.forEach((message) => appendMessage(message, false))
  if (freshSession) appendSystem('New world session started. World canon and relationship state were kept.')

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

  const handleCommand = (value: string): boolean => {
    const command = value.trim()
    const lower = command.toLowerCase()
    if (lower === '/exit' || lower === '/home' || lower === '/leave') { exitWorld(); return true }
    if (lower === '/new') {
      sessionRepository.reset(world)
      navigate(`/roleplay/world/${encodeURIComponent(world.id)}/`)
      return true
    }
    if (lower === '/clear') {
      session.history = []
      session.updatedAt = new Date().toISOString()
      sessionRepository.save(session)
      story.replaceChildren()
      appendSystem('Current world conversation cleared. World canon and relationships were not reset.')
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
      appendSystem('/exit · /new · /clear · /where · /who · NovelAI configuration is available in Settings')
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
    if (handleCommand(value)) return

    busy = true
    submit.disabled = true
    input.disabled = true
    const turnId = crypto.randomUUID()
    const playerMessage: WorldRuntimeMessage = { id: turnId, sender: 'player', text: value, createdAt: new Date().toISOString() }
    appendMessage(playerMessage)

    try {
      const personaId = persona?.id || DEFAULT_PERSONA_ID
      const relationshipMap = Object.fromEntries(inhabitants.map((inhabitant) => [inhabitant.id, relationshipRepository.get(inhabitant.id, personaId)]))
      const prompt = compileWorldRuntimePrompt({ world, session, playerTurn: value, inhabitants, persona, relationships: relationshipMap })
      const nai = getNovelAiRuntimeSettings()
      const reply = await provider.generate({
        prompt,
        model: nai.model,
        maxTokens: nai.maxTokens,
        temperature: nai.temperature,
        characterNames: inhabitantNames,
      }, nai.token)
      const worldMessage: WorldRuntimeMessage = { id: crypto.randomUUID(), sender: 'world', text: reply, createdAt: new Date().toISOString() }
      appendMessage(worldMessage)

      const combined = `${value}\n${reply}`.toLowerCase()
      for (const inhabitant of inhabitants) {
        if (!combined.includes(inhabitant.name.toLowerCase())) continue
        const previous = relationshipRepository.get(inhabitant.id, personaId)
        relationshipRepository.apply(evaluateRelationshipTurn({
          characterId: inhabitant.id,
          personaId,
          previousScore: previous?.score ?? 0,
          playerMessage: value,
          characterReply: reply,
          turnId,
        }))
      }
    } catch (error) {
      appendSystem(error instanceof Error ? error.message : 'The world runtime could not generate a reply.')
    } finally {
      busy = false
      submit.disabled = false
      input.disabled = false
      input.focus()
    }
  })

  window.addEventListener('resize', resize)
  resize()
  draw()
  input.focus()
}
