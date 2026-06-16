import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { get, post } from '../api'
import { ROUTES, API, COURSE_STATUS, PROGRESS_STATUS } from '../constants'
import { useAuth } from '../context/UserContext'
import { isCourseManuallyStarted, markCourseStarted } from '../utils/courseStart'
import { markPetActivity } from '../utils/pet'
import PageState from '../components/PageState'
import { CourseSidebarNav, CourseOverviewPanel, CourseModulePanel } from '../features/courses'

export default function CourseDetailPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [course, setCourse] = useState(null)
  const [selectedModuleId, setSelectedModuleId] = useState(null) // null = обзор, '__ctf__' = CTF
  const [manualCourseStarted, setManualCourseStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ctfFlag, setCTFFlag] = useState('')
  const [ctfSubmitting, setCTFSubmitting] = useState(false)
  const [ctfError, setCTFError] = useState('')
  const [ctfSuccess, setCTFSuccess] = useState('')

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    get(API.COURSE(courseId))
      .then(setCourse)
      .catch((e) => {
        setCourse(null)
        setError(e)
      })
      .finally(() => setLoading(false))
  }, [courseId])

  useEffect(() => {
    if (!courseId) return
    setManualCourseStarted(isCourseManuallyStarted(user?.id, courseId))
  }, [courseId, user?.id])

  // Открыть CTF при переходе из оглавления модуля (state.openCTF)
  useEffect(() => {
    if (course && location.state?.openCTF && course.ctf) {
      setSelectedModuleId('__ctf__')
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [course, location.state?.openCTF, location.pathname, navigate])

  const startModule = (moduleId, continueFromProgress) => {
    markPetActivity('study')
    navigate(ROUTES.COURSE_MODULE(courseId, moduleId), { state: { continueFromProgress } })
  }

  const handleStartCourse = () => {
    if (!courseId) return
    markPetActivity('study')
    markCourseStarted(user?.id, courseId)
    setManualCourseStarted(true)
  }

  const handleCTFSubmit = async (event) => {
    event.preventDefault()
    if (!courseId || !course?.ctf || course.ctf.completed) return
    const value = ctfFlag.trim()
    if (!value) {
      setCTFError('Введите флаг.')
      setCTFSuccess('')
      return
    }
    setCTFSubmitting(true)
    setCTFError('')
    setCTFSuccess('')
    try {
      const res = await post(API.COURSE_CTF_SUBMIT(courseId), { flag: value })
      const updated = res?.course
      if (updated) {
        setCourse(updated)
      }
      markPetActivity('study')
      setCTFSuccess('Флаг принят, CTF-челлендж пройден!')
      setCTFFlag('')
    } catch (e) {
      setCTFError(e?.message || 'Не удалось отправить флаг.')
    } finally {
      setCTFSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <PageState type="empty" title="Загрузка курса" description="Подгружаем детали курса." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <PageState
          type="error"
          title="Не удалось загрузить курс"
          description={error.message}
          actionLabel="К списку курсов"
          actionTo={ROUTES.COURSES}
        />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="container">
        <PageState
          type="empty"
          title="Курс не найден"
          description="Проверьте ссылку или выберите другой курс."
          actionLabel="К списку курсов"
          actionTo={ROUTES.COURSES}
        />
      </div>
    )
  }

  const isComingSoon =
    course.status === COURSE_STATUS.COMING_SOON ||
    (course.modules && course.modules.length === 0)

  if (isComingSoon) {
    return (
      <div className="container">
        <p className="back-link-wrap">
          <Link to={ROUTES.COURSES}>← К списку курсов</Link>
        </p>
        <div className="card coming-soon-message">
          <span className="course-badge coming-soon">В разработке</span>
          <h1>{course.title}</h1>
          {course.description && <p className="page-desc">{course.description}</p>}
          <p className="muted">Модули этого курса пока готовятся. Следите за обновлениями.</p>
          <Link to={ROUTES.COURSES} className="btn btn-secondary">
            К списку курсов
          </Link>
        </div>
      </div>
    )
  }

  const modules = course.modules || []
  const progressBasedStarted = modules.some(
    (m) => (m.progress || PROGRESS_STATUS.NOT_STARTED) !== PROGRESS_STATUS.NOT_STARTED
  )
  const courseStarted = progressBasedStarted || manualCourseStarted
  const allModulesCompleted =
    modules.length > 0 && modules.every((m) => m.progress === PROGRESS_STATUS.COMPLETED)
  const rawCtf = course.ctf || null
  const ctf = rawCtf
    ? { ...rawCtf, locked: allModulesCompleted ? false : rawCtf.locked }
    : null
  const courseCompleted = typeof course.completed === 'boolean' ? course.completed : allModulesCompleted
  const selectedModule =
    selectedModuleId && selectedModuleId !== '__ctf__'
      ? modules.find((m) => m.id === selectedModuleId)
      : null

  return (
    <div className="course-detail-wrap">
      <p className="back-link-wrap course-back">
        <Link to={ROUTES.COURSES}>← К списку курсов</Link>
      </p>
      <div className="course-layout">
        <CourseSidebarNav
          courseId={courseId}
          title={course.title}
          modules={modules}
          ctf={ctf}
          selectedModuleId={selectedModuleId}
          ctfSelected={selectedModuleId === '__ctf__'}
          courseStarted={courseStarted}
          onSelectOverview={() => setSelectedModuleId(null)}
          onSelectModule={setSelectedModuleId}
          onSelectCTF={() => setSelectedModuleId('__ctf__')}
          activeModuleMaxStepIndex={null}
          lockMode="normal"
          currentPanel={null}
        />
        <main className="course-main">
          {!selectedModuleId ? (
            <CourseOverviewPanel
              title={course.title}
              description={course.description}
              courseStarted={courseStarted}
              courseCompleted={courseCompleted}
              courseId={courseId}
              onStartCourse={handleStartCourse}
            />
          ) : selectedModuleId === '__ctf__' && ctf ? (
            <div className="course-module-panel card course-ctf-panel">
              <strong className="block">CTF-челлендж</strong>
              {ctf.description && (
                <div className="course-ctf-description">
                  <p className="course-module-summary">{ctf.description}</p>
                </div>
              )}
              {!ctf.completed && ctf.stand_url && (
                <p className="course-module-summary muted">
                  Стенд откроется в новой вкладке по кнопке ниже.
                </p>
              )}
              {!ctf.completed && (
                <div className="card-actions course-ctf-actions">
                  {(() => {
                    const url = (ctf.stand_url || '').trim()
                    const isOpenable =
                      url.startsWith('http://') ||
                      url.startsWith('https://') ||
                      (url.startsWith('/') && url.length > 1)
                    if (isOpenable) {
                      return (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="btn btn-secondary"
                        >
                          Открыть стенд
                        </a>
                      )
                    }
                    if (url) {
                      return (
                        <p className="course-ctf-status muted">
                          Ссылка на стенд недействительна. Укажите в конфигурации курса URL с http:// или https://.
                        </p>
                      )
                    }
                    return (
                      <p className="course-ctf-status muted">
                        Стенд не настроен. Добавьте в конфигурацию курса поле stand_url с действительным URL (https://…), чтобы открывать стенд из интерфейса.
                      </p>
                    )
                  })()}
                </div>
              )}
              {!ctf.completed ? (
                <form className="course-ctf-form" onSubmit={handleCTFSubmit}>
                  <label className="course-ctf-label">
                    Введите найденный флаг:
                    <input
                      type="text"
                      className="course-ctf-input"
                      value={ctfFlag}
                      onChange={(e) => setCTFFlag(e.target.value)}
                      placeholder="HACKPET{...}"
                      disabled={ctfSubmitting}
                    />
                  </label>
                  <div className="course-ctf-submit-row">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={ctfSubmitting}
                    >
                      {ctfSubmitting ? 'Проверяем...' : 'Отправить флаг'}
                    </button>
                  </div>
                  {ctfError && <p className="course-ctf-status error">{ctfError}</p>}
                  {ctfSuccess && (
                    <div className="course-ctf-status success">
                      <p>{ctfSuccess}</p>
                    </div>
                  )}
                </form>
              ) : (
                <div className="course-ctf-status success">
                  <p>CTF-челлендж уже пройден.</p>
                  {courseCompleted && (
                    <p className="muted">
                      Курс полностью завершён. Сертификат доступен на странице курса и в профиле.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <CourseModulePanel
              module={selectedModule}
              onStartModule={() =>
                startModule(
                  selectedModule.id,
                  selectedModule.progress === PROGRESS_STATUS.IN_PROGRESS && Boolean(selectedModule.last_step)
                )
              }
            />
          )}
        </main>
      </div>
    </div>
  )
}
