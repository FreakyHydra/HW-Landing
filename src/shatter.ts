type Shard = {
  points: [number, number][]
  cx: number
  cy: number
  vx: number
  vy: number
  spin: number
  delay: number
}

type ShatterOptions = {
  canvas: HTMLCanvasElement
  image: HTMLImageElement
  gate: HTMLElement
  world: HTMLElement
  reducedMotion: boolean
  addRipple: (x: number, y: number, strength?: number, speed?: number) => void
}

function makeShards(image: HTMLImageElement, rect: DOMRect): Shard[] {
  const cols = Math.max(8, Math.min(14, Math.round(rect.width / 28)))
  const rows = cols
  const cellW = rect.width / cols
  const cellH = rect.height / rows
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const probe = document.createElement('canvas')
  probe.width = 72
  probe.height = 72
  const probeCtx = probe.getContext('2d', { willReadFrequently: true })!
  probeCtx.drawImage(image, 0, 0, probe.width, probe.height)
  const pixels = probeCtx.getImageData(0, 0, probe.width, probe.height).data

  const occupied = (x: number, y: number) => {
    const nx = Math.max(0, Math.min(probe.width - 1, Math.floor(((x - rect.left) / rect.width) * probe.width)))
    const ny = Math.max(0, Math.min(probe.height - 1, Math.floor(((y - rect.top) / rect.height) * probe.height)))
    return pixels[(ny * probe.width + nx) * 4 + 3] > 26
  }

  const shards: Shard[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = rect.left + col * cellW
      const y0 = rect.top + row * cellH
      const x1 = x0 + cellW + 0.8
      const y1 = y0 + cellH + 0.8
      const diagonal = Math.random() > 0.5
      const triangles: [number, number][][] = diagonal
        ? [[[x0, y0], [x1, y0], [x1, y1]], [[x0, y0], [x1, y1], [x0, y1]]]
        : [[[x0, y0], [x1, y0], [x0, y1]], [[x1, y0], [x1, y1], [x0, y1]]]

      for (const points of triangles) {
        const cx = points.reduce((sum, point) => sum + point[0], 0) / 3
        const cy = points.reduce((sum, point) => sum + point[1], 0) / 3
        if (!occupied(cx, cy)) continue
        const dx = cx - centerX
        const dy = cy - centerY
        const len = Math.max(20, Math.hypot(dx, dy))
        const force = 170 + Math.random() * 360
        shards.push({
          points, cx, cy,
          vx: (dx / len) * force + (Math.random() - 0.5) * 150,
          vy: (dy / len) * force + (Math.random() - 0.5) * 150 - 32,
          spin: (Math.random() - 0.5) * 4.8,
          delay: Math.random() * 0.16,
        })
      }
    }
  }
  return shards
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function shatterSigil(options: ShatterOptions, onReveal: () => void) {
  const { canvas, image, gate, world, reducedMotion, addRipple } = options
  if (reducedMotion || !image.complete || image.naturalWidth === 0) {
    gate.classList.add('gate-dissolve')
    world.classList.add('world-visible')
    world.setAttribute('aria-hidden', 'false')
    setTimeout(() => {
      gate.hidden = true
      document.body.classList.remove('gate-locked')
      onReveal()
    }, 120)
    return
  }

  const ctx = canvas.getContext('2d')!
  const rect = image.getBoundingClientRect()
  const shards = makeShards(image, rect)
  const duration = 1180
  const start = performance.now()
  canvas.classList.add('active')
  gate.classList.add('gate-shattering')
  world.classList.add('world-awakening')
  world.setAttribute('aria-hidden', 'false')
  addRipple(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.62, 5.6)

  const frame = (now: number) => {
    const raw = Math.min(1, (now - start) / duration)
    ctx.clearRect(0, 0, innerWidth, innerHeight)

    for (const shard of shards) {
      const localRaw = Math.max(0, Math.min(1, (raw - shard.delay) / (1 - shard.delay)))
      if (localRaw <= 0) continue
      const t = easeOutCubic(localRaw)
      const fade = localRaw < 0.58 ? 1 : 1 - (localRaw - 0.58) / 0.42
      const gravity = 150 * localRaw * localRaw
      const tx = shard.vx * t
      const ty = shard.vy * t + gravity

      ctx.save()
      ctx.globalAlpha = Math.max(0, fade)
      ctx.translate(shard.cx + tx, shard.cy + ty)
      ctx.rotate(shard.spin * t)
      ctx.translate(-shard.cx, -shard.cy)
      ctx.beginPath()
      ctx.moveTo(shard.points[0][0], shard.points[0][1])
      ctx.lineTo(shard.points[1][0], shard.points[1][1])
      ctx.lineTo(shard.points[2][0], shard.points[2][1])
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(image, rect.left, rect.top, rect.width, rect.height)
      ctx.restore()
    }

    if (raw < 1) {
      requestAnimationFrame(frame)
      return
    }

    ctx.clearRect(0, 0, innerWidth, innerHeight)
    canvas.classList.remove('active')
    gate.hidden = true
    document.body.classList.remove('gate-locked')
    world.classList.remove('world-awakening')
    world.classList.add('world-visible')
    onReveal()
  }

  requestAnimationFrame(frame)
}
