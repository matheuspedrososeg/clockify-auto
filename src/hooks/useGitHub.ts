import { useState, useRef } from 'react'
import { message } from 'antd'
import { useI18n } from '../i18n/useI18n'
import type { IsoDate } from '../utils/dates'
import { addDays, commitDayKey, enumerateDays } from '../utils/dates'

export interface GitHubCommit {
  sha: string
  message: string
  repo: string
  url: string
}

export type GitHubStatus = 'idle' | 'awaiting' | 'authenticated'

interface SearchCommitItem {
  sha: string
  html_url: string
  commit: { message: string; author: { date: string } }
  repository: { full_name: string }
}

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

const PER_PAGE = 100
const MAX_PAGES = 10 // the search API caps at 1000 results

export function useGitHub() {
  const { t } = useI18n()
  const [status, setStatus] = useState<GitHubStatus>(() =>
    localStorage.getItem('gh_token') ? 'authenticated' : 'idle'
  )
  const [userCode, setUserCode] = useState('')
  const [verificationUri, setVerificationUri] = useState('')
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('gh_token') ?? '')
  const [username, setUsername] = useState(() => localStorage.getItem('gh_username') ?? '')
  const [commitsCache, setCommitsCache] = useState<Map<IsoDate, GitHubCommit[]>>(new Map())
  const [commitsLoading, setCommitsLoading] = useState(false)
  const [commitsError, setCommitsError] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef(false)
  const fetchedRangeRef = useRef<string | null>(null)

  function stopPolling() {
    activeRef.current = false
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
      pollingRef.current = null
    }
  }

  async function handleConnect() {
    try {
      const res = await fetch('/github-device/code', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, scope: 'read:user repo' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      setUserCode(data.user_code)
      setVerificationUri(data.verification_uri)
      setStatus('awaiting')

      activeRef.current = true
      let interval: number = (data.interval ?? 5) + 1 // +1 as GitHub recommends

      const poll = async () => {
        if (!activeRef.current) return
        try {
          const tokenRes = await fetch('/github-oauth/access_token', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: CLIENT_ID,
              device_code: data.device_code,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
          })
          const tokenData = await tokenRes.json()

          if (tokenData.access_token) {
            stopPolling()
            const userRes = await fetch('https://api.github.com/user', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
            })
            const user = await userRes.json()
            localStorage.setItem('gh_token', tokenData.access_token)
            localStorage.setItem('gh_username', user.login)
            setAccessToken(tokenData.access_token)
            setUsername(user.login)
            setStatus('authenticated')
            message.success(t.messages.githubConnected(user.login))
            return
          }

          if (tokenData.error === 'slow_down') {
            interval = (tokenData.interval ?? interval + 5)
          } else if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
            stopPolling()
            setStatus('idle')
            message.error(tokenData.error === 'access_denied' ? t.messages.githubAccessDenied : t.messages.githubCodeExpired)
            return
          }
          // authorization_pending: keep polling normally
        } catch {
          // network error, retry
        }

        if (activeRef.current) {
          pollingRef.current = setTimeout(poll, interval * 1000)
        }
      }

      pollingRef.current = setTimeout(poll, interval * 1000)
    } catch {
      message.error(t.messages.githubConnectError)
    }
  }

  async function loadCommitsForRange(start: IsoDate, end: IsoDate): Promise<void> {
    if (!accessToken || !username) return

    const rangeKey = `${start}..${end}`
    if (fetchedRangeRef.current === rangeKey) return
    fetchedRangeRef.current = rangeKey

    setCommitsLoading(true)
    setCommitsError(false)
    try {
      // GitHub reads a bare author-date as UTC while commits are grouped by the
      // author's own offset, so pad a day on each side and drop the extras below.
      const query = [
        `author:${encodeURIComponent(username)}`,
        `author-date:${addDays(start, -1)}..${addDays(end, 1)}`,
      ].join('+')

      const items: SearchCommitItem[] = []
      let page = 1
      let total = Infinity

      while (items.length < total && page <= MAX_PAGES) {
        const res = await fetch(
          `https://api.github.com/search/commits?q=${query}&per_page=${PER_PAGE}&page=${page}&sort=author-date&order=asc`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github+json',
            },
          },
        )
        if (!res.ok) {
          if (res.status === 401) {
            message.error(t.messages.githubTokenExpired)
            disconnect()
            return
          }
          if (
            (res.status === 403 || res.status === 429) &&
            res.headers.get('x-ratelimit-remaining') === '0'
          ) {
            message.error(t.messages.githubRateLimited)
            throw new Error('rate limit')
          }
          throw new Error(`github search failed: ${res.status}`)
        }

        const data = await res.json()
        total = data.total_count ?? 0
        const batch: SearchCommitItem[] = data.items ?? []
        items.push(...batch)
        if (batch.length < PER_PAGE) break
        page++
      }

      // Seeded only after the request resolves, so days render as loading meanwhile
      // instead of falsely claiming there are no commits.
      const grouped = new Map<IsoDate, GitHubCommit[]>(
        enumerateDays(start, end).map(day => [day, []]),
      )
      for (const item of items) {
        const bucket = grouped.get(commitDayKey(item.commit.author.date))
        if (!bucket) continue
        bucket.push({
          sha: item.sha.slice(0, 7),
          message: item.commit.message.split('\n')[0],
          repo: item.repository.full_name,
          url: item.html_url,
        })
      }
      setCommitsCache(prev => new Map([...prev, ...grouped]))
    } catch {
      fetchedRangeRef.current = null
      setCommitsError(true)
      message.error(t.messages.commitsRangeError)
    } finally {
      setCommitsLoading(false)
    }
  }

  function isDayLoading(date: IsoDate): boolean {
    return commitsLoading && !commitsCache.has(date)
  }

  function disconnect() {
    stopPolling()
    localStorage.removeItem('gh_token')
    localStorage.removeItem('gh_username')
    setStatus('idle')
    setAccessToken('')
    setUsername('')
    setUserCode('')
    setVerificationUri('')
    setCommitsCache(new Map())
    setCommitsLoading(false)
    setCommitsError(false)
    fetchedRangeRef.current = null
  }

  return {
    status,
    userCode,
    verificationUri,
    username,
    commitsCache,
    commitsLoading,
    commitsError,
    isDayLoading,
    handleConnect,
    loadCommitsForRange,
    disconnect,
  }
}

export type GitHubVM = ReturnType<typeof useGitHub>
