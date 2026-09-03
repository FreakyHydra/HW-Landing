import { getRoleplayTextColors } from './roleplay-visual-settings'

function colorPlayerMessage(body: HTMLElement): void {
  if (body.dataset.roleplayColorsApplied === 'true') return
  const text = body.textContent || ''
  if (!text) return

  const colors = getRoleplayTextColors()
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|“[^”\n]+”|"[^"\n]+")/g
  const fragment = document.createDocumentFragment()
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      const narration = document.createElement('span')
      narration.className = 'world-runtime-narration'
      narration.style.color = colors.narration
      narration.textContent = text.slice(cursor, index)
      fragment.append(narration)
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
    fragment.append(span)
    cursor = index + token.length
  }

  if (cursor < text.length) {
    const narration = document.createElement('span')
    narration.className = 'world-runtime-narration'
    narration.style.color = colors.narration
    narration.textContent = text.slice(cursor)
    fragment.append(narration)
  }

  body.replaceChildren(fragment)
  body.dataset.roleplayColorsApplied = 'true'
}

function applyPlayerMessageColors(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.world-runtime-message.player .world-runtime-message-body').forEach(colorPlayerMessage)
}

export function installPlayerMessageColors(): void {
  applyPlayerMessageColors()

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        if (node.matches('.world-runtime-message.player .world-runtime-message-body')) colorPlayerMessage(node)
        applyPlayerMessageColors(node)
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}
