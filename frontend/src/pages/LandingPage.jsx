import { Navigate, Link } from 'react-router-dom'
import { ROUTES } from '../constants'
import { useAuth } from '../context/UserContext'

export default function LandingPage() {
  const { user, loading } = useAuth()
  if (!loading && user) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return (
    <div className="main-page">
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-layout">
            <div className="hero-copy">
              <span className="hero-badge">Hackpet Platform</span>
              <h1>Обучение secure coding через практику и геймификацию</h1>
              <p className="hero-desc">
                Курсы, интерактивные модули, автопроверка лаб и персональный Hackpet,
                который растет вместе с твоим прогрессом.
              </p>
              <div className="hero-actions">
                <Link to={ROUTES.REGISTER} className="btn btn-primary btn-lg">
                  Начать бесплатно
                </Link>
              </div>
            </div>
            <div className="hero-visual">
              <div className="mock-image mock-image-hero" aria-label="Заглушка изображения">
                Здесь будет главная иллюстрация
              </div>
              <div className="hero-metrics">
                <div className="hero-metric">
                  <strong>Практика</strong>
                  <span>Интерактивные лаборатории и авто-проверка</span>
                </div>
                <div className="hero-metric">
                  <strong>Трекинг</strong>
                  <span>Прогресс и достижения в одном месте</span>
                </div>
                <div className="hero-metric">
                  <strong>Hackpet</strong>
                  <span>Тренировка через геймификацию</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Как это работает</h2>
          <div className="features-grid">
            <article className="feature-card">
              <div className="mock-image mock-image-card" aria-hidden="true">Изображение</div>
              <div className="feature-icon">1</div>
              <h3>Выбираешь курс</h3>
              <p>Структурированные модули с теорией и практикой по безопасной разработке.</p>
            </article>
            <article className="feature-card">
              <div className="mock-image mock-image-card" aria-hidden="true">Изображение</div>
              <div className="feature-icon">2</div>
              <h3>Проходишь лабы</h3>
              <p>Пишешь код и получаешь автоматическую проверку по правилам безопасности.</p>
            </article>
            <article className="feature-card">
              <div className="mock-image mock-image-card" aria-hidden="true">Изображение</div>
              <div className="feature-icon">3</div>
              <h3>Видишь рост</h3>
              <p>Прогресс, достижения, сертификаты и прокачка персонального Hackpet.</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  )
}

