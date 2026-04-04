import { Link, Outlet } from 'react-router-dom'
import { useAuth } from './context/UserContext'
import ThemeToggle from './components/ThemeToggle'
import { ROUTES } from './constants'

export default function PublicLayout() {
  const { user } = useAuth()

  return (
    <div className="app-wrap">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-left">
            <Link to={user ? ROUTES.DASHBOARD : ROUTES.HOME} className="app-logo">
            <span className="logo-icon" aria-hidden>◆</span>
            <span className="logo-text">Hackpet</span>
          </Link>
          </div>
          <div className="app-header-right public-header-right">
            <ThemeToggle />
            <nav className="app-nav public-auth-nav" aria-label="Публичная навигация">
              {user ? (
                <Link to={ROUTES.DASHBOARD} className="public-auth-link public-auth-link-primary">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to={ROUTES.LOGIN} className="public-auth-link">Войти</Link>
                  <Link to={ROUTES.REGISTER} className="public-auth-link public-auth-link-primary">Регистрация</Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

