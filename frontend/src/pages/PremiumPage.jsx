import { Link } from 'react-router-dom'
import { ROUTES } from '../constants'

const FEATURES = [
  'Доступ ко всем курсам платформы',
  'Безопасность в облаке (IAM, секреты, сети)',
  'Безопасные API: OAuth, JWT, rate limiting',
  'DevSecOps: C++, Java, JavaScript',
  'Secure SDLC: SAST, DAST, code review',
  'Приоритетная поддержка',
  'Сертификаты об окончании курсов',
]

const PLANS = [
  {
    id: 'monthly',
    label: 'Месяц',
    price: '2 990 ₸',
    period: '/ месяц',
    popular: false,
  },
  {
    id: 'annual',
    label: 'Год',
    price: '19 990 ₸',
    period: '/ год',
    badge: 'Выгода 44%',
    popular: true,
  },
]

export default function PremiumPage() {
  return (
    <div className="container premium-page">
      <span className="page-eyebrow">premium</span>

      <div className="premium-hero">
        <div className="premium-hero-badge">
          <span className="premium-crown">♛</span> Premium
        </div>
        <h1 className="premium-title">Открой все курсы</h1>
        <p className="premium-subtitle">
          Получи неограниченный доступ ко всем курсам по кибербезопасности, практическим лабам и сертификатам.
        </p>
      </div>

      <div className="premium-layout">
        <div className="premium-features-block">
          <h2 className="premium-section-title">Что входит в Premium</h2>
          <ul className="premium-features-list">
            {FEATURES.map((f) => (
              <li key={f} className="premium-feature-item">
                <span className="premium-check">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="premium-plans">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`premium-plan-card${plan.popular ? ' premium-plan-popular' : ''}`}>
              {plan.badge && <span className="premium-plan-badge">{plan.badge}</span>}
              <div className="premium-plan-label">{plan.label}</div>
              <div className="premium-plan-price">
                {plan.price}
                <span className="premium-plan-period">{plan.period}</span>
              </div>
              <button className="btn btn-primary premium-plan-btn" onClick={() => alert('Оплата временно недоступна — функция в разработке.')}>
                Выбрать план
              </button>
            </div>
          ))}

          <div className="premium-mock-notice">
            <span className="premium-mock-icon">ℹ</span>
            Это демо-версия. Оплата не проводится.
          </div>
        </div>
      </div>

      <div className="premium-back">
        <Link to={ROUTES.COURSES} className="card-link">← Вернуться к курсам</Link>
      </div>
    </div>
  )
}
