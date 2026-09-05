import { shell, toast } from '../app/shell'

type SupportKind = 'bug' | 'feature' | 'feedback'

type SupportItem = {
  id: string
  kind: SupportKind
  title: string
  summary: string
  status: string
  priority: string
  votes: number
  reportCount: number
  githubIssueNumber?: number
}

function optionButton(kind: SupportKind, title: string, copy: string, icon: string): string {
  return `<button type="button" class="support-kind-card" data-support-kind="${kind}"><span class="support-kind-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><small>${copy}</small></button>`
}

export async function renderSupport(root: HTMLElement): Promise<void> {
  root.innerHTML = shell('/support/', `
    <section class="support-grid">
      <article class="support-panel support-intake-panel">
        <header class="module-title"><div><p class="eyebrow">SUPPORT INTAKE</p><h2>Tell us what happened</h2></div><small>KILO / CODEX TRIAGE</small></header>
        <p class="module-intro">Reports are cleaned up, checked for duplicates and archived before the canonical issue is created or updated on GitHub.</p>
        <div class="support-kind-grid">
          ${optionButton('bug', 'Report a bug', 'Broken behaviour, errors, regressions or anything that does not work as expected.', '⚠')}
          ${optionButton('feature', 'Feature request', 'Suggest something new or vote support behind an existing idea.', '+')}
          ${optionButton('feedback', 'Other feedback', 'Usability notes, suggestions or anything that does not fit the other categories.', '✦')}
        </div>

        <form id="support-form" class="editor-panel support-form" hidden>
          <input type="hidden" id="support-kind" value="bug" />
          <label class="field-control"><span class="field-head">Title</span><input id="support-title" maxlength="140" required placeholder="Short description" /></label>
          <label class="field-control"><span class="field-head">What happened / what do you want?</span><textarea id="support-body" rows="7" maxlength="8000" required placeholder="Describe the problem or idea in your own words."></textarea></label>
          <div class="field-grid">
            <label class="field-control"><span class="field-head">Where?</span><input id="support-area" maxlength="120" placeholder="World Runtime, Image Studio, Character Factory..." /></label>
            <label class="field-control"><span class="field-head">How urgent is this for you?</span><select id="support-urgency"><option value="normal">Normal</option><option value="important">Important</option><option value="blocking">Blocking me</option></select></label>
          </div>
          <label class="field-control" id="support-repro-field"><span class="field-head">Steps to reproduce</span><textarea id="support-repro" rows="4" maxlength="4000" placeholder="1. Open... 2. Do... 3. Observe..."></textarea></label>
          <div class="support-privacy-note">Do not include passwords, API tokens, cookies, recovery codes or other secrets. Security reports should not be submitted through this public issue intake.</div>
          <div class="card-actions"><button type="submit" class="machine-button primary">SUBMIT TO SUPPORT</button><button type="button" class="machine-button" id="support-cancel">CANCEL</button></div>
        </form>
      </article>

      <article class="support-panel">
        <header class="module-title"><div><p class="eyebrow">COMMUNITY PRIORITY</p><h2>Open support board</h2></div><small>LIVE ARCHIVE</small></header>
        <p class="module-intro">Similar reports are merged into one canonical item. Bugs use urgency votes. Features use Most Wanted votes.</p>
        <div id="support-board" class="support-board"><p class="module-intro">Loading support archive...</p></div>
      </article>
    </section>
  `, 'Support', 'SUPPORT · COMMUNITY INTAKE')

  const form = root.querySelector<HTMLFormElement>('#support-form')!
  const kindInput = root.querySelector<HTMLInputElement>('#support-kind')!
  const reproField = root.querySelector<HTMLElement>('#support-repro-field')!
  const titleInput = root.querySelector<HTMLInputElement>('#support-title')!

  const openForm = (kind: SupportKind) => {
    kindInput.value = kind
    form.hidden = false
    reproField.hidden = kind !== 'bug'
    titleInput.placeholder = kind === 'bug' ? 'What is broken?' : kind === 'feature' ? 'What should we add?' : 'Short description'
    titleInput.focus()
  }

  root.querySelectorAll<HTMLButtonElement>('[data-support-kind]').forEach((button) => button.addEventListener('click', () => openForm(button.dataset.supportKind as SupportKind)))
  root.querySelector<HTMLButtonElement>('#support-cancel')?.addEventListener('click', () => { form.hidden = true; form.reset() })

  const renderBoard = async () => {
    const board = root.querySelector<HTMLElement>('#support-board')!
    try {
      const response = await fetch('/api/support/items')
      if (!response.ok) throw new Error('Support archive unavailable')
      const items = await response.json() as SupportItem[]
      if (!items.length) { board.innerHTML = '<p class="module-intro">No public reports yet.</p>'; return }
      board.innerHTML = items.map((item) => `
        <article class="support-item">
          <div class="support-item-copy"><span class="support-badge ${item.kind}">${item.kind === 'feature' ? 'FEATURE' : item.kind.toUpperCase()}</span><strong>${item.title}</strong><p>${item.summary}</p><small>${item.reportCount} report${item.reportCount === 1 ? '' : 's'} · ${item.priority} · ${item.status}${item.githubIssueNumber ? ` · GitHub #${item.githubIssueNumber}` : ''}</small></div>
          <button type="button" class="support-vote" data-support-vote="${item.id}"><b>${item.votes}</b><span>${item.kind === 'feature' ? 'MOST WANTED' : 'URGENT'}</span></button>
        </article>`).join('')
      board.querySelectorAll<HTMLButtonElement>('[data-support-vote]').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true
        try {
          const vote = await fetch(`/api/support/items/${encodeURIComponent(button.dataset.supportVote || '')}/vote`, { method: 'POST' })
          if (!vote.ok) throw new Error('Vote failed')
          await renderBoard()
        } catch { toast(root, 'Could not record vote.', 'error'); button.disabled = false }
      }))
    } catch { board.innerHTML = '<p class="module-intro">Support archive is temporarily unavailable.</p>' }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    submit.disabled = true
    submit.textContent = 'TRIAGING...'
    try {
      const response = await fetch('/api/support/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: kindInput.value,
          title: titleInput.value,
          body: root.querySelector<HTMLTextAreaElement>('#support-body')!.value,
          area: root.querySelector<HTMLInputElement>('#support-area')!.value,
          urgency: root.querySelector<HTMLSelectElement>('#support-urgency')!.value,
          reproduction: root.querySelector<HTMLTextAreaElement>('#support-repro')!.value,
          client: { path: location.pathname, userAgent: navigator.userAgent, language: navigator.language },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Submission failed')
      toast(root, result.merged ? 'Added to an existing support item.' : 'Support report received.', 'normal')
      form.reset(); form.hidden = true
      await renderBoard()
    } catch (error) { toast(root, error instanceof Error ? error.message : 'Could not submit report.', 'error') }
    finally { submit.disabled = false; submit.textContent = 'SUBMIT TO SUPPORT' }
  })

  await renderBoard()
}
