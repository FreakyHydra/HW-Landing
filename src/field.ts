export type FieldController = {
  resize: () => void
  addRipple: (x: number, y: number, strength?: number, speed?: number) => void
}

type Ripple = { x: number; y: number; r: number; a: number; speed: number }
type Wake = { x: number; y: number; vx: number; vy: number; life: number; size: number }

export function createField(canvas: HTMLCanvasElement, shatterCanvas: HTMLCanvasElement, aura: HTMLElement, sigil: HTMLElement, reducedMotion: boolean): FieldController {
  const ctx = canvas.getContext('2d')!
  let width = 0
  let height = 0
  let dpr = 1
  let mouseX = -1000
  let mouseY = -1000
  let lastPointerX = mouseX
  let lastPointerY = mouseY
  let animationFrame = 0
  let ripples: Ripple[] = []
  let wakes: Wake[] = []

  const particles = Array.from({ length: reducedMotion ? 48 : 130 }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00007,
    vy: (Math.random() - 0.5) * 0.00007,
    size: 0.45 + Math.random() * 1.5,
    alpha: 0.1 + Math.random() * 0.42,
    phase: Math.random() * Math.PI * 2,
  }))

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2)
    width = innerWidth
    height = innerHeight
    for (const target of [canvas, shatterCanvas]) {
      target.width = Math.round(width * dpr)
      target.height = Math.round(height * dpr)
      target.style.width = `${width}px`
      target.style.height = `${height}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    shatterCanvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function addRipple(x: number, y: number, strength = 0.16, speed = 2.4) {
    if (reducedMotion) return
    if (ripples.length > 24) ripples.shift()
    ripples.push({ x, y, r: 3, a: strength, speed })
  }

  function addWake(x: number, y: number, velocityX: number, velocityY: number) {
    if (reducedMotion) return
    if (wakes.length > 70) wakes.splice(0, 10)
    wakes.push({
      x, y,
      vx: velocityX * 0.06 + (Math.random() - 0.5) * 0.35,
      vy: velocityY * 0.06 + (Math.random() - 0.5) * 0.35,
      life: 1,
      size: 0.8 + Math.random() * 1.6,
    })
  }

  function animate(time = 0) {
    ctx.clearRect(0, 0, width, height)
    const velocityX = mouseX - lastPointerX
    const velocityY = mouseY - lastPointerY
    const speed = Math.hypot(velocityX, velocityY)

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0 || p.x > 1) p.vx *= -1
      if (p.y < 0 || p.y > 1) p.vy *= -1
      const x = p.x * width
      const y = p.y * height
      const dx = x - mouseX
      const dy = y - mouseY
      const dist = Math.max(18, Math.hypot(dx, dy))
      const influence = Math.max(0, 150 - dist) / 150
      const ox = influence * (dx / dist) * Math.min(speed, 18) * 1.9
      const oy = influence * (dy / dist) * Math.min(speed, 18) * 1.9
      const twinkle = 0.72 + Math.sin(time * 0.0013 + p.phase) * 0.28
      ctx.beginPath()
      ctx.fillStyle = `rgba(205, 145, 92, ${p.alpha * twinkle})`
      ctx.arc(x + ox, y + oy, p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    ripples = ripples.filter((r) => r.a > 0.012 && r.r < 320)
    for (const r of ripples) {
      r.r += r.speed
      r.a *= 0.972
      ctx.beginPath()
      ctx.strokeStyle = `rgba(214, 158, 105, ${r.a})`
      ctx.lineWidth = 1
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    wakes = wakes.filter((w) => w.life > 0.02)
    for (const w of wakes) {
      w.x += w.vx
      w.y += w.vy
      w.vx *= 0.985
      w.vy *= 0.985
      w.life *= 0.955
      ctx.beginPath()
      ctx.fillStyle = `rgba(230, 175, 122, ${w.life * 0.26})`
      ctx.arc(w.x, w.y, w.size, 0, Math.PI * 2)
      ctx.fill()
    }

    lastPointerX = mouseX
    lastPointerY = mouseY
    animationFrame = requestAnimationFrame(animate)
  }

  addEventListener('pointermove', (event) => {
    const vx = event.clientX - mouseX
    const vy = event.clientY - mouseY
    mouseX = event.clientX
    mouseY = event.clientY
    aura.style.setProperty('--x', `${event.clientX}px`)
    aura.style.setProperty('--y', `${event.clientY}px`)
    if (Math.hypot(vx, vy) > 9) addWake(event.clientX, event.clientY, vx, vy)
    if (Math.hypot(vx, vy) > 34 && Math.random() > 0.76) addRipple(event.clientX, event.clientY, 0.045, 2.1)

    const rect = sigil.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2
      sigil.style.setProperty('--rx', `${Math.max(-1, Math.min(1, -py)) * 3.5}deg`)
      sigil.style.setProperty('--ry', `${Math.max(-1, Math.min(1, px)) * 3.5}deg`)
      sigil.style.setProperty('--hx', `${Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))}%`)
      sigil.style.setProperty('--hy', `${Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))}%`)
    }
  })
  addEventListener('pointerdown', (event) => addRipple(event.clientX, event.clientY, 0.28, 3.2))
  addEventListener('resize', resize)
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(animationFrame)
    if (!document.hidden) animationFrame = requestAnimationFrame(animate)
  })

  resize()
  animationFrame = requestAnimationFrame(animate)
  return { resize, addRipple }
}
