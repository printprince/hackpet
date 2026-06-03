import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from './context/UserContext'
import ThemeToggle from './components/ThemeToggle'
import DemoTour from './components/DemoTour'
import { ROUTES } from './constants'

export default function Layout() {
  const loc = useLocation()
  const { user, logout } = useAuth()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isDemoOpen, setIsDemoOpen] = useState(false)
  const userMenuRef = useRef(null)
  const isActive = (path) => loc.pathname === path || (path !== '/' && loc.pathname.startsWith(path))

  useEffect(() => {
    function handleClickOutside(event) {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false)
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setIsUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const avatarUrl = user?.avatarUrl || ''

  return (
    <div className="app-wrap">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-left">
            <Link to={ROUTES.DASHBOARD} className="app-logo">
              <span className="logo-icon" aria-hidden>◆</span>
              <span className="logo-text">Hackpet</span>
            </Link>
          </div>

          <nav className="app-nav app-nav-centered" aria-label="Основная навигация">
            <Link to={ROUTES.DASHBOARD} className={isActive(ROUTES.DASHBOARD) ? 'active' : ''}>Dashboard</Link>
            <Link to={ROUTES.COURSES} className={isActive(ROUTES.COURSES) ? 'active' : ''}>Курсы</Link>
            <Link
              to={ROUTES.PLAY}
              className={`play-nav-btn ${isActive(ROUTES.PLAY) ? 'active' : ''}`}
            >
              Play
            </Link>
            <Link to={ROUTES.ARTICLES} className={isActive(ROUTES.ARTICLES) ? 'active' : ''}>Статьи</Link>
            <Link to={ROUTES.ACHIEVEMENTS} className={isActive(ROUTES.ACHIEVEMENTS) ? 'active' : ''}>Достижения</Link>
          </nav>

          <div className="app-header-right">
            <button type="button" className="demo-launch-btn" onClick={() => setIsDemoOpen(true)}>
              Демо
            </button>
            <div className="app-user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="app-user-trigger"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Аватар пользователя" className="app-user-avatar" />
                ) : (
                  <span className="app-user-avatar app-user-avatar-default" aria-hidden="true">👤</span>
                )}
                <span className="app-user-chevron" aria-hidden="true">{isUserMenuOpen ? '▴' : '▾'}</span>
              </button>

              {isUserMenuOpen && (
                <div className="app-user-dropdown" role="menu">
                  <Link to={ROUTES.ACCOUNT} className="app-user-dropdown-item" role="menuitem" onClick={() => setIsUserMenuOpen(false)}>
                    Профиль
                  </Link>
                  <button
                    type="button"
                    className="app-user-dropdown-item danger"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      logout()
                    }}
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <DemoTour isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </div>
  )
}
