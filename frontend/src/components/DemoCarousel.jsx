import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_TOUR_STEPS } from '../data/demoTour'
import { ROUTES } from '../constants'
import { useAuth } from '../context/UserContext'

/**
 * Карусель пошагового демо по платформе.
 * Переиспользуется и в модалке (DemoTour), и инлайн на лендинге.
 *
 * @param {boolean} [enableKeyboard] — навигация стрелками ← →
 * @param {string}  [lastActionLabel] — подпись правой кнопки на последнем шаге
 * @param {() => void} [onLastAction] — действие правой кнопки на последнем шаге (по умолчанию — в начало)
 * @param {() => void} [onCtaNavigate] — колбэк при клике по CTA-ссылкам (например, закрыть модалку)
 */
export default function DemoCarousel({
  enableKeyboard = false,
  lastActionLabel = 'В начало',
  onLastAction,
  onCtaNavigate,
}) {
  const { user } = useAuth()
  const [index, setIndex] = useState(0)
  const total = DEMO_TOUR_STEPS.length
  const isLast = index === total - 1

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total])
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    if (!enableKeyboard) return
    function onKey(e) {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enableKeyboard, goNext, goPrev])

  const step = DEMO_TOUR_STEPS[index]

  return (
    <>
      <div className="demo-tour-media">
        {step.gallery ? (
          <div className="demo-tour-gallery">
            {step.gallery.map((src, i) => (
              <img key={src} src={src} alt={`Стадия эволюции ${i + 1}`} loading="lazy" decoding="async" />
            ))}
          </div>
        ) : (
          <img src={step.image} alt={step.title} loading="lazy" decoding="async" />
        )}
      </div>

      <div className="demo-tour-body">
        <span className="demo-tour-tag">{step.tag}</span>
        <h2 className="demo-tour-title">{step.title}</h2>
        <p className="demo-tour-lead">{step.lead}</p>
        <ul className="demo-tour-points">
          {step.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>

        {isLast && (
          <div className="demo-tour-cta">
            {user ? (
              <Link to={ROUTES.DASHBOARD} className="btn btn-primary" onClick={onCtaNavigate}>
                Перейти в Dashboard
              </Link>
            ) : (
              <>
                <Link to={ROUTES.REGISTER} className="btn btn-primary" onClick={onCtaNavigate}>
                  Начать бесплатно
                </Link>
                <Link to={ROUTES.LOGIN} className="btn btn-ghost" onClick={onCtaNavigate}>
                  Войти
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="demo-tour-footer">
        <button type="button" className="btn btn-ghost btn-sm" onClick={goPrev} disabled={index === 0}>
          Назад
        </button>

        <div className="demo-tour-dots" role="tablist" aria-label="Шаги демо">
          {DEMO_TOUR_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`demo-tour-dot ${i === index ? 'is-active' : ''}`}
              aria-label={`Шаг ${i + 1}: ${s.title}`}
              aria-selected={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        {isLast ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => (onLastAction ? onLastAction() : setIndex(0))}
          >
            {lastActionLabel}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={goNext}>
            Далее ({index + 1}/{total})
          </button>
        )}
      </div>
    </>
  )
}
