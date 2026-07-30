export interface MatchCommit {
  repo: string
  message: string
}

export interface MatchProject {
  id: string
  name: string
}

export interface ProjectSuggestion {
  projectId: string
  votes: number
  commits: number
  total: number
  topRepo: string
}

interface ProjectMatch {
  projectId: string
  projectName: string
  score: number
}

/** A repo name is a strong signal; message words only break a tie the repo could not. */
const MESSAGE_WEIGHT = 0.35
const REPO_TRUST = 0.35
const REPO_MIN_TOKEN = 3
const MESSAGE_MIN_TOKEN = 4
const PROJECT_MIN_TOKEN = 2
const MIN_LENGTH_FACTOR = 0.35
const FULL_LENGTH = 8

function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function bigrams(normalized: string): Set<string> {
  const compact = normalized.replace(/ /g, '')
  const set = new Set<string>()
  for (let i = 0; i < compact.length - 1; i++) set.add(compact.slice(i, i + 2))
  return set
}

function dice(a: string, b: string): number {
  const left = bigrams(a)
  const right = bigrams(b)
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const gram of left) if (right.has(gram)) shared++
  return (2 * shared) / (left.size + right.size)
}

/** 'ecom' vs 'ecommerce' must beat any unrelated project, so prefixes outrank bigrams. */
function structural(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length < REPO_MIN_TOKEN) return 0
  const ratio = short.length / long.length
  if (long.startsWith(short)) return 0.6 + 0.4 * ratio
  if (long.includes(short)) return 0.5 + 0.3 * ratio
  return 0
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  return structural(a, b) || dice(a, b)
}

/**
 * An abbreviation like 'seg' prefixes 'segalas' and would otherwise score as high as a
 * full word, so a token only counts in full once it is long enough to be meaningful.
 */
function lengthFactor(length: number): number {
  const scaled = (length - 2) / (FULL_LENGTH - 2)
  return Math.min(1, Math.max(MIN_LENGTH_FACTOR, scaled))
}

/**
 * Scored by how much of the text each project explains, weighted by character count:
 * in 'segalas-ecommerce' the 9 chars of 'ecommerce' must outweigh the 7 of 'segalas'.
 */
function scoreText(text: string, projectName: string, minToken: number): number {
  const left = normalize(text)
  const right = normalize(projectName)
  if (!left || !right) return 0

  // Bigrams over the whole name would score any two projects sharing the company prefix,
  // so the full string only counts when one name structurally contains the other.
  const wholeScore = structural(left.replace(/ /g, ''), right.replace(/ /g, ''))
  const textTokens = left.split(' ').filter(token => token.length >= minToken)
  const projectTokens = right.split(' ').filter(token => token.length >= PROJECT_MIN_TOKEN)
  if (textTokens.length === 0 || projectTokens.length === 0) return wholeScore

  let weighted = 0
  let totalLength = 0
  for (const textToken of textTokens) {
    let bestToken = 0
    for (const projectToken of projectTokens) {
      const score =
        similarity(textToken, projectToken) *
        lengthFactor(Math.min(textToken.length, projectToken.length))
      if (score > bestToken) bestToken = score
    }
    weighted += bestToken * textToken.length
    totalLength += textToken.length
  }

  return Math.max(wholeScore, weighted / totalLength)
}

function bestProject(
  text: string,
  projects: MatchProject[],
  minToken: number,
): ProjectMatch | null {
  let best: ProjectMatch | null = null
  for (const project of projects) {
    const score = scoreText(text, project.name, minToken)
    if (score <= 0) continue
    const better =
      !best ||
      score > best.score ||
      (score === best.score && project.name.localeCompare(best.projectName) < 0)
    if (better) best = { projectId: project.id, projectName: project.name, score }
  }
  return best
}

function shortRepo(repo: string): string {
  const parts = repo.split('/')
  return parts[parts.length - 1] || repo
}

function pickTopRepo(repos: Map<string, number>): string {
  let top = ''
  let count = -1
  for (const [repo, hits] of repos) {
    if (hits > count || (hits === count && repo.localeCompare(top) < 0)) {
      top = repo
      count = hits
    }
  }
  return top
}

export function suggestProjectForDay(
  commits: MatchCommit[] | undefined,
  projects: MatchProject[],
  repoCache: Map<string, ProjectMatch | null> = new Map(),
): ProjectSuggestion | null {
  if (!commits || commits.length === 0 || projects.length === 0) return null

  interface Tally {
    projectName: string
    votes: number
    score: number
    commits: number
    repos: Map<string, number>
  }
  const tally = new Map<string, Tally>()

  for (const commit of commits) {
    const repo = shortRepo(commit.repo)
    if (!repoCache.has(repo)) {
      repoCache.set(repo, bestProject(repo, projects, REPO_MIN_TOKEN))
    }

    let match = repoCache.get(repo) ?? null
    let weight = 1
    if (!match || match.score < REPO_TRUST) {
      const fromMessage = bestProject(commit.message, projects, MESSAGE_MIN_TOKEN)
      if (fromMessage && (!match || fromMessage.score > match.score)) {
        match = fromMessage
        weight = MESSAGE_WEIGHT
      }
    }
    if (!match) continue

    const current = tally.get(match.projectId) ?? {
      projectName: match.projectName,
      votes: 0,
      score: 0,
      commits: 0,
      repos: new Map<string, number>(),
    }
    current.votes += weight
    current.score += match.score * weight
    current.commits += 1
    current.repos.set(repo, (current.repos.get(repo) ?? 0) + 1)
    tally.set(match.projectId, current)
  }

  let winnerId = ''
  let winner: Tally | null = null
  for (const [projectId, entry] of tally) {
    const better =
      !winner ||
      entry.votes > winner.votes ||
      (entry.votes === winner.votes && entry.score > winner.score) ||
      (entry.votes === winner.votes &&
        entry.score === winner.score &&
        entry.projectName.localeCompare(winner.projectName) < 0)
    if (better) {
      winnerId = projectId
      winner = entry
    }
  }
  if (!winner) return null

  return {
    projectId: winnerId,
    votes: winner.votes,
    commits: winner.commits,
    total: commits.length,
    topRepo: pickTopRepo(winner.repos),
  }
}

export function suggestProjectsForRows(
  rows: Array<{ date: string }>,
  commitsByDay: Map<string, MatchCommit[]>,
  projects: MatchProject[],
): Map<number, ProjectSuggestion> {
  const suggestions = new Map<number, ProjectSuggestion>()
  if (projects.length === 0) return suggestions

  const repoCache = new Map<string, ProjectMatch | null>()
  rows.forEach((row, index) => {
    const suggestion = suggestProjectForDay(commitsByDay.get(row.date), projects, repoCache)
    if (suggestion) suggestions.set(index, suggestion)
  })
  return suggestions
}
