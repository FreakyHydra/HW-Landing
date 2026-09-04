import { projects, type AccessTier, type Project, type Session } from './projects'

export type UiRefs = {
  field: HTMLCanvasElement
  shatter: HTMLCanvasElement
  aura: HTMLElement
  fieldAnchor: HTMLElement
  world: HTMLElement
  identity: HTMLElement
  projectGrid: HTMLElement
}

export function mountUi(): UiRefs {
  const app = document.querySelector<HTMLDivElement>('#app')!
  document.body.classList.remove('gate-locked')
  document.body.classList.add('gate-open')

  app.innerHTML = `
    <canvas id="field" aria-hidden="true"></canvas>
    <canvas id="shatter" aria-hidden="true"></canvas>
    <div class="cursor-aura" aria-hidden="true"></div>

    <section class="world" id="world" aria-hidden="true">
      <div class="world-sky" aria-hidden="true">
        <div class="world-moon"></div>
        <div class="world-ring world-ring-a"></div>
        <div class="world-ring world-ring-b"></div>
      </div>
      <header class="world-header">
        <a class="world-brand" href="#top" aria-label="The Howling Whispers lobby">
          <img src="/hw-logo.png" alt="" />
          <span><small>THE</small> HOWLING WHISPERS</span>
        </a>
        <div class="identity" id="identity"></div>
      </header>
      <div class="world-hero" id="top">
        <p class="eyebrow">SEAL VERIFIED</p>
        <h2>The Howling Whispers Lobby</h2>
        <p>Choose where you want to go. Rebrand, Sandbox and the Lightyear Apart corporation area remain separate destinations behind the same authenticated gate.</p>
        <div class="access-legend" aria-label="Access levels">
          <span><i class="legend-dot stable"></i>Stable</span>
          <span><i class="legend-dot beta"></i>Closed Beta</span>
          <span><i class="legend-dot alpha"></i>Closed Alpha</span>
        </div>
      </div>
      <div class="realm-divider"><span>CHOOSE A DESTINATION</span></div>
      <div class="projects" id="projects"></div>
      <footer class="world-footer">
        <span>THE HOWLING WHISPERS</span>
        <span>ONE HOWL. MANY WORLDS.</span>
      </footer>
    </section>
  `

  return {
    field: document.querySelector<HTMLCanvasElement>('#field')!,
    shatter: document.querySelector<HTMLCanvasElement>('#shatter')!,
    aura: document.querySelector<HTMLElement>('.cursor-aura')!,
    fieldAnchor: document.querySelector<HTMLElement>('.world-brand')!,
    world: document.querySelector<HTMLElement>('#world')!,
    identity: document.querySelector<HTMLElement>('#identity')!,
    projectGrid: document.querySelector<HTMLElement>('#projects')!,
  }
}

function hasAccess(access: Set<AccessTier>, tier: Project['access']) {
  return tier === 'stable' || access.has(tier) || access.has('all')
}

export function renderProjects(grid: HTMLElement, session: Session) {
  const access = new Set<AccessTier>(session.access || ['stable'])
  grid.replaceChildren()

  projects.forEach((project, index) => {
    const unlocked = hasAccess(access, project.access)
    const deployed = Boolean(project.href)
    const article = document.createElement('article')
    article.className = `project ${project.primary ? 'primary' : 'secondary'} ${unlocked ? 'unlocked' : 'locked'} ${deployed ? '' : 'undeployed'}`
    article.style.setProperty('--i', String(index))
    article.dataset.tier = project.access

    const number = document.createElement('div')
    number.className = 'project-index'
    number.textContent = String(index + 1).padStart(2, '0')

    const body = document.createElement('div')
    body.className = 'project-body'
    const meta = document.createElement('div')
    meta.className = 'project-meta'
    const realm = document.createElement('span')
    realm.className = 'realm'
    realm.textContent = project.realm
    const status = document.createElement('span')
    status.className = 'status'
    status.textContent = project.stage
    meta.append(realm, status)
    const title = document.createElement('h3')
    title.textContent = project.title
    const desc = document.createElement('p')
    desc.textContent = project.desc
    body.append(meta, title, desc)

    let action: HTMLElement
    if (!unlocked) {
      action = document.createElement('div')
      action.className = 'project-action locked-text'
      const seal = document.createElement('span')
      seal.className = 'seal-icon'
      seal.textContent = '◇'
      action.append(seal, ' SEAL REQUIRED')
    } else if (!deployed) {
      action = document.createElement('div')
      action.className = 'project-action pending-text'
      action.textContent = 'PATH FORMING'
    } else {
      const link = document.createElement('a')
      link.className = 'project-action'
      link.href = project.href!
      link.textContent = project.actionLabel || 'ENTER WORLD'
      const arrow = document.createElement('span')
      arrow.textContent = '↗'
      link.append(arrow)
      action = link
    }

    article.append(number, body, action)
    article.addEventListener('pointermove', (event) => {
      const rect = article.getBoundingClientRect()
      article.style.setProperty('--mx', `${event.clientX - rect.left}px`)
      article.style.setProperty('--my', `${event.clientY - rect.top}px`)
    })
    grid.append(article)
  })
}

export function renderIdentity(identity: HTMLElement, session: Session) {
  identity.replaceChildren()
  if (!session.user) return

  if (session.user.avatarUrl) {
    const avatar = document.createElement('img')
    avatar.className = 'identity-avatar'
    avatar.src = session.user.avatarUrl
    avatar.alt = ''
    avatar.referrerPolicy = 'no-referrer'
    identity.append(avatar)
  }

  const copy = document.createElement('div')
  copy.className = 'identity-copy'
  const seal = document.createElement('span')
  seal.textContent = 'WORTH PROVEN'
  const name = document.createElement('strong')
  name.textContent = session.user.username
  copy.append(seal, name)

  const leave = document.createElement('a')
  leave.href = '/auth/logout'
  leave.textContent = 'LEAVE'
  identity.append(copy, leave)
}
