import { html } from '../app/html'

const ISSUE_BASE = 'https://github.com/FreakyHydra/HW-Landing/issues/new'

function issueUrl(title: string, body: string): string {
  const params = new URLSearchParams({ title, body })
  return `${ISSUE_BASE}?${params.toString()}`
}

export function supportView(): HTMLElement {
  const bugUrl = issueUrl(
    '[Bug] ',
    `## What happened?\nDescribe the problem clearly.\n\n## What did you expect?\nWhat should have happened instead?\n\n## Where did it happen?\n- Area: \n- Browser/device: \n- Rebrand version/build if known: \n\n## Steps to reproduce\n1. \n2. \n3. \n\n## Extra details\nScreenshots, error messages, roleplay excerpts, or anything else that may help.`,
  )
  const featureUrl = issueUrl(
    '[Feature] ',
    `## What would you like added or changed?\nDescribe the feature.\n\n## Why would it help?\nExplain the problem or workflow this improves.\n\n## Where should it live?\nMention the relevant Rebrand area if known.\n\n## Extra details\nMockups, examples, or related ideas.`,
  )
  const feedbackUrl = issueUrl(
    '[Feedback] ',
    `## Feedback\nTell us what is working, what feels confusing, or what could be improved.\n\n## Area\nWhich part of Rebrand does this concern?\n\n## Extra details\nAnything else that helps explain the feedback.`,
  )

  return html(`
    <section class="support-view page-stack">
      <header class="page-header">
        <p class="eyebrow">Support</p>
        <h1>How can we help?</h1>
        <p>Report problems, request features, or send feedback. Reports go straight into the project tracker so they can be triaged and included in the weekly bug patrol.</p>
      </header>

      <div class="support-grid">
        <a class="support-card" href="${bugUrl}" target="_blank" rel="noreferrer">
          <strong>Report a bug</strong>
          <span>Something is broken, inconsistent, or behaving incorrectly.</span>
        </a>

        <a class="support-card" href="${featureUrl}" target="_blank" rel="noreferrer">
          <strong>Feature request</strong>
          <span>Suggest a new tool, workflow, option, or improvement.</span>
        </a>

        <a class="support-card" href="${feedbackUrl}" target="_blank" rel="noreferrer">
          <strong>General feedback</strong>
          <span>Tell us what works well or what could be clearer.</span>
        </a>

        <a class="support-card" href="https://github.com/FreakyHydra/HW-Landing/issues" target="_blank" rel="noreferrer">
          <strong>Known issues</strong>
          <span>See existing reports before creating a duplicate.</span>
        </a>
      </div>

      <p class="support-note">For account or security problems, avoid posting private tokens, passwords, recovery codes, or other secrets in a public issue.</p>
    </section>
  `)
}
