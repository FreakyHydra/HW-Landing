import '../styles/project-whispers.css'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

type AudioPack = { beep: (frequency?: number, duration?: number) => void; seek: (bursts?: number) => void; clunk: () => void }

type RpgState = {
  location: string
  minuteOfDay: number
  weather: string
  inventory: string[]
  visited: string[]
}

const SAVE_KEY = 'hw.project-whispers.demo-save.v1'

const locations: Record<string, { name: string; description: string; exits: string[] }> = {
  brackenjaw: {
    name: 'Brackenjaw',
    description: 'Low timber homes huddle around a rain-darkened square. Smoke curls from stone chimneys while the settlement slowly wakes.',
    exits: ['Pip\'s Cabin', 'Market', 'North Trail'],
  },
  "pip's cabin": {
    name: "Pip's Cabin",
    description: 'The cabin is warm and close, lit by a low hearth. Two simple beds sit against the wall while rain whispers against the roof.',
    exits: ['Brackenjaw'],
  },
  market: {
    name: 'Market',
    description: 'Canvas awnings sag under the rain. Traders uncover baskets, tools and wrapped goods as the first customers drift through.',
    exits: ['Brackenjaw', 'Old Mill'],
  },
  'north trail': {
    name: 'North Trail',
    description: 'A narrow trail climbs between wet pines. The settlement fades behind you beneath mist and dripping branches.',
    exits: ['Brackenjaw', 'Old Mill'],
  },
  'old mill': {
    name: 'Old Mill',
    description: 'The old mill leans beside a swollen creek. Its wheel is still, but water rattles through the broken race below.',
    exits: ['Market', 'North Trail'],
  },
}

function createAudio(): AudioPack {
  let context: AudioContext | null = null
  const getContext = () => {
    if (!context) context = new AudioContext()
    return context
  }
  const beep = (frequency = 740, duration = 0.08) => {
    try {
      const ctx = getContext()
      void ctx.resume()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.035, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start()
      oscillator.stop(ctx.currentTime + duration)
    } catch { /* Audio is optional in the demo. */ }
  }
  const clunk = () => {
    beep(110, 0.045)
    window.setTimeout(() => beep(75, 0.06), 45)
  }
  const seek = (bursts = 6) => {
    let i = 0
    const timer = window.setInterval(() => {
      beep(130 + ((i % 3) * 35), 0.025)
      i += 1
      if (i >= bursts) window.clearInterval(timer)
    }, 62)
  }
  return { beep, seek, clunk }
}

function looksLikeBrowserFullscreen(): boolean {
  if (document.fullscreenElement) return true
  const browserChromeHidden = Math.abs(window.outerHeight - window.innerHeight) <= 24
    && Math.abs(window.outerWidth - window.innerWidth) <= 24
  if (browserChromeHidden) return true
  const heightClose = Math.abs(window.innerHeight - screen.height) <= 96 || Math.abs(window.innerHeight - screen.availHeight) <= 96
  const widthClose = Math.abs(window.innerWidth - screen.width) <= 32 || Math.abs(window.innerWidth - screen.availWidth) <= 32
  return heightClose && widthClose
}

