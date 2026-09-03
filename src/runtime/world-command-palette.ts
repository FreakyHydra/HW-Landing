type CommandItem = {
  label: string
  value?: string
  description?: string
  children?: CommandItem[]
}

const COMMANDS: CommandItem[] = [
  {
    label: 'Session', description: 'World session controls', children: [
      { label: 'New session', value: '/new', description: 'Start this world session over.' },
      { label: 'Clear conversation', value: '/clear', description: 'Clear conversation but keep canon and relationships.' },
      { label: 'Leave world', value: '/exit', description: 'Return to the main platform.' },
    ],
  },
  {
    label: 'Roleplay', description: 'Generation and player controls', children: [
      { label: 'Reroll world reply', value: '/reroll', description: 'Regenerate the latest world response.' },
      { label: 'Reroll player turn', value: '/reroll me', description: 'Regenerate the latest persona turn.' },
      { label: 'Impersonate', value: '/impersonate ', description: 'Write a persona turn. Add an optional direction.' },
      { label: 'Next character turn', value: '/character', description: 'Continue with whichever character is naturally due to act next. A name is optional.' },
      {
        label: 'Response length', description: 'Choose how long replies usually are', children: [
          { label: 'Quick', value: '/length quick', description: 'About 1-2 paragraphs.' },
          { label: 'Immersive', value: '/length immersive', description: 'About 3-5 substantial paragraphs.' },
          { label: 'Novel-like', value: '/length novel', description: 'About 5-8 substantial paragraphs.' },
        ],
      },
    ],
  },
  {
    label: 'World', description: 'Inspect the current world state', children: [
      { label: 'Where am I?', value: '/where', description: 'Show the current resolved location.' },
      { label: 'Who is nearby?', value: '/who', description: 'Show locally relevant named inhabitants.' },
    ],
  },
  {
    label: 'NovelAI', description: 'Provider shortcuts', children: [
      { label: 'Set token', value: '/nai token ', description: 'Save a persistent NovelAI token on this device.' },
      {
        label: 'Model', description: 'Choose the NovelAI model', children: [
          { label: 'Xiaolong v1', value: '/nai model xialong-v1' },
          { label: 'GLM 4.6', value: '/nai model glm-4-6' },
        ],
      },
      { label: 'Clear token', value: '/nai clear', description: 'Remove the saved NovelAI token.' },
    ],
  },
  { label: 'Help', value: '/help', description: 'Show command help.' },
]

function allLeaves(items: CommandItem[], path: string[] = []): Array<CommandItem & { path: string[] }> {
  return items.flatMap((item) => item.children?.length
    ? allLeaves(item.children, [...path, item.label])
    : item.value ? [{ ...item, path }] : [])
}

