export type EntityMenuAction = {
  id: string
  label: string
  danger?: boolean
  separated?: boolean
  disabled?: boolean
}

export type EntityMenuRequest = {
  entityId: string
  entityKind: string
  card: HTMLElement
}

type EntityMenuOptions = {
  selector?: string
  actions: (request: EntityMenuRequest) => EntityMenuAction[]
  onAction: (actionId: string, request: EntityMenuRequest) => void | Promise<void>
  longPressMs?: number
}

type MenuWindow = Window & { __hwEntityMenuAbort?: AbortController }

export function bindEntityContextMenus(container: HTMLElement, options: EntityMenuOptions): () => void {
  const menuWindow = window as MenuWindow
  menuWindow.__hwEntityMenuAbort?.abort()
  const controller = new AbortController()
  menuWindow.__hwEntityMenuAbort = controller
  const { signal } = controller
  const selector = options.selector ?? '[data-entity-menu-id]'
  let menu: HTMLElement | undefined
  let selectedCard: HTMLElement | undefined
  let pressTimer: number | undefined
  let startPoint: { x: number; y: number } | undefined

  const close = (restoreFocus = false) => {
    menu?.remove()
    menu = undefined
    selectedCard?.classList.remove('is-menu-selected')
    if (restoreFocus) selectedCard?.focus()
    selectedCard = undefined
  }

  const requestFor = (card: HTMLElement): EntityMenuRequest => ({
    entityId: card.dataset.entityMenuId ?? '',
    entityKind: card.dataset.entityMenuKind ?? '',
    card,
  })

  const open = (card: HTMLElement, x: number, y: number) => {
    close()
    const request = requestFor(card)
    const actions = options.actions(request)
    if (!request.entityId || !actions.length) return
    selectedCard = card
    card.classList.add('is-menu-selected')
    menu = document.createElement('div')
    menu.className = 'entity-context-menu'
    menu.setAttribute('role', 'menu')
    menu.setAttribute('aria-label', `${request.entityKind || 'Entity'} actions`)
    menu.innerHTML = actions.map((action) => `<button type="button" role="menuitem" data-menu-action="${action.id}" class="${action.danger ? 'danger' : ''} ${action.separated ? 'separated' : ''}" ${action.disabled ? 'disabled' : ''}>${action.label}</button>`).join('')
    document.body.append(menu)
    const bounds = menu.getBoundingClientRect()
    const margin = 8
    menu.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - bounds.width - margin))}px`
    menu.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - bounds.height - margin))}px`
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')]
    buttons[0]?.focus()
    menu.addEventListener('click', async (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-menu-action]')
      if (!button) return
      const actionId = button.dataset.menuAction!
      close()
      await options.onAction(actionId, request)
    }, { signal })
    menu.addEventListener('keydown', (event) => {
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        buttons[(current + direction + buttons.length) % buttons.length]?.focus()
      } else if (event.key === 'Home') { event.preventDefault(); buttons[0]?.focus() }
      else if (event.key === 'End') { event.preventDefault(); buttons.at(-1)?.focus() }
      else if (event.key === 'Escape') { event.preventDefault(); close(true) }
    }, { signal })
  }

  container.addEventListener('contextmenu', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(selector)
    if (!card) return
    event.preventDefault()
    open(card, event.clientX, event.clientY)
  }, { signal })

  container.addEventListener('click', (event) => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-entity-menu-trigger]')
    const card = trigger?.closest<HTMLElement>(selector)
    if (!trigger || !card) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = trigger.getBoundingClientRect()
    open(card, bounds.right, bounds.bottom + 5)
  }, { signal })

  container.addEventListener('keydown', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(selector)
    if (!card || !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const bounds = card.getBoundingClientRect()
    open(card, bounds.left + 24, bounds.top + 24)
  }, { signal })

  container.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return
    const card = (event.target as HTMLElement).closest<HTMLElement>(selector)
    if (!card) return
    startPoint = { x: event.clientX, y: event.clientY }
    pressTimer = window.setTimeout(() => { navigator.vibrate?.(18); open(card, event.clientX, event.clientY); pressTimer = undefined }, options.longPressMs ?? 560)
  }, { signal })
  const cancelPress = () => { if (pressTimer !== undefined) window.clearTimeout(pressTimer); pressTimer = undefined; startPoint = undefined }
  container.addEventListener('pointermove', (event) => {
    if (startPoint && Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > 10) cancelPress()
  }, { signal })
  container.addEventListener('pointerup', cancelPress, { signal })
  container.addEventListener('pointercancel', cancelPress, { signal })
  document.addEventListener('pointerdown', (event) => { if (menu && !menu.contains(event.target as Node)) close() }, { signal, capture: true })
  window.addEventListener('resize', () => close(), { signal })
  window.addEventListener('scroll', () => close(), { signal, capture: true })
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(true) }, { signal })
  return () => controller.abort()
}
