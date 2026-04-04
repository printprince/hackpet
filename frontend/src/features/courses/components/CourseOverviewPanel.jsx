import { AUTH_TOKEN_KEY } from '../../../constants'

export default function CourseOverviewPanel({
  title,
  description,
  courseStarted,
  courseCompleted,
  courseId,
  onStartCourse,
}) {
  const handleDownloadCertificate = async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
    if (!token) {
      alert('Чтобы скачать сертификат, войдите в аккаунт.')
      return
    }
    try {
      const res = await fetch(`/api/courses/${courseId}/certificate`, {
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
      alert(e.message || 'Не удалось скачать сертификат')
    }
  }

  return (
    <div className="course-overview-card card">
      <h1 className="course-main-title">{title}</h1>
      {courseCompleted ? (
        <span className="course-status-started course-status-completed">Курс пройден</span>
      ) : courseStarted ? (
        <span className="course-status-started">Курс начат</span>
      ) : null}
      {description ? (
        <div className="course-description">
          <p>{description}</p>
        </div>
      ) : null}
      <p className="muted course-main-note">
        {courseCompleted
          ? 'Поздравляем — вы прошли весь курс. Ниже доступен сертификат, а модули можно открыть в меню слева, чтобы пересмотреть итоги.'
          : courseStarted
            ? 'Курс активирован. Выберите модуль в меню слева.'
            : 'Сначала нажмите «Начать курс». После старта дерево модулей разблокируется.'}
      </p>
      <div className="card-actions">
        {!courseStarted && !courseCompleted ? (
          <button type="button" className="btn btn-primary" onClick={onStartCourse}>
            Начать курс
          </button>
        ) : null}
        {courseCompleted && (
          <button type="button" className="btn btn-secondary" onClick={handleDownloadCertificate}>
            Скачать сертификат
          </button>
        )}
      </div>
    </div>
  )
}
