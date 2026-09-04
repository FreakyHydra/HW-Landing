import '../styles/project-whispers.css'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createAudio(): { beep: (frequency?: number, duration?: number) => void; seek: (bursts?: number) => void; clunk: () => void } {
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
  const heightTolerance = 96
  const widthTolerance = 32
  const heightClose = Math.abs(window.innerHeight - screen.height) <= heightTolerance
    || Math.abs(window.innerHeight - screen.availHeight) <= heightTolerance
  const widthClose = Math.abs(window.innerWidth - screen.width) <= widthTolerance
    || Math.abs(window.innerWidth - screen.availWidth) <= widthTolerance
  return heightClose && widthClose
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
    await append('SIMULATION ACTIVE_', 120)
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
    const nativeFullscreenResize = window.innerHeight >= initialViewport.height + 40
      && window.innerWidth >= initialViewport.width - 8
    if (document.fullscreenElement || looksLikeBrowserFullscreen() || nativeFullscreenResize) void boot()
  }

  window.addEventListener('resize', detectFullscreenTransition)
  document.addEventListener('fullscreenchange', detectFullscreenTransition)
  window.setTimeout(detectFullscreenTransition, 250)

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-pw-disk]')) {
      if (phase === 'world') void mountWorld()
      else if (phase === 'persona') void mountPersona()
    }
  })
}
