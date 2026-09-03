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
  button.title = article.classList.contains('player') ? 'Delete persona turn' : 'Delete character/world response'
  button.setAttribute('aria-label', button.title)
  actions.append(button)
}

function mountDeleteButtons(): void {
  document.querySelectorAll<HTMLElement>('.world-runtime-message').forEach(addDeleteButton)
}

function relatedPlayerTurn(history: WorldRuntimeMessage[], index: number): WorldRuntimeMessage | undefined {
  if (history[index]?.sender === 'player') return history[index]
  for (let i = index - 1; i >= 0; i -= 1) {
    if (history[i].sender === 'player') return history[i]
    if (history[i].sender === 'world') break
  }
  return undefined
}

function deleteMessage(messageId: string): void {
  const worldId = runtimeWorldId()
  if (!worldId) return
  const repository = new LocalWorldRuntimeSessionRepository()
  const session = repository.get(worldId)
  if (!session) return
  const index = session.history.findIndex((message) => message.id === messageId)
  if (index < 0) return

  const message = session.history[index]
  const playerTurn = relatedPlayerTurn(session.history, index)
  if (playerTurn) removeRelationshipTurn(playerTurn.id)

  session.history.splice(index, 1)
  session.updatedAt = new Date().toISOString()
  repository.save(session)
  document.querySelector<HTMLElement>(`.world-runtime-message[data-message-id="${CSS.escape(messageId)}"]`)?.remove()
}

function handleClick(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-delete-message]')
  if (!button) return
  event.preventDefault()
  event.stopPropagation()
  const id = button.dataset.deleteMessage
  if (id) deleteMessage(id)
}

const observer = new MutationObserver(mountDeleteButtons)
observer.observe(document.documentElement, { childList: true, subtree: true })
document.addEventListener('click', handleClick, true)
mountDeleteButtons()

export function installWorldMessageControls(): void {
  mountDeleteButtons()
}
