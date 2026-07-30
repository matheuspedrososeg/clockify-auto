export interface MatchCommit {
  repo: string
  message: string
}

export interface MatchProject {
  id: string
  name: string
}

export interface MatchAlias {
  repo: string
  target: string
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

const MESSAGE_WEIGHT = 0.35
const REPO_TRUST = 0.35
const REPO_MIN_TOKEN = 3
const MESSAGE_MIN_TOKEN = 4
const PROJECT_MIN_TOKEN = 2
const MIN_LENGTH_FACTOR = 0.35
const FULL_LENGTH = 8

interface Token {
  text: string
  bigrams: Set<string>
}

interface PreparedProject {
  id: string
  name: string
  compact: string
  tokens: Token[]
}

function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2))
  return set
}

function toToken(text: string): Token {
  return { text, bigrams: bigrams(text) }
}

function dice(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const gram of left) if (right.has(gram)) shared++
  return (2 * shared) / (left.size + right.size)
}

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
  return structural(a, b) || dice(bigrams(a), bigrams(b))
}

function lengthFactor(length: number): number {
  const scaled = (length - 2) / (FULL_LENGTH - 2)
  return Math.min(1, Math.max(MIN_LENGTH_FACTOR, scaled))
}

function tokenScore(a: Token, b: Token): number {
  const base = structural(a.text, b.text) || dice(a.bigrams, b.bigrams)
  return base * lengthFactor(Math.min(a.text.length, b.text.length))
}

export interface Matcher {
  best(text: string, minToken: number): ProjectMatch | null
  size: number
}

export function createMatcher(projects: MatchProject[]): Matcher {
  const prepared: PreparedProject[] = projects.map(project => {
    const normalized = normalize(project.name)
    return {
      id: project.id,
      name: project.name,
      compact: normalized.replace(/ /g, ''),
      tokens: normalized
        .split(' ')
        .filter(token => token.length >= PROJECT_MIN_TOKEN)
        .map(toToken),
    }
  })

  const tokenCache = new Map<string, number[]>()
  const textCache = new Map<string, ProjectMatch | null>()

  function scoresForToken(token: Token): number[] {
    const cached = tokenCache.get(token.text)
    if (cached) return cached
    const scores = prepared.map(project => {
      let best = 0
      for (const projectToken of project.tokens) {
        const score = tokenScore(token, projectToken)
        if (score > best) best = score
      }
      return best
    })
    tokenCache.set(token.text, scores)
    return scores
  }

  function best(text: string, minToken: number): ProjectMatch | null {
    const key = `${minToken}:${text}`
    const cached = textCache.get(key)
    if (cached !== undefined) return cached

    const normalized = normalize(text)
    const tokens = normalized
      .split(' ')
      .filter(token => token.length >= minToken)
      .map(toToken)

    const weighted = new Array<number>(prepared.length).fill(0)
    let totalLength = 0
    for (const token of tokens) {
      const scores = scoresForToken(token)
      for (let i = 0; i < prepared.length; i++) weighted[i] += scores[i] * token.text.length
      totalLength += token.text.length
    }

    const compact = normalized.replace(/ /g, '')
    let match: ProjectMatch | null = null
    for (let i = 0; i < prepared.length; i++) {
      const project = prepared[i]
      const coverage = totalLength > 0 ? weighted[i] / totalLength : 0
      const score = Math.max(structural(compact, project.compact), coverage)
      if (score <= 0) continue
      const better =
        !match ||
        score > match.score ||
        (score === match.score && project.name.localeCompare(match.projectName) < 0)
      if (better) match = { projectId: project.id, projectName: project.name, score }
    }

    textCache.set(key, match)
    return match
  }

  return { best, size: prepared.length }
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

interface AliasEntry {
  tokens: string[]
  weight: number
  target: string
}

export interface AliasIndex {
  exact: Map<string, string>
  partial: AliasEntry[]
  size: number
}

const EMPTY_ALIAS_INDEX: AliasIndex = { exact: new Map(), partial: [], size: 0 }

export function buildAliasIndex(aliases: MatchAlias[]): AliasIndex {
  const exact = new Map<string, string>()
  const partial: AliasEntry[] = []

  for (const alias of aliases) {
    const key = normalize(alias.repo)
    const target = alias.target.trim()
    if (!key || !target) continue
    exact.set(key, target)
    const tokens = key.split(' ')
    const weight = tokens.join('').length
    if (weight >= REPO_MIN_TOKEN) partial.push({ tokens, weight, target })
  }

  partial.sort((a, b) => b.weight - a.weight || a.target.localeCompare(b.target))
  return { exact, partial, size: exact.size }
}

function containsTokens(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    let hit = true
    for (let i = 0; i < needle.length; i++) {
      if (haystack[start + i] !== needle[i]) {
        hit = false
        break
      }
    }
    if (hit) return true
  }
  return false
}

function aliasFor(index: AliasIndex, fullRepo: string, repo: string): string | undefined {
  if (index.size === 0) return undefined

  const fullKey = normalize(fullRepo)
  const shortKey = normalize(repo)
  const direct = index.exact.get(shortKey) ?? index.exact.get(fullKey)
  if (direct) return direct

  const shortTokens = shortKey.split(' ')
  const fullTokens = fullKey.split(' ')
  for (const entry of index.partial) {
    if (containsTokens(shortTokens, entry.tokens) || containsTokens(fullTokens, entry.tokens)) {
      return entry.target
    }
  }
  return undefined
}

export function suggestProjectForDay(
  commits: MatchCommit[] | undefined,
  matcher: Matcher,
  aliasIndex: AliasIndex = EMPTY_ALIAS_INDEX,
): ProjectSuggestion | null {
  if (!commits || commits.length === 0 || matcher.size === 0) return null

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
    const alias = aliasFor(aliasIndex, commit.repo, repo)
    let match: ProjectMatch | null
    let weight = 1

    if (alias) {
      match = matcher.best(alias, REPO_MIN_TOKEN)
    } else {
      match = matcher.best(repo, REPO_MIN_TOKEN)
      if (!match || match.score < REPO_TRUST) {
        const fromMessage = matcher.best(commit.message, MESSAGE_MIN_TOKEN)
        if (fromMessage && (!match || fromMessage.score > match.score)) {
          match = fromMessage
          weight = MESSAGE_WEIGHT
        }
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

export function suggestProjectsForDates(
  dates: string[],
  commitsByDay: Map<string, MatchCommit[]>,
  projects: MatchProject[],
  aliases: MatchAlias[] = [],
): Map<number, ProjectSuggestion> {
  const suggestions = new Map<number, ProjectSuggestion>()
  if (projects.length === 0) return suggestions

  const matcher = createMatcher(projects)
  const aliasIndex = buildAliasIndex(aliases)
  dates.forEach((date, index) => {
    const suggestion = suggestProjectForDay(commitsByDay.get(date), matcher, aliasIndex)
    if (suggestion) suggestions.set(index, suggestion)
  })
  return suggestions
}
