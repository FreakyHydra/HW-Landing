import { LocalWorldRuntimeSessionRepository, type WorldRuntimeMessage } from './world-brain.ts'
import { removeRelationshipTurn } from './world-turn-tools.ts'

function runtimeWorldId(): string | undefined {
  return document.querySelector<HTMLElement>('.world-runtime[data-world-id]')?.dataset.worldId
}

function addMessageButtons(article: HTMLElement): void {
  if (!article.matches('.world-runtime-message.player, .world-runtime-message.world')) return
  const actions = article.querySelector<HTMLElement>('.world-runtime-message-actions')
  if (!actions) return
  const id = article.dataset.messageId
  if (!id) return

  if (!actions.querySelector('[data-edit-message]')) {
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.dataset.editMessage = id
    edit.textContent = '✎'
    edit.title = article.classList.contains('player') ? 'Edit persona turn' : 'Edit character/world response'
    edit.setAttribute('aria-label', edit.title)
    actions.append(edit)
  }

  if (!actions.querySelector('[data-delete-message]')) {
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.dataset.deleteMessage = id
    remove.textContent = '×'
    remove.title = article.classList.contains('player') ? 'Delete persona turn and everything after it' : 'Delete this response and everything after it'
    remove.setAttribute('aria-label', remove.title)
    actions.append(remove)
  }
}

function mountMessageButtons(): void {
  document.querySelectorAll<HTMLElement>('.world-runtime-message').forEach(addMessageButtons)
}

function playerTurns(messages: WorldRuntimeMessage[]): WorldRuntimeMessage[] {
  return messages.filter((message) => message.sender === 'player')
}

function editMessage(messageId: string): void {
  const worldId = runtimeWorldId()
  if (!worldId) return
  const repository = new LocalWorldRuntimeSessionRepository()
  const session = repository.get(worldId)
  if (!session) return
  const index = session.history.findIndex((message) => message.id === messageId)
  if (index < 0) return

  const message = session.history[index]
  if (message.sender !== 'player' && message.sender !== 'world') return
  const next = window.prompt(message.sender === 'player' ? 'Edit persona turn:' : 'Edit character/world response:', message.text)
  if (next === null) return
  const trimmed = next.trim()
  if (!trimmed || trimmed === message.text) return

  message.text = trimmed
  session.updatedAt = new Date().toISOString()
  repository.save(session)

  const article = document.querySelector<HTMLElement>(`.world-runtime-message[data-message-id="${CSS.escape(messageId)}"]`)
  const body = article?.querySelector<HTMLElement>('.world-runtime-message-body')
  if (body) body.textContent = trimmed
}

function deleteMessageAndAfter(messageId: string): void {
  const worldId = runtimeWorldId()
  if (!worldId) return
  const repository = new LocalWorldRuntimeSessionRepository()
  const session = repository.get(worldId)
  if (!session) return
  const index = session.history.findIndex((message) => message.id === messageId)
  if (index < 0) return

  const removed = session.history.slice(index)
  if (removed.length > 1) {
    const confirmed = window.confirm(`Delete this message and the ${removed.length - 1} message${removed.length === 2 ? '' : 's'} after it?\n\nLater turns depend on this point in the conversation, so they will be removed too.`)
    if (!confirmed) return
  }

  for (const turn of playerTurns(removed)) removeRelationshipTurn(turn.id)

  session.history = session.history.slice(0, index)
  session.updatedAt = new Date().toISOString()
  repository.save(session)

  for (const message of removed) {
    document.querySelector<HTMLElement>(`.world-runtime-message[data-message-id="${CSS.escape(message.id)}"]`)?.remove()
  }
}

function handleClick(event: Event): void {
  const edit = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-edit-message]')
  if (edit) {
    event.preventDefault()
    event.stopPropagation()
    const id = edit.dataset.editMessage
    if (id) editMessage(id)
    return
  }

  const remove = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-delete-message]')
  if (!remove) return
  event.preventDefault()
  event.stopPropagation()
  const id = remove.dataset.deleteMessage
  if (id) deleteMessageAndAfter(id)
}

const observer = new MutationObserver(mountMessageButtons)
observer.observe(document.documentElement, { childList: true, subtree: true })
document.addEventListener('click', handleClick, true)
mountMessageButtons()

export function installWorldMessageControls(): void {
  mountMessageButtons()
}
