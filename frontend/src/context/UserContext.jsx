import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { get, post, postForm } from '../api'
import { API, AUTH_TOKEN_KEY } from '../constants'

const UserContext = createContext(null)

function mapUser(u) {
  if (!u) return {}
  return {
    id: u.id,
    email: u.email || '',
    nickname: u.nickname || '',
    lastName: u.last_name || '',
    firstName: u.first_name || '',
    patronymic: u.patronymic || '',
    role: u.role || 'user',
    avatarUrl: u.avatar_url || '',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const persistToken = useCallback((token) => {
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
      else localStorage.removeItem(AUTH_TOKEN_KEY)
    }
  }, [])

  const loadMe = useCallback(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await get(API.AUTH.ME)
      setUser({
        id: data.id,
        email: data.email,
        nickname: data.nickname,
        lastName: data.last_name || '',
        firstName: data.first_name || '',
        patronymic: data.patronymic || '',
        role: data.role || 'user',
        avatarUrl: data.avatar_url || '',
      })
    } catch {
      setUser(null)
      persistToken(null)
    } finally {
      setLoading(false)
    }
  }, [persistToken])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  const login = useCallback(
    async (email, password) => {
      const data = await post(API.AUTH.LOGIN, { email, password })
      persistToken(data.token)
      setUser(mapUser(data.user))
      return data
    },
    [persistToken]
  )

  const register = useCallback(
    async (email, nickname, password, lastName, firstName, patronymic) => {
      const data = await post(API.AUTH.REGISTER, { email, nickname, password, last_name: lastName, first_name: firstName, patronymic: patronymic || '' })
      persistToken(data.token)
      setUser(mapUser(data.user))
      return data
    },
    [persistToken]
  )

  const logout = useCallback(() => {
    persistToken(null)
    setUser(null)
  }, [persistToken])

  const uploadAvatar = useCallback(async (file) => {
    if (!file) return null
    const form = new FormData()
    form.append('avatar', file)
    const data = await postForm(API.AUTH.AVATAR, form)
    if (data?.user) setUser((prev) => (prev ? { ...prev, ...mapUser(data.user) } : prev))
    return data
  }, [])

  const updateProfile = useCallback(async ({ email, nickname, last_name, first_name, patronymic }) => {
    const data = await post(API.AUTH.PROFILE, { email, nickname, last_name: last_name || '', first_name: first_name || '', patronymic: patronymic || '' })
    if (data?.user) setUser((prev) => (prev ? { ...prev, ...mapUser(data.user) } : prev))
    return data
  }, [])

  const value = { user, loading, login, register, logout, loadMe, uploadAvatar, updateProfile }
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useAuth() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** UI: { name, fullName, nickname, email, role, lastName, firstName, patronymic }. */
export function useUser() {
  const { user } = useAuth()
  if (!user) return { name: '', fullName: '', nickname: '', email: '', role: 'Гость', avatarUrl: '', lastName: '', firstName: '', patronymic: '' }
  const parts = [user.lastName, user.firstName, user.patronymic].filter(Boolean)
  const fullName = parts.join(' ') || user.nickname
  const firstName = user.firstName || user.nickname?.split(/\s+/)[0] || ''
  return {
    name: fullName || user.nickname,
    fullName,
    nickname: user.nickname || '',
    firstName,
    lastName: user.lastName || '',
    patronymic: user.patronymic || '',
    email: user.email || '',
    role: user.role === 'admin' ? 'Администратор' : 'Участник',
    avatarUrl: user.avatarUrl || '',
  }
}

/** Инициалы из ФИО или никнейма (для аватара). */
export function getUserInitials(user) {
  if (!user) return '?'
  const { lastName, firstName, patronymic, nickname } = user
  const parts = [lastName, firstName, patronymic].filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  if (nickname) return nickname.trim().slice(0, 2).toUpperCase()
  return '?'
}
