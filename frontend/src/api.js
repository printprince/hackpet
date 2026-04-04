import { API, AUTH_TOKEN_KEY } from './constants'

const BASE = API.BASE

function authHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function normalizeErrorMessage(rawMessage, fallback) {
  if (!rawMessage) return fallback
  try {
    const parsed = JSON.parse(rawMessage)
    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      return parsed.message
    }
  } catch {
    // no-op: response is plain text, not JSON
  }
  return String(rawMessage).trim() || fallback
}

async function handleResponse(response) {
  const text = await response.text()
  if (!response.ok) {
    const fallback = response.statusText || 'Ошибка запроса'
    throw new Error(normalizeErrorMessage(text, fallback))
  }
  if (response.status === 204 || !text) {
    return {}
  }
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export function get(url) {
  return fetch(BASE + url, { headers: { ...authHeaders() } }).then(handleResponse)
}

export function post(url, body) {
  return fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body != null ? JSON.stringify(body) : undefined,
  }).then(handleResponse)
}

export function postForm(url, formData) {
  return fetch(BASE + url, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  }).then(handleResponse)
}
