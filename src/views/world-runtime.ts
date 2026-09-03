import type { AppContext, Navigate } from '../app/router.ts'
import { escapeHtml } from '../app/html.ts'

export async function renderWorldRuntime(root: HTMLElement, context: AppContext, navigate: Navigate, id: string): Promise<void> {
  const world = (await context.worlds.get(id)) ?? (await context.publicWorlds.get(id))
  if (!world) {
    navigate('/forge/worlds/')
    return
  }

  root.innerHTML = `
    <main class="world-runtime" data-world-id="${escapeHtml(world.id)}" aria-label="${escapeHtml(world.identity.name)}">
      <canvas class="world-runtime-particles" aria-hidden="true"></canvas>
      <div class="world-runtime-atmosphere" aria-hidden="true"></div>
      <div class="world-runtime-identity" aria-hidden="true">
        <span>${escapeHtml(world.identity.name)}</span>
      </div>
      <form class="world-runtime-prompt" autocomplete="off">
        <span class="world-runtime-prompt-mark">›</span>
        <textarea rows="1" aria-label="World prompt" placeholder="What do you do?  /exit to leave"></textarea>
        <button type="submit" aria-label="Send prompt">↵</button>
      </form>
    </main>
  `

  const runtime = root.querySelector<HTMLElement>('.world-runtime')!
  const canvas = root.querySelector<HTMLCanvasElement>('.world-runtime-particles')!
  const input = root.querySelector<HTMLTextAreaElement>('.world-runtime-prompt textarea')!
  const form = root.querySelector<HTMLFormElement>('.world-runtime-prompt')!
  const context2d = canvas.getContext('2d')
  let frame = 0
  let width = 0
  let height = 0
  let pointerX = -1000
  let pointerY = -1000

  const particles = Array.from({ length: 72 }, () => ({
    x: Math.random(),
    y: Math.random(),
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
      const distance = Math.sqrt(dx * dx + dy * dy)
      const glow = Math.max(0, 1 - distance / 180)

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

  runtime.addEventListener('pointermove', (event) => {
    pointerX = event.clientX
    pointerY = event.clientY
  })
  runtime.addEventListener('pointerleave', () => {
    pointerX = -1000
    pointerY = -1000
  })

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

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const value = input.value.trim()
    if (!value) return
    const command = value.toLowerCase()
    if (command === '/exit' || command === '/home' || command === '/leave') {
      exitWorld()
      return
    }
    input.value = ''
    input.style.height = 'auto'
  })

  window.addEventListener('resize', resize)
  resize()
  draw()
  input.focus()
}
