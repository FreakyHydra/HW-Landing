import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'

const VALID_KINDS = new Set(['bug', 'feature', 'feedback'])
const VALID_URGENCY = new Set(['normal', 'important', 'blocking'])

function clean(value, max = 8000) {
  return String(value || '').replace(/\0/g, '').trim().slice(0, max)
}

function now() { return new Date().toISOString() }
function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}` }

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch (error) { if (error?.code === 'ENOENT') return fallback; throw error }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  await fs.writeFile(temp, JSON.stringify(value, null, 2))
  await fs.rename(temp, file)
}

function supportPaths(root) {
  const dir = process.env.SUPPORT_DATA_DIR || path.join(root, '.support-data')
  return { dir, items: path.join(dir, 'items.json'), raw: path.join(dir, 'raw-reports.jsonl') }
}

function fallbackTriage(report) {
  const text = `${report.title} ${report.body} ${report.area}`.toLowerCase()
  const critical = /data loss|deleted|security|credential|cannot start|crash|fatal|corrupt/.test(text)
  const high = critical || /broken|fails|failure|regression|cannot|doesn't work|does not work/.test(text)
  return {
    title: report.title,
    summary: report.body.slice(0, 500),
    category: report.kind,
    area: report.area || 'Unspecified',
    severity: critical ? 'critical' : high ? 'high' : report.kind === 'bug' ? 'medium' : 'normal',
    duplicateId: null,
    duplicateConfidence: 0,
    reason: 'Local fallback classification',
  }
}

function triagePrompt(report, candidates) {
  return `You are the intake triage service for The Howling Whispers Rebrand V2 support system.\n\nYour job is to preserve the reporter's meaning while cleaning wording, classifying the report, and detecting whether it is the same underlying bug or feature as an existing canonical item. Never invent requirements or facts.\n\nReturn ONLY JSON with this shape:\n{"title":"short canonical title","summary":"concise faithful summary","category":"bug|feature|feedback","area":"subsystem","severity":"critical|high|medium|low|normal","duplicateId":null,"duplicateConfidence":0,"reason":"short reason"}\n\nFor bugs, severity means technical/user impact. For features use severity=normal. A duplicate must be the same underlying issue or substantially the same feature, not merely related. Only set duplicateId when confidence is at least 0.86.\n\nNEW REPORT:\n${JSON.stringify(report)}\n\nEXISTING CANDIDATES:\n${JSON.stringify(candidates.slice(0, 40))}`
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) for (const part of item?.content || []) if (typeof part?.text === 'string') return part.text
  }
  const choice = payload?.choices?.[0]
  return choice?.message?.content || choice?.text || ''
}

function parseJsonish(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Triage provider did not return JSON.')
  return JSON.parse(raw.slice(start, end + 1))
}

async function triageWithOpenAI(report, candidates) {
  const token = clean(process.env.OPENAI_API_KEY, 1000)
  if (!token) throw new Error('OpenAI support triage is not configured.')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_SUPPORT_MODEL || 'gpt-5.3-codex', input: triagePrompt(report, candidates), reasoning: { effort: 'medium' }, max_output_tokens: 1200 }),
    signal: AbortSignal.timeout(60000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`OpenAI triage failed (${response.status}).`)
  return parseJsonish(extractOutputText(payload))
}

async function triageWithKilo(report, candidates) {
  const token = clean(process.env.KILO_API_TOKEN, 1000)
  const base = clean(process.env.KILO_API_BASE_URL, 1000).replace(/\/$/, '')
  if (!token || !base) throw new Error('Kilo fallback is not configured.')
  const endpoint = process.env.KILO_API_PATH || '/v1/chat/completions'
  const response = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.KILO_SUPPORT_MODEL || 'auto-free', messages: [{ role: 'user', content: triagePrompt(report, candidates) }], temperature: 0.1, max_tokens: 1200 }),
    signal: AbortSignal.timeout(60000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Kilo triage failed (${response.status}).`)
  return parseJsonish(extractOutputText(payload))
}

async function triage(report, items) {
  const candidates = items.map((item) => ({ id: item.id, kind: item.kind, title: item.title, summary: item.summary, area: item.area, status: item.status }))
  try { return { ...(await triageWithOpenAI(report, candidates)), provider: 'openai-codex' } }
  catch (openAiError) {
    try { return { ...(await triageWithKilo(report, candidates)), provider: 'kilo-auto-free' } }
    catch (kiloError) {
      console.warn('Support AI triage unavailable, using local fallback:', openAiError.message, kiloError.message)
      return { ...fallbackTriage(report), provider: 'local-fallback' }
    }
  }
}

function normalizeTriage(result, report, items) {
  const duplicate = items.find((item) => item.id === result.duplicateId)
  const confidence = Math.max(0, Math.min(1, Number(result.duplicateConfidence) || 0))
  return {
    title: clean(result.title || report.title, 140),
    summary: clean(result.summary || report.body, 800),
    category: VALID_KINDS.has(result.category) ? result.category : report.kind,
    area: clean(result.area || report.area || 'Unspecified', 120),
    severity: ['critical','high','medium','low','normal'].includes(result.severity) ? result.severity : report.kind === 'bug' ? 'medium' : 'normal',
    duplicateId: duplicate && confidence >= 0.86 ? duplicate.id : null,
    duplicateConfidence: confidence,
    provider: result.provider || 'unknown',
  }
}

async function githubRequest(method, endpoint, body) {
  const token = clean(process.env.GITHUB_SUPPORT_TOKEN, 1000)
  const repo = clean(process.env.GITHUB_SUPPORT_REPO || 'FreakyHydra/HW-Landing', 200)
  if (!token) return null
  const response = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`GitHub support sync failed (${response.status}).`)
  return payload
}

function issueBody(item) {
  const voteLabel = item.kind === 'feature' ? 'Most Wanted votes' : 'Urgency votes'
  return `## Summary\n${item.summary}\n\n## Area\n${item.area}\n\n## Priority\n${item.priority}\n\n## Community signal\n- Reports merged: ${item.reportCount}\n- ${voteLabel}: ${item.votes}\n- First reported: ${item.createdAt}\n- Last reported: ${item.updatedAt}\n\n## Support archive\nCanonical ID: \`${item.id}\`\n\n_This issue is synchronized from the Rebrand V2 support intake. Raw submissions remain in the private server-side support archive._`
}

