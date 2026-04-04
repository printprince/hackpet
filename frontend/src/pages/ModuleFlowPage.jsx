import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Stepper,
  Theory,
  CheckpointQuiz,
  Lab,
  FixExplanation,
  FinalQuiz,
  Summary,
  ResultsPanel,
} from '../features/moduleFlow'
import { useModuleFlowState } from '../hooks/useModuleFlowState'
import { CourseSidebarNav } from '../features/courses'
import { get } from '../api'
import { API, PROGRESS_STATUS, ROUTES } from '../constants'
import { useAuth } from '../context/UserContext'
import { isCourseManuallyStarted } from '../utils/courseStart'

export default function ModuleFlowPage() {
  const { courseId, moduleId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [course, setCourse] = useState(null)
  const [courseLoading, setCourseLoading] = useState(true)

  const continueFromProgress = location.state?.continueFromProgress ?? false
  const initialPanel = location.state?.initialPanel ?? null
  const fromPrevCompleted = location.state?.fromPrevCompleted ?? false

  const flow = useModuleFlowState({
    moduleId,
    continueFromProgress,
    initialPanel,
    onNavigateToCourse: () => navigate(`/courses/${courseId}`, { replace: true }),
  })

  // Подтягиваем курс при смене courseId или moduleId, чтобы в оглавлении у пройденных модулей был актуальный прогресс (только Итог).
  useEffect(() => {
    if (!courseId) return
    setCourseLoading(true)
    get(API.COURSE(courseId))
      .then((data) => setCourse(data))
      .catch(() => setCourse(null))
      .finally(() => setCourseLoading(false))
  }, [courseId, moduleId])

  // На итоге перезапрашиваем курс, чтобы CTF разблокировался после прохождения последнего модуля.
  useEffect(() => {
    if (!courseId || flow.panel !== 'summary') return
    get(API.COURSE(courseId))
      .then((data) => setCourse(data))
      .catch(() => {})
  }, [courseId, flow.panel])

  const modules = course?.modules || []
  const progressBasedStarted = modules.some(
    (m) => (m.progress || PROGRESS_STATUS.NOT_STARTED) !== PROGRESS_STATUS.NOT_STARTED
  )
  const manualCourseStarted = isCourseManuallyStarted(user?.id, courseId)
  const courseStarted = progressBasedStarted || manualCourseStarted
  const currentModuleIndexForAll = modules.findIndex((m) => m.id === moduleId)
  const isLastModuleForCtf = currentModuleIndexForAll >= 0 && currentModuleIndexForAll === modules.length - 1
  const allOthersCompleted =
    modules.length > 1 &&
    modules.slice(0, -1).every((m) => (m.progress || PROGRESS_STATUS.NOT_STARTED) === PROGRESS_STATUS.COMPLETED)
  const allModulesCompleted =
    modules.length > 0 &&
    (modules.every((m) => (m.progress || PROGRESS_STATUS.NOT_STARTED) === PROGRESS_STATUS.COMPLETED) ||
      (isLastModuleForCtf && flow.panel === 'summary' && allOthersCompleted))
  const rawCtf = course?.ctf || null
  const ctf = rawCtf
    ? { ...rawCtf, locked: allModulesCompleted ? false : rawCtf.locked }
    : null

  useEffect(() => {
    if (courseLoading || !course || !modules.length || !moduleId) return
    const currentModuleIndex = modules.findIndex((m) => m.id === moduleId)
    const prevCompleted = currentModuleIndex <= 0 || modules[currentModuleIndex - 1]?.progress === PROGRESS_STATUS.COMPLETED
    // Если пришли на следующий модуль сразу после успешного прохождения предыдущего —
    // не делаем «откат» обратно к курсу даже если прогресс ещё не успел обновиться.
    if (currentModuleIndex >= 0 && !prevCompleted && !fromPrevCompleted) {
      navigate(`/courses/${courseId}`, { replace: true })
    }
  }, [courseLoading, course, modules, moduleId, courseId, navigate, fromPrevCompleted])

  useEffect(() => {
    // Если оказались на шаге «Результат» без данных проверки — вернуть к лабе.
    if (flow.panel === 'results' && !flow.effectiveLabResult) {
      flow.showPanel('lab')
    }
  }, [flow.panel, flow.effectiveLabResult, flow.showPanel])

  if (!flow.currentModule) return <div className="container">Загрузка модуля…</div>

  const currentModuleIndex = modules.findIndex((m) => m.id === moduleId)
  const nextModule = currentModuleIndex >= 0 && currentModuleIndex < modules.length - 1
    ? modules[currentModuleIndex + 1]
    : null
  const hasNextModule = Boolean(nextModule)
  const isLastModule = currentModuleIndex >= 0 && currentModuleIndex === modules.length - 1
  const hasCTFAfterLast = isLastModule && Boolean(ctf)

  const goToNextModuleOrCourse = () => {
    if (nextModule?.id && courseId) {
      navigate(ROUTES.COURSE_MODULE(courseId, nextModule.id), {
        state: { fromPrevCompleted: true },
      })
    } else if (hasCTFAfterLast && courseId) {
      navigate(ROUTES.COURSE(courseId), { state: { openCTF: true } })
    } else {
      navigate(ROUTES.COURSE(courseId))
    }
  }

  return (
    <div className="course-detail-wrap">
      <p className="back-link-wrap course-back">
        <Link to={`/courses/${courseId}`}>← К курсу</Link>
      </p>
      <div className="course-layout">
        {!courseLoading && course && (
          <CourseSidebarNav
            courseId={courseId}
            title={course.title}
            modules={modules}
            ctf={ctf}
            selectedModuleId={moduleId}
            ctfSelected={false}
            courseStarted={courseStarted}
            activeModuleMaxStepIndex={flow.maxReachedIndex}
            lockMode={flow.lockMode}
            currentPanel={flow.panel}
            onSelectOverview={() => navigate(`/courses/${courseId}`, { replace: true })}
            onSelectModule={(targetModuleId) => {
              if (!targetModuleId) {
                navigate(`/courses/${courseId}`, { replace: true })
                return
              }
              if (targetModuleId === moduleId) return
              navigate(`/courses/${courseId}/module/${targetModuleId}`)
            }}
            onSelectCTF={() => navigate(ROUTES.COURSE(courseId), { state: { openCTF: true } })}
          />
        )}

        <main className="course-main">
          <Stepper
            current={flow.panel}
            onStepClick={flow.showPanel}
            maxReachableStepIndex={flow.maxReachedIndex}
            lockMode={flow.lockMode}
          />
          <div className="card module-header-card">
            <h2>{flow.currentModule.title}</h2>
            <p className="meta">
              {flow.currentModule.topic}
            </p>
          </div>

          {flow.panel === 'theory' && (
            <Theory theory={flow.currentModule.theory} onNext={() => flow.showPanel('quiz')} />
          )}
          {flow.panel === 'quiz' && (
            <CheckpointQuiz
              quiz={flow.currentModule.checkpoint_quiz}
              answers={flow.quizAnswers}
              onAnswer={flow.handleQuizAnswer}
              revealed={flow.quizRevealed}
              onReveal={() => flow.setQuizRevealed(true)}
              onNextToLab={() => flow.showPanel('lab')}
            />
          )}
          {flow.panel === 'lab' && (
            <Lab
              lab={flow.currentModule.lab}
              fileContents={flow.fileContents}
              onContentChange={(path, value) => flow.setFileContents((prev) => ({ ...prev, [path]: value }))}
              onReset={flow.handleLabReset}
              onSubmit={flow.handleLabSubmit}
              locked={flow.labLocked}
            />
          )}
          {flow.panel === 'results' && (
            <ResultsPanel
              result={flow.effectiveLabResult}
              labRules={flow.currentModule.lab?.rules}
            onNext={() => flow.showPanel('fix')}
            nextLabel="Дальше →"
            />
          )}
          {flow.panel === 'fix' && (
            <FixExplanation fix={flow.currentModule.fix_explanation} onNext={() => flow.showPanel('final-quiz')} />
          )}
          {flow.panel === 'final-quiz' && (
            <FinalQuiz
              quiz={flow.currentModule.final_quiz}
              answers={flow.finalQuizAnswers}
              onAnswer={flow.handleFinalQuizAnswer}
              onNext={() => flow.showPanel('summary')}
              locked={flow.finalQuizLocked}
            />
          )}
          {flow.panel === 'summary' && (
            <Summary
              progress={flow.summaryProgress}
              lastSubmitResult={flow.effectiveLabResult}
              checkpointQuiz={flow.currentModule.checkpoint_quiz}
              checkpointQuizAnswers={flow.quizAnswers}
              finalQuizAnswers={flow.finalQuizAnswers}
              quizStats={flow.savedQuizStats}
              lab={flow.currentModule.lab}
              finalQuiz={flow.currentModule.final_quiz}
              onApplyResult={flow.applyModuleResult}
              onNextModule={goToNextModuleOrCourse}
              hasNextModule={hasNextModule}
              hasCTFNext={hasCTFAfterLast}
              onTryAgain={flow.handleTryAgain}
            />
          )}
        </main>
      </div>
    </div>
  )
}
