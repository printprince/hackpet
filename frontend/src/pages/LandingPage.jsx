import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ROUTES } from '../constants'
import { useAuth } from '../context/UserContext'
import DemoTour from '../components/DemoTour'
import DemoCarousel from '../components/DemoCarousel'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const [isDemoOpen, setIsDemoOpen] = useState(false)
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
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={() => setIsDemoOpen(true)}
                >
                  Открыть демо на весь экран
                </button>
              </div>
            </div>
            <div className="hero-visual hero-visual--demo" aria-label="Интерактивное демо платформы">
              <DemoCarousel lastActionLabel="В начало" />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Как это работает</h2>
          <div className="features-grid">
            <article className="feature-card">
              <div className="feature-media">
                <img
                  src="/landing/feature-course-path.svg"
                  alt="Путь обучения: курс и модули"
                  loading="lazy"
                  decoding="async"
                  width="800"
                  height="450"
                />
              </div>
              <div className="feature-icon">1</div>
              <h3>Выбираешь курс</h3>
              <p>Структурированные модули с теорией и практикой по безопасной разработке.</p>
            </article>
            <article className="feature-card">
              <div className="feature-media">
                <img
                  src="/landing/feature-lab-validation.svg"
                  alt="Лаборатория с автоматической проверкой безопасности"
                  loading="lazy"
                  decoding="async"
                  width="800"
                  height="450"
                />
              </div>
              <div className="feature-icon">2</div>
              <h3>Проходишь лабы</h3>
              <p>Пишешь код и получаешь автоматическую проверку по правилам безопасности.</p>
            </article>
            <article className="feature-card">
              <div className="feature-media">
                <img
                  src="/landing/feature-growth-pet.svg"
                  alt="Рост прогресса, достижения и прокачка Hackpet"
                  loading="lazy"
                  decoding="async"
                  width="800"
                  height="450"
                />
              </div>
              <div className="feature-icon">3</div>
              <h3>Видишь рост</h3>
              <p>Прогресс, достижения, сертификаты и прокачка персонального Hackpet.</p>
            </article>
          </div>
        </div>
      </section>

      <DemoTour isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </div>
  )
}