const LEAVES = allLeaves(COMMANDS)

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function mountRuntimePalette(): void {
  const form = document.querySelector<HTMLFormElement>('.world-runtime-prompt')
  if (!form || form.querySelector('[data-command-palette]')) return
  const input = form.querySelector<HTMLTextAreaElement>('textarea')
  const arrow = form.querySelector<HTMLElement>('.world-runtime-prompt-mark')
  if (!input || !arrow) return

  arrow.setAttribute('role', 'button')
  arrow.setAttribute('tabindex', '0')
  arrow.setAttribute('aria-label', 'Open command menu')
  arrow.setAttribute('aria-haspopup', 'menu')
  arrow.title = 'Commands'

  const palette = document.createElement('div')
  palette.dataset.commandPalette = 'true'
  palette.className = 'world-command-palette'
  palette.hidden = true
  palette.innerHTML = '<div class="world-command-palette-head"><span>COMMANDS</span><small>Click or type /</small></div><div class="world-command-breadcrumb" data-command-breadcrumb></div><div class="world-command-list" data-command-list role="menu"></div>'
  form.append(palette)

  const list = palette.querySelector<HTMLElement>('[data-command-list]')!
  const breadcrumb = palette.querySelector<HTMLElement>('[data-command-breadcrumb]')!
  let stack: Array<{ title: string; items: CommandItem[] }> = [{ title: 'Commands', items: COMMANDS }]
  let activeIndex = 0

  function currentItems(): CommandItem[] { return stack.at(-1)?.items || COMMANDS }

  function render(items = currentItems(), filtered = false): void {
    breadcrumb.innerHTML = filtered ? '<button type="button" data-command-back>COMMAND SEARCH</button>' : stack.map((entry, index) => `<button type="button" data-command-level="${index}">${escapeHtml(entry.title)}</button>`).join('<span>›</span>')
    activeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, items.length - 1)))
    list.innerHTML = items.length ? items.map((item, index) => `
      <button type="button" class="world-command-item${index === activeIndex ? ' active' : ''}" data-command-index="${index}" role="menuitem">
        <span><strong>${escapeHtml(item.label)}</strong>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span>
        ${item.children?.length ? '<b>›</b>' : item.value ? `<code>${escapeHtml(item.value.trim())}</code>` : ''}
      </button>
    `).join('') : '<p class="world-command-empty">No matching commands.</p>'
    palette.hidden = false
    arrow.setAttribute('aria-expanded', 'true')
  }

  function close(): void {
    palette.hidden = true
    arrow.setAttribute('aria-expanded', 'false')
  }

  function selectItem(item: CommandItem): void {
    if (item.children?.length) {
      stack.push({ title: item.label, items: item.children })
      activeIndex = 0
      render()
      return
    }
    if (!item.value) return
    input.value = item.value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    close()
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }

  function openRoot(): void {
    stack = [{ title: 'Commands', items: COMMANDS }]
    activeIndex = 0
    render()
  }

  function autocomplete(): void {
    const query = input.value.trim().toLowerCase()
    if (!query.startsWith('/')) {
      close()
      return
    }
    const matches = LEAVES
      .filter((item) => item.value!.toLowerCase().startsWith(query) || item.label.toLowerCase().includes(query.slice(1)) || item.path.some((part) => part.toLowerCase().includes(query.slice(1))))
      .slice(0, 12)
      .map((item) => ({ label: item.label, value: item.value, description: item.path.length ? `${item.path.join(' › ')}${item.description ? ` · ${item.description}` : ''}` : item.description }))
    activeIndex = 0
    render(matches, true)
  }

  arrow.addEventListener('click', () => palette.hidden ? openRoot() : close())
  arrow.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      palette.hidden ? openRoot() : close()
    }
  })

  palette.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const level = target.closest<HTMLButtonElement>('[data-command-level]')
    if (level) {
      stack = stack.slice(0, Number(level.dataset.commandLevel) + 1)
      activeIndex = 0
      render()
      return
    }
    const button = target.closest<HTMLButtonElement>('[data-command-index]')
    if (!button) return
    const index = Number(button.dataset.commandIndex)
    const queryMode = input.value.trim().startsWith('/')
    const source = queryMode
      ? LEAVES.filter((item) => item.value!.toLowerCase().startsWith(input.value.trim().toLowerCase()) || item.label.toLowerCase().includes(input.value.trim().slice(1).toLowerCase()) || item.path.some((part) => part.toLowerCase().includes(input.value.trim().slice(1).toLowerCase()))).slice(0, 12)
      : currentItems()
    const item = source[index]
    if (item) selectItem(item)
  })

  input.addEventListener('input', autocomplete)
  input.addEventListener('keydown', (event) => {
    if (palette.hidden) return
    const items = input.value.trim().startsWith('/')
      ? LEAVES.filter((item) => item.value!.toLowerCase().startsWith(input.value.trim().toLowerCase()) || item.label.toLowerCase().includes(input.value.trim().slice(1).toLowerCase()) || item.path.some((part) => part.toLowerCase().includes(input.value.trim().slice(1).toLowerCase()))).slice(0, 12)
      : currentItems()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + Math.max(items.length, 1)) % Math.max(items.length, 1)
      render(items, input.value.trim().startsWith('/'))
    } else if (event.key === 'Tab' && input.value.trim().startsWith('/') && items.length) {
      event.preventDefault()
      selectItem(items[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }, true)

  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node
    if (!palette.hidden && !palette.contains(target) && !arrow.contains(target)) close()
  })
}

const observer = new MutationObserver(mountRuntimePalette)
observer.observe(document.documentElement, { childList: true, subtree: true })
mountRuntimePalette()

export function installWorldCommandPalette(): void {
  mountRuntimePalette()
}
