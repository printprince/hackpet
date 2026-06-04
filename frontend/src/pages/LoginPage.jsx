import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/UserContext'
import { ROUTES } from '../constants'

export default function LoginPage() {
  const { user, loading: authLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || ROUTES.DASHBOARD
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      navigate(ROUTES.DASHBOARD, { replace: true })
    }
  }, [authLoading, user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-dark-page">
      <div className="auth-dark-card">
        <div className="auth-top-row">
          <Link to={ROUTES.HOME} className="auth-back-link">← На главную</Link>
        </div>
        <div className="auth-dark-head">
          <span className="auth-eyebrow">auth · login</span>
          <h1>Вход</h1>
        </div>
        {error && <p className="form-error">{error}</p>}
        <form onSubmit={handleSubmit} className="auth-dark-form">
          <label className="auth-dark-field">
            <span className="auth-dark-icon">@</span>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </label>
          <label className="auth-dark-field">
            <span className="auth-dark-icon">*</span>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
              disabled={loading}
            />
          </label>
          <button type="submit" className="auth-dark-submit" disabled={loading}>
              {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
        <p className="auth-dark-footer">
          Нет аккаунта? <Link to={ROUTES.REGISTER}>Создать</Link>
        </p>
      </div>
    </div>
  )
}
