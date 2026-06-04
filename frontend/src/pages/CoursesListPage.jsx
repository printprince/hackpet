import { Link } from 'react-router-dom'
import { useCourseDetails } from '../hooks/useCourseDetails'
import { ROUTES, COURSE_STATUS, PROGRESS_STATUS } from '../constants'
import { useAuth } from '../context/UserContext'
import { isCourseManuallyStarted } from '../utils/courseStart'
import PageState from '../components/PageState'

export default function CoursesListPage() {
  const { courses, courseDetails, loading, error } = useCourseDetails()
  const { user } = useAuth()

  const sortedCourses = (courses || []).slice().sort((a, b) => {
    const aAvailable = a.status === COURSE_STATUS.AVAILABLE
    const bAvailable = b.status === COURSE_STATUS.AVAILABLE
    if (aAvailable && !bAvailable) return -1
    if (!aAvailable && bAvailable) return 1
    return a.title.localeCompare(b.title, 'ru')
  })

  return (
    <div className="container courses-page">
      <span className="page-eyebrow">learn · courses</span>
      <h1>Курсы</h1>
      <p className="page-desc">Выберите курс, чтобы увидеть модули и начать обучение.</p>

      <div className="catalog-grid courses-grid">
        {!loading && !error && sortedCourses.map((c) => {
          const isComingSoon = c.status === COURSE_STATUS.COMING_SOON
          const details = courseDetails.find((d) => d.id === c.id)
          const allModulesCompleted =
            typeof details?.completed === 'boolean'
              ? details.completed
              : (details?.modules?.length > 0 &&
                details.modules.every((m) => m.progress === PROGRESS_STATUS.COMPLETED))
          const isStarted = !isComingSoon && !allModulesCompleted && isCourseManuallyStarted(user?.id, c.id)
          const content = (
            <>
              {isComingSoon && <span className="course-badge coming-soon">В разработке</span>}
              {!allModulesCompleted && isStarted && <span className="course-badge in-progress">Начат</span>}
              <div className="course-card-head">
                <h3>{c.title}</h3>
                {allModulesCompleted && (
                  <span className="course-badge completed course-badge-head">Пройден</span>
                )}
              </div>
              <p className="meta">{c.description || ''}</p>
              {!isComingSoon && (
                <div className="course-card-footer">
                  <span className="card-link">Подробнее →</span>
                </div>
              )}
            </>
          )
          return isComingSoon ? (
            <div key={c.id} className="course-card course-card-disabled">
              {content}
            </div>
          ) : (
            <Link key={c.id} to={ROUTES.COURSE(c.id)} className="course-card">
              {content}
            </Link>
          )
        })}
      </div>
      {loading && (
        <PageState
          type="empty"
          title="Загрузка курсов"
          description="Подгружаем каталог курсов."
        />
      )}
      {error && (
        <PageState
          type="error"
          title="Не удалось загрузить курсы"
          description={error.message}
        />
      )}
      {!loading && !error && courses.length === 0 && (
        <PageState
          type="empty"
          title="Ничего не найдено"
          description="Курсов пока нет."
        />
      )}
    </div>
  )
}
