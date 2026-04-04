import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/UserContext'
import { ROUTES } from './constants'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="container">Загрузка…</div>
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />
  }

  return children
}