async function syncGithub(item, isNew) {
  try {
    if (!process.env.GITHUB_SUPPORT_TOKEN) return item
    if (isNew || !item.githubIssueNumber) {
      const labels = item.kind === 'bug' ? ['bug', `priority:${item.priority}`] : item.kind === 'feature' ? ['enhancement'] : ['feedback']
      const issue = await githubRequest('POST', '/issues', { title: `[${item.kind === 'feature' ? 'Feature' : item.kind === 'bug' ? 'Bug' : 'Feedback'}] ${item.title}`, body: issueBody(item), labels })
      if (issue?.number) { item.githubIssueNumber = issue.number; item.githubUrl = issue.html_url }
    } else {
      await githubRequest('POST', `/issues/${item.githubIssueNumber}/comments`, { body: `Support update: canonical report now has **${item.reportCount}** merged reports and **${item.votes}** community votes. Last updated ${item.updatedAt}.` })
      await githubRequest('PATCH', `/issues/${item.githubIssueNumber}`, { body: issueBody(item) })
    }
  } catch (error) { console.error('Support GitHub sync failed:', error.message) }
  return item
}

export function createSupportRouter(root) {
  const router = express.Router()
  const files = supportPaths(root)

  router.get('/items', async (_req, res) => {
    const items = await readJson(files.items, [])
    const publicItems = items.filter((item) => item.status !== 'archived').sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0) || b.votes - a.votes || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    res.json(publicItems.map(({ sourceReports, ...item }) => item))
  })

  router.post('/report', express.json({ limit: '128kb' }), async (req, res) => {
    const kind = VALID_KINDS.has(req.body?.kind) ? req.body.kind : null
    const title = clean(req.body?.title, 140)
    const body = clean(req.body?.body, 8000)
    if (!kind || !title || !body) return res.status(400).json({ error: 'A report type, title and description are required.' })
    const report = { id: id('SUP'), kind, title, body, area: clean(req.body?.area, 120), urgency: VALID_URGENCY.has(req.body?.urgency) ? req.body.urgency : 'normal', reproduction: clean(req.body?.reproduction, 4000), client: { path: clean(req.body?.client?.path, 300), userAgent: clean(req.body?.client?.userAgent, 500), language: clean(req.body?.client?.language, 40) }, createdAt: now() }
    await fs.mkdir(files.dir, { recursive: true })
    await fs.appendFile(files.raw, `${JSON.stringify(report)}\n`)

    const items = await readJson(files.items, [])
    const result = normalizeTriage(await triage(report, items), report, items)
    let item = result.duplicateId ? items.find((candidate) => candidate.id === result.duplicateId) : null
    const merged = Boolean(item)
    if (item) {
      item.reportCount += 1
      item.updatedAt = now()
      item.sourceReports = [...new Set([...(item.sourceReports || []), report.id])]
      if (report.urgency === 'blocking') item.priorityScore = (item.priorityScore || 0) + 3
      else if (report.urgency === 'important') item.priorityScore = (item.priorityScore || 0) + 1
      item = await syncGithub(item, false)
    } else {
      const severityWeight = { critical: 100, high: 70, medium: 40, low: 15, normal: 20 }[result.severity] || 20
      item = { id: id(kind === 'feature' ? 'FEAT' : kind === 'bug' ? 'BUG' : 'FB'), kind: result.category, title: result.title, summary: result.summary, area: result.area, priority: result.severity, priorityScore: severityWeight + (report.urgency === 'blocking' ? 6 : report.urgency === 'important' ? 2 : 0), votes: 0, reportCount: 1, status: 'open', triageProvider: result.provider, createdAt: now(), updatedAt: now(), sourceReports: [report.id] }
      item = await syncGithub(item, true)
      items.push(item)
    }
    await writeJson(files.items, items)
    res.status(201).json({ ok: true, merged, itemId: item.id, githubIssueNumber: item.githubIssueNumber || null })
  })

  router.post('/items/:id/vote', async (req, res) => {
    const items = await readJson(files.items, [])
    const item = items.find((candidate) => candidate.id === req.params.id)
    if (!item) return res.status(404).json({ error: 'Support item not found.' })
    item.votes += 1
    item.priorityScore = (item.priorityScore || 0) + (item.kind === 'feature' ? 2 : 1)
    item.updatedAt = now()
    await syncGithub(item, false)
    await writeJson(files.items, items)
    res.json({ ok: true, votes: item.votes })
  })

  return router
}
