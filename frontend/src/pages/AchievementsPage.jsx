import { useMemo } from 'react'
import { useCourseDetails } from '../hooks/useCourseDetails'
import { PROGRESS_STATUS, ACHIEVEMENT_BADGES, ROUTES } from '../constants'
import PageState from '../components/PageState'

function getCompletedCourses(courseDetails) {
  return (courseDetails || []).filter((c) => {
    const mods = c.modules || []
    return mods.length > 0 && mods.every((m) => m.progress === PROGRESS_STATUS.COMPLETED)
  })
}

function getAchievementContext(courseDetails) {
  const list = courseDetails || []
  const completedModules = list.reduce(
    (acc, c) => acc + (c.modules || []).filter((m) => m.progress === PROGRESS_STATUS.COMPLETED).length,
    0
  )
  const completedCourses = getCompletedCourses(list).length
  const totalAttempts = list.reduce(
    (acc, c) => acc + (c.modules || []).reduce((a, m) => a + (m.attempt_count || 0), 0),
    0
  )
  return { completedModules, completedCourses, totalAttempts }
}

export default function AchievementsPage() {
  const { courseDetails, loading, error } = useCourseDetails()
  const ctx = useMemo(() => getAchievementContext(courseDetails), [courseDetails])
  const unlockedBadges = useMemo(
    () => ACHIEVEMENT_BADGES.filter((b) => b.check(ctx)).length,
    [ctx]
  )
  const completionPercent = Math.round(
    ACHIEVEMENT_BADGES.length > 0 ? (unlockedBadges / ACHIEVEMENT_BADGES.length) * 100 : 0
  )

  return (
    <div className="container achievements-page">
      <span className="page-eyebrow">progress · badges</span>
      <h1>Мои достижения</h1>
      <p className="page-desc">Бейджи за прохождение курсов и модулей.</p>
      {loading && (
        <PageState
          type="empty"
          title="Загрузка достижений"
          description="Собираем прогресс по курсам."
        />
      )}
      {error && (
        <PageState
          type="error"
          title="Не удалось загрузить достижения"
          description={error.message}
          actionLabel="К курсам"
          actionTo={ROUTES.COURSES}
        />
      )}
      {!loading && !error && (
        <>
      <section className="achievements-summary card">
        <div className="achievements-ring-wrap">
          <div className="achievements-ring" style={{ '--p': `${completionPercent}%` }}>
            <strong>{completionPercent}%</strong>
          </div>
          <span className="muted">Общий прогресс</span>
        </div>
        <div className="achievements-summary-grid">
          <div className="achievements-summary-item">
            <span className="achievements-summary-label">Получено</span>
            <strong>{unlockedBadges}</strong>
          </div>
          <div className="achievements-summary-item">
            <span className="achievements-summary-label">В процессе</span>
            <strong>{Math.max(0, ACHIEVEMENT_BADGES.length - unlockedBadges)}</strong>
          </div>
        </div>
      </section>

      <section className="achievements-section">
        <h2 className="account-section-title">Бейджи</h2>
        <div className="achievements-badges">
          {ACHIEVEMENT_BADGES.map((b) => {
            const unlocked = b.check(ctx)
            return (
              <div key={b.id} className={`card badge-card ${unlocked ? 'unlocked' : 'locked'}`}>
                <span className="badge-icon" aria-hidden>{unlocked ? '✓' : '○'}</span>
                <h3>{b.title}</h3>
                <p className="badge-desc">{b.desc}</p>
                {unlocked && <span className="badge-label">Получен</span>}
              </div>
            )
          })}
        </div>
      </section>

        </>
      )}
    </div>
  )
}
