import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES, API, AUTH_TOKEN_KEY } from '../../../constants'

export default function AccountCertificatesSection({ certificates }) {
  const [downloadingId, setDownloadingId] = useState(null)

  const handleDownloadCertificate = async (courseId) => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
    if (!token) {
      alert('Чтобы скачать сертификат, войдите в аккаунт.')
      return
    }

    setDownloadingId(courseId)
    try {
      const res = await fetch(`${API.BASE}${API.COURSE_CERTIFICATE(courseId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || res.statusText || 'Не удалось скачать сертификат')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Hackpet-${courseId}-certificate.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      alert(e?.message || 'Не удалось скачать сертификат')
    } finally {
      setDownloadingId(null)
    }
  }

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
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleDownloadCertificate(c.id)}
                disabled={downloadingId === c.id}
              >
                {downloadingId === c.id ? 'Скачивание…' : 'Скачать сертификат'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
