import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/UserContext'
import { ROUTES } from '../constants'

export default function RegisterPage() {
  const { user, loading: authLoading, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || ROUTES.DASHBOARD
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [patronymic, setPatronymic] = useState('')
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
    if (password.length < 6) {
      setError('Пароль не менее 6 символов')
      return
    }
    if (!lastName.trim() || !firstName.trim()) {
      setError('Фамилия и имя обязательны.')
      return
    }
    setLoading(true)
    try {
      await register(email.trim().toLowerCase(), nickname.trim(), password, lastName.trim(), firstName.trim(), patronymic.trim())
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Ошибка регистрации')
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
          <span className="auth-eyebrow">auth · register</span>
          <h1>Регистрация</h1>
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
            <span className="auth-dark-icon">N</span>
            <input
              type="text"
              placeholder="Никнейм"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </label>
          <label className="auth-dark-field">
            <span className="auth-dark-icon">Ф</span>
            <input
              type="text"
              placeholder="Фамилия"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              disabled={loading}
            />
          </label>
          <label className="auth-dark-field">
            <span className="auth-dark-icon">И</span>
            <input
              type="text"
              placeholder="Имя"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              disabled={loading}
            />
          </label>
          <label className="auth-dark-field">
            <span className="auth-dark-icon">О</span>
            <input
              type="text"
              placeholder="Отчество (необязательно)"
              value={patronymic}
              onChange={(e) => setPatronymic(e.target.value)}
              autoComplete="additional-name"
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
              autoComplete="new-password"
              minLength={6}
              disabled={loading}
            />
          </label>
          <button type="submit" className="auth-dark-submit" disabled={loading}>
              {loading ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="auth-dark-footer">
          Уже есть аккаунт? <Link to={ROUTES.LOGIN}>Войти</Link>
        </p>
      </div>
    </div>
  )
}
