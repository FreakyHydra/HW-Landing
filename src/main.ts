import './style.css'

type Session = {
  authenticated: boolean
  user?: { username: string; avatarUrl?: string }
  access?: string[]
}

const projects = [
  { title: 'The Howling Whispers', tag: 'STABLE', desc: 'The main roleplay world and character platform.', href: 'https://rp.thehowlingwhispers.com', access: 'stable' },
  { title: 'Howling Whispers Analog', tag: 'CLOSED ALPHA', desc: 'A browser sound laboratory for waves, loops and samples.', href: '#', access: 'alpha' },
  { title: 'Bitterroot', tag: 'CLOSED ALPHA', desc: 'A living world project built around consequence, survival and story.', href: '#', access: 'alpha' },
  { title: 'Howling Whispers Desktop', tag: 'EARLY ACCESS', desc: 'The standalone desktop branch of the Howling Whispers ecosystem.', href: '#', access: 'ea' },
]

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <canvas id="field" aria-hidden="true"></canvas>
  <div class="cursor-aura" aria-hidden="true"></div>

  <main class="gate" id="gate">
    <section class="sigil-wrap" aria-labelledby="gate-title">
      <div class="orbit orbit-a"></div>
      <div class="orbit orbit-b"></div>
      <button class="sigil" id="sigil" type="button" aria-label="Prove your worth with Discord">
        <img src="/hw-logo.png" alt="The Howling Whispers wolf and moon emblem" />
      </button>
      <div class="gate-copy">
        <p class="eyebrow">THE GATE IS WATCHING</p>
        <h1 id="gate-title">Prove Yourself Worthy</h1>
        <p>The Howling Whispers open only for those the gate recognizes.</p>
        <a class="discord-button" id="discord-signin" href="/auth/discord">PROVE YOUR WORTH</a>
        <span class="gate-note">Discord is used only to identify your access seal.</span>
      </div>
    </section>
  </main>

  <section class="world" id="world" aria-hidden="true">
    <header class="world-header">
      <div>
        <p class="eyebrow">THE HOWLING WHISPERS</p>
        <h2>The Worlds Beyond the Gate</h2>
      </div>
      <div class="identity" id="identity"></div>
    </header>
    <div class="world-intro">
      <p>Stable worlds stand in the open. Early paths reveal themselves only to the seals that belong there.</p>
    </div>
    <div class="projects" id="projects"></div>
  </section>
`

const canvas = document.querySelector<HTMLCanvasElement>('#field')!
const ctx = canvas.getContext('2d')!
const aura = document.querySelector<HTMLElement>('.cursor-aura')!
const gate = document.querySelector<HTMLElement>('#gate')!
const world = document.querySelector<HTMLElement>('#world')!
const sigil = document.querySelector<HTMLButtonElement>('#sigil')!
const identity = document.querySelector<HTMLElement>('#identity')!
const projectGrid = document.querySelector<HTMLElement>('#projects')!

let width = 0
let height = 0
let dpr = 1
let mouseX = -1000
let mouseY = -1000
let lastMouseX = mouseX
let lastMouseY = mouseY
let ripples: { x: number; y: number; r: number; a: number }[] = []
let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

const particles = Array.from({ length: reducedMotion ? 45 : 110 }, () => ({
  x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .00008, vy: (Math.random() - .5) * .00008,
  size: .5 + Math.random() * 1.6, alpha: .12 + Math.random() * .48,
}))

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2)
  width = innerWidth
  height = innerHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function animateField() {
  ctx.clearRect(0, 0, width, height)
  const speed = Math.hypot(mouseX - lastMouseX, mouseY - lastMouseY)
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > 1) p.vx *= -1
    if (p.y < 0 || p.y > 1) p.vy *= -1
    const x = p.x * width
    const y = p.y * height
    const dx = x - mouseX
    const dy = y - mouseY
    const dist = Math.max(20, Math.hypot(dx, dy))
    const repel = Math.max(0, 115 - dist) / 115
    const ox = repel * (dx / dist) * Math.min(speed, 12) * 1.5
    const oy = repel * (dy / dist) * Math.min(speed, 12) * 1.5
    ctx.beginPath()
    ctx.fillStyle = `rgba(196, 133, 79, ${p.alpha})`
    ctx.arc(x + ox, y + oy, p.size, 0, Math.PI * 2)
    ctx.fill()
  }

  ripples = ripples.filter(r => r.a > .015 && r.r < 260)
  for (const r of ripples) {
    r.r += 2.8
    r.a *= .975
    ctx.beginPath()
    ctx.strokeStyle = `rgba(207, 151, 97, ${r.a})`
    ctx.lineWidth = 1
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
    ctx.stroke()
  }
  lastMouseX = mouseX
  lastMouseY = mouseY
  requestAnimationFrame(animateField)
}

function addRipple(x: number, y: number, strength = .18) {
  if (!reducedMotion) ripples.push({ x, y, r: 4, a: strength })
}

addEventListener('resize', resize)
addEventListener('pointermove', e => {
  mouseX = e.clientX
  mouseY = e.clientY
  aura.style.setProperty('--x', `${e.clientX}px`)
  aura.style.setProperty('--y', `${e.clientY}px`)
  if (Math.hypot(mouseX - lastMouseX, mouseY - lastMouseY) > 24 && Math.random() > .7) addRipple(mouseX, mouseY, .05)
  const rect = sigil.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width - .5) * 2
  const py = ((e.clientY - rect.top) / rect.height - .5) * 2
  sigil.style.setProperty('--rx', `${-py * 3}deg`)
  sigil.style.setProperty('--ry', `${px * 3}deg`)
  sigil.style.setProperty('--hx', `${Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100))}%`)
  sigil.style.setProperty('--hy', `${Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100))}%`)
})
addEventListener('pointerdown', e => addRipple(e.clientX, e.clientY, .26))

function renderProjects(session: Session) {
  const access = new Set(session.access || ['stable'])
  projectGrid.innerHTML = projects.map((p, index) => {
    const unlocked = p.access === 'stable' || access.has(p.access) || access.has('all')
    return `
      <article class="project ${unlocked ? '' : 'locked'}" style="--i:${index}">
        <div class="project-index">0${index + 1}</div>
        <div class="project-body">
          <span class="status">${p.tag}</span>
          <h3>${p.title}</h3>
          <p>${p.desc}</p>
        </div>
        ${unlocked
          ? `<a href="${p.href}" class="project-action">ENTER <span>↗</span></a>`
          : `<div class="project-action locked-text">SEAL REQUIRED</div>`}
      </article>`
  }).join('')
}

function revealWorld(session: Session) {
  if (session.user) {
    identity.innerHTML = `<span>WORTH PROVEN</span><strong>${session.user.username}</strong><a href="/auth/logout">LEAVE</a>`
  }
  renderProjects(session)
  gate.classList.add('gate-burst')
  setTimeout(() => {
    gate.hidden = true
    world.classList.add('world-visible')
    world.setAttribute('aria-hidden', 'false')
    window.scrollTo({ top: 0 })
  }, reducedMotion ? 80 : 850)
}

async function loadSession() {
  try {
    const res = await fetch('/api/session', { credentials: 'include' })
    if (!res.ok) return
    const session = await res.json() as Session
    if (session.authenticated) {
      setTimeout(() => revealWorld(session), reducedMotion ? 100 : 1200)
    }
  } catch {
    // Frontend remains usable as the locked gate while auth server is unavailable.
  }
}

resize()
animateField()
loadSession()