function formatTime(minuteOfDay: number): string {
  const normalized = ((minuteOfDay % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function normalizeLocation(value: string): string | undefined {
  const needle = value.trim().toLowerCase().replace(/^the\s+/, '')
  return Object.keys(locations).find((key) => key === needle || locations[key].name.toLowerCase() === needle)
}

function parseWaitMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = (match[2] || 'm').toLowerCase()
  return Math.min(unit.startsWith('h') ? amount * 60 : amount, 720)
}

export async function renderProjectWhispers(root: HTMLElement): Promise<void> {
  document.title = 'Project Whispers · The Howling Whispers'
  root.innerHTML = `
    <main class="project-whispers" aria-label="Project Whispers experimental simulation interface">
      <section class="pw-screen">
        <div class="pw-gate" data-pw-gate>
          <strong>PRESS F11 TO BEGIN</strong>
          <small>Experimental system interface</small>
        </div>
        <div class="pw-console" data-pw-console hidden>
          <div class="pw-log pw-cursor" data-pw-log aria-live="polite"></div>
          <div class="pw-disk-stage" data-pw-disk-stage></div>
        </div>
      </section>
    </main>
  `

  const gate = root.querySelector<HTMLElement>('[data-pw-gate]')!
  const consoleEl = root.querySelector<HTMLElement>('[data-pw-console]')!
  const log = root.querySelector<HTMLElement>('[data-pw-log]')!
  const diskStage = root.querySelector<HTMLElement>('[data-pw-disk-stage]')!
  const audio = createAudio()
  const initialViewport = { width: window.innerWidth, height: window.innerHeight }
  let started = false
  let phase: 'world' | 'persona' | 'ready' | 'running' = 'world'

  const append = async (line = '', delay = 130) => {
    log.textContent += `${line}\n`
    consoleEl.scrollTop = consoleEl.scrollHeight
    await wait(delay)
  }

  const showRuntimeDemo = () => {
    log.classList.remove('pw-cursor')
    log.textContent = ''
    const state: RpgState = {
      location: 'brackenjaw',
      minuteOfDay: 480,
      weather: 'Light rain',
      inventory: ['Wool coat', 'Flint', 'Small coin pouch'],
      visited: ['brackenjaw'],
    }

    diskStage.innerHTML = `
      <section class="pw-runtime" aria-label="Project Whispers text RPG prototype">
        <header class="pw-runtime-head">
          <div><strong>PROJECT WHISPERS</strong><span>TEXT SIMULATION ONLINE</span></div>
          <div class="pw-runtime-state" data-pw-runtime-state></div>
        </header>
        <div class="pw-runtime-grid">
          <aside class="pw-runtime-panel" data-pw-relationships>
            <strong>RELATIONSHIPS</strong>
            <span>PIP · FRIEND · 3 YEARS</span>
            <span>RAGNA · KNOWN</span>
          </aside>
          <section class="pw-runtime-story" data-pw-story aria-live="polite"></section>
          <aside class="pw-runtime-panel" data-pw-world-state></aside>
        </div>
        <div class="pw-runtime-hint">TYPE /HELP FOR COMMANDS · FREEFORM ROLEPLAY IS ALSO ACCEPTED</div>
        <form class="pw-runtime-prompt" data-pw-prompt autocomplete="off">
          <label for="pw-runtime-input">&gt;</label>
          <input id="pw-runtime-input" data-pw-input type="text" placeholder="What do you do?" aria-label="Simulation input" />
          <button type="submit">SEND</button>
        </form>
      </section>
    `

    const prompt = diskStage.querySelector<HTMLFormElement>('[data-pw-prompt]')!
    const input = diskStage.querySelector<HTMLInputElement>('[data-pw-input]')!
    const story = diskStage.querySelector<HTMLElement>('[data-pw-story]')!
    const worldState = diskStage.querySelector<HTMLElement>('[data-pw-world-state]')!
    const runtimeState = diskStage.querySelector<HTMLElement>('[data-pw-runtime-state]')!

    const addLine = (text: string, className = '') => {
      const paragraph = document.createElement('p')
      if (className) paragraph.className = className
      paragraph.textContent = text
      story.append(paragraph)
      story.scrollTop = story.scrollHeight
    }

    const renderState = () => {
      const location = locations[state.location]
      runtimeState.innerHTML = `<span>WORLD: BITTERROOT</span><span>{{user}}: SKYLER</span><span>${location.name.toUpperCase()} · ${formatTime(state.minuteOfDay)}</span>`
      worldState.innerHTML = `
        <strong>WORLD STATE</strong>
        <span>LOCATION · ${location.name.toUpperCase()}</span>
        <span>TIME · ${formatTime(state.minuteOfDay)}</span>
        <span>WEATHER · ${state.weather.toUpperCase()}</span>
        <span>EXITS · ${location.exits.join(' / ').toUpperCase()}</span>
      `
    }

    const describeLocation = () => {
      const location = locations[state.location]
      addLine(location.description)
      addLine(`Exits: ${location.exits.join(', ')}.`, 'pw-muted-line')
    }

    const executeCommand = (raw: string): boolean => {
      const normalized = raw.trim().replace(/^\//, '')
      const [commandRaw, ...restParts] = normalized.split(/\s+/)
      const command = commandRaw.toLowerCase()
      const rest = restParts.join(' ').trim()

      if (command === 'help') {
        addLine('COMMANDS: /look · /who · /status · /time · /weather · /relationships · /inventory · /go <place> · /wait <time> · /talk <name> · /save · /load · /clear', 'pw-system-line')
        addLine('You can also type normal roleplay prose instead of commands.', 'pw-muted-line')
        return true
      }
      if (command === 'look') {
        describeLocation()
        return true
      }
      if (command === 'who') {
        addLine(state.location === "pip's cabin" ? 'Present: Pip, Ragna, {{user}}.' : 'Nearby: townsfolk move through Brackenjaw. Pip and Ragna are known contacts.', 'pw-system-line')
        return true
      }
      if (command === 'status') {
        addLine(`Skyler · Pip's Friend · ${locations[state.location].name} · ${formatTime(state.minuteOfDay)} · ${state.weather}.`, 'pw-system-line')
        return true
      }
      if (command === 'time') {
        addLine(`World time: ${formatTime(state.minuteOfDay)}.`, 'pw-system-line')
        return true
      }
      if (command === 'weather') {
        addLine(`Weather: ${state.weather}. Rain beads on timber and packed earth.`, 'pw-system-line')
        return true
      }
      if (command === 'relationships') {
        addLine("Pip: Friend, 3 years. Ragna: Known. These are authored facts and do not get improvised away.", 'pw-system-line')
        return true
      }
      if (command === 'inventory' || command === 'inv') {
        addLine(`Inventory: ${state.inventory.join(', ')}.`, 'pw-system-line')
        return true
      }
      if (command === 'go') {
        if (!rest) {
          addLine(`Go where? Exits: ${locations[state.location].exits.join(', ')}.`, 'pw-system-line')
          return true
        }
        const destination = normalizeLocation(rest)
        if (!destination) {
          addLine(`Unknown destination: ${rest}.`, 'pw-error-line')
          return true
        }
        const allowed = locations[state.location].exits.map((item) => normalizeLocation(item)).includes(destination)
        if (!allowed) {
          addLine(`${locations[destination].name} is not directly reachable from here.`, 'pw-error-line')
          return true
        }
        state.location = destination
        state.minuteOfDay += 6
        if (!state.visited.includes(destination)) state.visited.push(destination)
        renderState()
        audio.seek(2)
        addLine(`You travel to ${locations[destination].name}.`, 'pw-player-line')
        describeLocation()
        return true
      }
      if (command === 'wait') {
        const minutes = parseWaitMinutes(rest)
        if (minutes === null) {
          addLine('Usage: /wait 10m or /wait 1h', 'pw-error-line')
          return true
        }
        state.minuteOfDay += minutes
        renderState()
        addLine(`You wait ${minutes} minute${minutes === 1 ? '' : 's'}. World time is now ${formatTime(state.minuteOfDay)}.`, 'pw-system-line')
        return true
      }
      if (command === 'talk') {
        const target = rest.toLowerCase()
        if (!target) {
          addLine('Talk to whom?', 'pw-error-line')
        } else if (target.includes('pip')) {
          addLine('Pip glances over, ears tipping toward you. "Yeah? What\'s up?"')
        } else if (target.includes('ragna')) {
          addLine('Ragna looks up from what she is doing. "Need something, Skyler?"')
        } else {
          addLine(`No one named ${rest} is close enough to answer.`, 'pw-error-line')
        }
        return true
      }
      if (command === 'save') {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state))
        addLine('SIMULATION STATE WRITTEN TO SAVE MEDIA.', 'pw-system-line')
        audio.clunk()
        return true
      }
      if (command === 'load') {
        try {
          const rawSave = localStorage.getItem(SAVE_KEY)
          if (!rawSave) {
            addLine('NO SAVE MEDIA FOUND.', 'pw-error-line')
            return true
          }
          const loaded = JSON.parse(rawSave) as Partial<RpgState>
          if (typeof loaded.location === 'string' && locations[loaded.location]) state.location = loaded.location
          if (typeof loaded.minuteOfDay === 'number') state.minuteOfDay = loaded.minuteOfDay
          if (typeof loaded.weather === 'string') state.weather = loaded.weather
          if (Array.isArray(loaded.inventory)) state.inventory = loaded.inventory.filter((item): item is string => typeof item === 'string')
          if (Array.isArray(loaded.visited)) state.visited = loaded.visited.filter((item): item is string => typeof item === 'string')
          renderState()
          addLine('SAVE MEDIA MOUNTED. SIMULATION STATE RESTORED.', 'pw-system-line')
          describeLocation()
          audio.seek(3)
        } catch {
          addLine('SAVE MEDIA COULD NOT BE READ.', 'pw-error-line')
        }
        return true
      }
      if (command === 'clear') {
        story.innerHTML = ''
        return true
      }
      return false
    }

    const freeformReply = (value: string) => {
      const lower = value.toLowerCase()
      state.minuteOfDay += Math.max(1, Math.min(4, Math.ceil(value.split(/\s+/).length / 18)))
      renderState()
      if (lower.includes('pip')) {
        addLine('Pip turns toward you immediately, familiar rather than wary. Her tail gives a small flick as she waits to see what you mean.')
      } else if (lower.includes('ragna')) {
        addLine('Ragna notices the movement and gives you a brief, knowing glance before returning her attention to the room.')
      } else if (lower.includes('door') || lower.includes('outside') || lower.includes('leave')) {
        addLine('Cold damp air slips in from outside. Brackenjaw is awake now, wet roofs shining under the gray morning.')
      } else if (lower.includes('look') || lower.includes('around')) {
        describeLocation()
      } else {
        addLine('The world accepts the action and continues from the established scene without changing who you are or what your relationships already are.')
      }
    }

    prompt.addEventListener('submit', (event) => {
      event.preventDefault()
      const value = input.value.trim()
      if (!value) return
      const player = document.createElement('p')
      player.className = 'pw-player-line'
      player.textContent = `> ${value}`
      story.append(player)
      input.value = ''
      audio.beep(980, 0.035)

      const looksLikeCommand = value.startsWith('/') || /^(help|look|who|status|time|weather|relationships|inventory|inv|go|wait|talk|save|load|clear)(\s|$)/i.test(value)
      window.setTimeout(() => {
        if (looksLikeCommand) {
          if (!executeCommand(value)) addLine('Unknown command. Type /help.', 'pw-error-line')
        } else {
          freeformReply(value)
        }
      }, 180)
      story.scrollTop = story.scrollHeight
    })

    renderState()
    addLine('SYSTEM: Bitterroot simulation mounted successfully.', 'pw-system-line')
    describeLocation()
    addLine('Pip is your established friend of three years. Ragna already knows you.', 'pw-muted-line')
    input.focus()
  }

  const showDisk = (kind: 'world' | 'persona') => {
    const world = kind === 'world'
    diskStage.innerHTML = `
      <button type="button" class="pw-disk" data-pw-disk>
        <div class="pw-disk-label">
          <strong>${world ? 'WORLD DISK' : 'PERSONA DISK'}</strong>
          <span>${world ? 'BITTERROOT' : "SKYLER · PIP'S FRIEND"}</span>
        </div>
        <div>CLICK TO INSERT</div>
        <div class="pw-disk-slot" aria-hidden="true"></div>
      </button>
    `
    diskStage.querySelector<HTMLButtonElement>('[data-pw-disk]')?.focus()
  }

  const runSimulation = async () => {
    if (phase !== 'ready') return
    phase = 'running'
    diskStage.innerHTML = ''
    audio.beep(1280, 0.08)
    await append('')
    await append('> !run sim', 180)
    await append('LOCKING WORLD STATE...', 180)
    await append('STARTING SIMULATION...', 320)
    audio.seek(4)
    await wait(420)
    consoleEl.classList.add('pw-handoff')
    await wait(180)
    log.textContent = ''
    diskStage.innerHTML = ''
    consoleEl.scrollTop = 0
    consoleEl.classList.remove('pw-handoff')
    await append('PROJECT WHISPERS ONLINE', 180)
    await append('', 120)
    await append('WORLD: BITTERROOT', 100)
    await append("PERSONA: SKYLER · PIP'S FRIEND", 100)
    await append('LOCATION: BRACKENJAW', 100)
    await append('', 120)
    await append('SIMULATION ACTIVE_', 650)
    await wait(650)
    showRuntimeDemo()
  }

  const boot = async () => {
    if (started) return
    started = true
    gate.hidden = true
    consoleEl.hidden = false
    consoleEl.classList.add('pw-running')
    audio.beep(880, 0.07)
    await wait(420)
    await append('HOWLING WHISPERS WORLD SIMULATION SYSTEM', 180)
    await append('HW BIOS 0.9 EXPERIMENTAL', 260)
    await append('')
    await append('MEMORY TEST ............ 65536K OK', 170)
    audio.beep(940, 0.05)
    await append('WORLD BUS .............. READY', 160)
    await append('PERSONA INTERFACE ...... READY', 160)
    await append('TEMPORAL ENGINE ........ READY', 160)
    await append('RELATIONSHIP CORE ...... READY', 200)
    await append('')
    await append('NO WORLD MEDIA PRESENT', 180)
    await append('INSERT WORLD DISK', 100)
    showDisk('world')
  }

  const mountWorld = async () => {
    if (phase !== 'world') return
    phase = 'persona'
    diskStage.innerHTML = ''
    audio.clunk()
    await append('')
    await append('WORLD DISK DETECTED: BITTERROOT.WLD', 180)
    audio.seek(8)
    await append('READING SECTOR 01...', 150)
    await append('READING SECTOR 02...', 150)
    audio.seek(5)
    await append('INDEXING LOCATIONS...', 180)
    await append('INDEXING CHARACTERS...', 180)
    await append('VERIFYING AUTHORED CANON...', 220)
    audio.beep(1040, 0.06)
    await append('WORLD MOUNTED: BITTERROOT', 220)
    await append('')
    await append('INSERT PERSONA DISK', 100)
    showDisk('persona')
  }

  const mountPersona = async () => {
    if (phase !== 'persona') return
    phase = 'ready'
    diskStage.innerHTML = ''
    audio.clunk()
    await append('')
    await append('PERSONA DISK DETECTED: SKYLER.PER', 180)
    audio.seek(7)
    await append('READING PERSONA RECORD...', 170)
    await append('RESOLVING WORLD ROLE...', 170)
    await append('LINKING RELATIONSHIPS...', 190)
    audio.beep(1120, 0.06)
    await append('')
    await append('PERSONA MOUNTED', 120)
    await append('{{user}} = SKYLER', 110)
    await append("WORLD ROLE = PIP'S FRIEND", 110)
    await append('PIP ........ FRIEND · 3 YEARS', 110)
    await append('RAGNA ...... KNOWN', 110)
    await append('BRACKENJAW . RESIDENT', 160)
    await append('')
    await append('CURRENT LOCATION: BRACKENJAW', 110)
    await append('TIME ENGINE: 08:00 · DAY 14 · AUTUMN', 110)
    await append('WEATHER ENGINE: LIGHT RAIN', 180)
    await append('')
    await append('SIMULATION STATE READY', 350)
    diskStage.innerHTML = `<div class="pw-ready"><div class="pw-command">&gt; <span>!run sim</span></div></div>`
    await wait(700)
    await runSimulation()
  }

  const detectFullscreenTransition = () => {
    if (started) return
    const nativeFullscreenResize = window.innerHeight >= initialViewport.height + 40 && window.innerWidth >= initialViewport.width - 8
    if (document.fullscreenElement || looksLikeBrowserFullscreen() || nativeFullscreenResize) void boot()
  }

  window.addEventListener('resize', detectFullscreenTransition)
  document.addEventListener('fullscreenchange', detectFullscreenTransition)

  if (looksLikeBrowserFullscreen()) window.setTimeout(() => { void boot() }, 80)
  else window.setTimeout(detectFullscreenTransition, 250)

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-pw-disk]')) {
      if (phase === 'world') void mountWorld()
      else if (phase === 'persona') void mountPersona()
    }
  })
}
