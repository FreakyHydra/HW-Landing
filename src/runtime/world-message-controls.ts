import { LocalWorldRuntimeSessionRepository, type WorldRuntimeMessage } from './world-brain.ts'
import { removeRelationshipTurn } from './world-turn-tools.ts'

function runtimeWorldId(): string | undefined {
  return document.querySelector<HTMLElement>('.world-runtime[data-world-id]')?.dataset.worldId
}

function addDeleteButton(article: HTMLElement): void {
  if (!article.matches('.world-runtime-message.player, .world-runtime-message.world')) return
  const actions = article.querySelector<HTMLElement>('.world-runtime-message-actions')
  if (!actions || actions.querySelector('[data-delete-message]')) return
  const id = article.dataset.messageId
  if (!id) return
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.deleteMessage = id
  button.textContent = '×'
  button.title = article.classList.contains('player') ? 'Delete persona turn and everything after it' : 'Delete this response and everything after it'
  button.setAttribute('aria-label', button.title)
  actions.append(button)
}

function mountDeleteButtons(): void {
  document.querySelectorAll<HTMLElement>('.world-runtime-message').forEach(addDeleteButton)
}

function playerTurns(messages: WorldRuntimeMessage[]): WorldRuntimeMessage[] {
  return messages.filter((message) => message.sender === 'player')
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
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-delete-message]')
  if (!button) return
  event.preventDefault()
  event.stopPropagation()
  const id = button.dataset.deleteMessage
  if (id) deleteMessageAndAfter(id)
}

const observer = new MutationObserver(mountDeleteButtons)
observer.observe(document.documentElement, { childList: true, subtree: true })
document.addEventListener('click', handleClick, true)
mountDeleteButtons()

export function installWorldMessageControls(): void {
  mountDeleteButtons()
}
