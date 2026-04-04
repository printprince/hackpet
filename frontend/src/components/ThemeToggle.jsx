import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { setTheme, isDark } = useTheme()

  return (
    <button
      type="button"
      className={`theme-toggle ${isDark ? 'theme-toggle-dark' : ''}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
    >
      <span className="theme-toggle-icon theme-toggle-sun" aria-hidden>☀</span>
      <span className="theme-toggle-icon theme-toggle-moon" aria-hidden>☽</span>
    </button>
  )
}
