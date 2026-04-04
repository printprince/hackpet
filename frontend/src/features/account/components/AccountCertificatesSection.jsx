import { Link } from 'react-router-dom'
import { ROUTES, API } from '../../../constants'

export default function AccountCertificatesSection({ certificates }) {
  return (
    <section className="account-section account-certificates-section">
      <h2 className="account-section-title">Сертификаты</h2>
      {certificates.length === 0 ? (
        <div className="card achievements-empty">
          <p className="muted">Пройдите все модули курса, чтобы получить сертификат.</p>
          <Link to={ROUTES.COURSES} className="btn btn-secondary page-state-action">
            К курсам
          </Link>
        </div>
      ) : (
        <div className="achievements-cert-grid">
          {certificates.map((c) => (
            <div key={c.id} className="card cert-item">
              <span className="cert-item-icon">📜</span>
              <h3>{c.title}</h3>
              <p className="muted">Курс пройден полностью</p>
              <a
                href={`${API.BASE}${API.COURSE_CERTIFICATE(c.id)}`}
                className="btn btn-primary btn-sm"
                download
                target="_blank"
                rel="noreferrer"
              >
                Скачать сертификат
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
