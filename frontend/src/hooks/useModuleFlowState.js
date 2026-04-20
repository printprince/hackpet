import { useState, useEffect, useCallback } from 'react'
import { get, post } from '../api'
import { PANEL_ORDER } from '../features/moduleFlow'
import { markPetActivity } from '../utils/pet'

export function useModuleFlowState({ moduleId, continueFromProgress, initialPanel, onNavigateToCourse }) {
  const initialPanelSafe = PANEL_ORDER.includes(initialPanel) ? initialPanel : 'theory'
  const [currentModule, setCurrentModule] = useState(null)
  const [panel, setPanel] = useState(initialPanelSafe)
  const [fileContents, setFileContents] = useState({})
  const [lastSubmitResult, setLastSubmitResult] = useState(null)
  const [lastLabAttemptFromApi, setLastLabAttemptFromApi] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [finalQuizAnswers, setFinalQuizAnswers] = useState({})
  const [summaryProgress, setSummaryProgress] = useState(null)
  const [savedQuizStats, setSavedQuizStats] = useState(null)
  const [maxReachedIndex, setMaxReachedIndex] = useState(() => {
    const idx = PANEL_ORDER.indexOf(initialPanelSafe)
    return idx >= 0 ? idx : 0
  })
  const [hasSeenSummary, setHasSeenSummary] = useState(false)

  useEffect(() => {
    if (!moduleId) return
    get(`/modules/${moduleId}`)
      .then((m) => {
        setCurrentModule(m)
        setLastLabAttemptFromApi(m.last_lab_attempt || null)
        setSavedQuizStats(m.quiz_stats || null)
        const contents = {}
        ;(m.lab?.files || []).forEach((f) => { contents[f.path] = f.content })
        setFileContents(contents)
        setLastSubmitResult(null)
        setQuizAnswers({})
        setQuizRevealed(false)
        setFinalQuizAnswers({})
        const prog = m.progress || {}
        let startPanel = 'theory'
        // Если модуль завершён или пользователь уже дошёл до итога — всегда показываем итог.
        if (prog.completed || prog.last_step === 'summary') {
          startPanel = 'summary'
        } else if (PANEL_ORDER.includes(initialPanel)) {
          startPanel = initialPanel
        } else if (continueFromProgress && prog.last_step && PANEL_ORDER.includes(prog.last_step)) {
          startPanel = prog.last_step
        }
        setPanel(startPanel)
        const startIdx = PANEL_ORDER.indexOf(startPanel)
        const progressIdx =
          prog.last_step && PANEL_ORDER.includes(prog.last_step)
            ? PANEL_ORDER.indexOf(prog.last_step)
            : -1
        const initialMax = Math.max(startIdx >= 0 ? startIdx : 0, progressIdx, 0)
        setMaxReachedIndex(initialMax)
        setHasSeenSummary(prog.completed || prog.last_step === 'summary')
      })
      .catch((e) => alert('Ошибка загрузки модуля: ' + e.message))
  }, [moduleId, continueFromProgress])

  useEffect(() => {
    if (initialPanel && PANEL_ORDER.includes(initialPanel)) {
      setPanel(initialPanel)
      const idx = PANEL_ORDER.indexOf(initialPanel)
      if (idx >= 0) setMaxReachedIndex((prev) => Math.max(prev, idx))
      if (initialPanel === 'summary') setHasSeenSummary(true)
    }
  }, [initialPanel])

  const saveProgress = useCallback(
    (step) => {
      if (currentModule?.id) {
        markPetActivity('study')
        post(`/modules/${currentModule.id}/progress`, { last_step: step }).catch(() => {})
      }
    },
    [currentModule?.id]
  )

  const showPanel = useCallback(
    (name) => {
      if (!PANEL_ORDER.includes(name)) return
      setPanel(name)
      const idx = PANEL_ORDER.indexOf(name)
      setMaxReachedIndex((prev) => (idx > prev ? idx : prev))
      saveProgress(name)
      if (name === 'summary') {
        setHasSeenSummary(true)
      }
    },
    [saveProgress]
  )

  const handleTryAgain = useCallback(() => {
    if (!currentModule?.id) return
    post(`/modules/${currentModule.id}/progress`, { reset: true })
      .then(() => {
        const contents = {}
        ;(currentModule.lab?.files || []).forEach((f) => { contents[f.path] = f.content })
        setFileContents(contents)
        setLastSubmitResult(null)
        setLastLabAttemptFromApi(null)
        setQuizAnswers({})
        setQuizRevealed(false)
        setFinalQuizAnswers({})
        setPanel('theory')
        setMaxReachedIndex(PANEL_ORDER.indexOf('theory'))
        setHasSeenSummary(false)
      })
      .catch(() => {})
  }, [currentModule?.id, currentModule?.lab])

  useEffect(() => {
    if (panel === 'summary' && currentModule?.id) {
      get(`/modules/${currentModule.id}`)
        .then((m) => {
          setSummaryProgress(m.progress)
          setLastLabAttemptFromApi(m.last_lab_attempt || null)
          setSavedQuizStats(m.quiz_stats || null)
        })
        .catch(() => setSummaryProgress(currentModule.progress))
    } else {
      setSummaryProgress(currentModule?.progress ?? null)
    }
  }, [panel, currentModule?.id, currentModule?.progress])

  const handleQuizAnswer = useCallback((questionIndex, value) => {
    setQuizAnswers((prev) => ({ ...prev, [questionIndex]: value }))
    const q = currentModule?.checkpoint_quiz
    const quest = (q?.questions || [])[questionIndex]
    if (q?.id && quest?.id) {
      markPetActivity('study')
      post(`/quizzes/${q.id}/answer`, { question_id: quest.id, answer: value, correct: value === quest.correct }).catch(() => {})
    }
  }, [currentModule?.checkpoint_quiz])

  const handleFinalQuizAnswer = useCallback((questionIndex, value) => {
    setFinalQuizAnswers((prev) => ({ ...prev, [questionIndex]: value }))
    const q = currentModule?.final_quiz
    const quest = (q?.questions || [])[questionIndex]
    if (q?.id && quest?.id) {
      markPetActivity('study')
      post(`/quizzes/${q.id}/answer`, {
        question_id: quest.id,
        answer: value,
        correct: value === quest.correct,
      }).catch(() => {})
    }
  }, [currentModule?.final_quiz])

  const handleLabSubmit = useCallback(() => {
    const lab = currentModule?.lab
    if (!lab) return
    // Не даём пересдавать лабу в рамках одной попытки (пока есть результат в этой сессии).
    if (lastSubmitResult) return
    const files = Object.entries(fileContents).map(([path, content]) => ({ path, content }))
    markPetActivity('study')
    post(`/labs/${lab.id}/submit`, { submission_id: `draft-${Date.now()}`, files })
      .then((res) => { setLastSubmitResult(res); showPanel('results') })
      .catch((e) => alert('Ошибка: ' + e.message))
  }, [currentModule?.lab, fileContents, showPanel, lastSubmitResult, lastLabAttemptFromApi])

  const handleLabReset = useCallback(() => {
    const lab = currentModule?.lab
    if (!lab?.files?.length) return
    const contents = {}
    lab.files.forEach((f) => { contents[f.path] = f.content })
    setFileContents(contents)
  }, [currentModule?.lab])

  const goToCourse = useCallback(() => {
    onNavigateToCourse()
  }, [onNavigateToCourse])

  const applyModuleResult = useCallback((passed) => {
    if (!currentModule?.id) return
    markPetActivity('study')
    post(`/modules/${currentModule.id}/progress`, { last_step: 'summary', completed: Boolean(passed) }).catch(() => {})
  }, [currentModule?.id])

  const effectiveLabResult = lastSubmitResult || lastLabAttemptFromApi
  const labLocked = Boolean(lastSubmitResult)

  const hasSummaryView = hasSeenSummary || panel === 'summary'
  // summary-only: после просмотра Итога — только Итог доступен (без Результата и промежуточных шагов).
  const lockMode = hasSummaryView ? 'summary-only' : 'normal'
  const finalQuizLocked = lockMode === 'summary-only'

  return {
    currentModule,
    panel,
    maxReachedIndex,
    lockMode,
    fileContents,
    lastSubmitResult,
    effectiveLabResult,
    quizAnswers,
    quizRevealed,
    finalQuizAnswers,
    summaryProgress,
    savedQuizStats,
    setFileContents,
    setQuizRevealed,
    setFinalQuizAnswers,
    showPanel,
    labLocked,
    finalQuizLocked,
    handleQuizAnswer,
    handleFinalQuizAnswer,
    handleLabSubmit,
    handleLabReset,
    handleTryAgain,
    goToCourse,
    applyModuleResult,
  }
}
