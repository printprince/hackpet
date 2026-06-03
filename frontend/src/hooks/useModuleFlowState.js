import { useState, useEffect, useCallback } from 'react'
import { get, post } from '../api'
import { PANEL_ORDER, normalizeFlowPanel } from '../features/moduleFlow'
import { markPetActivity } from '../utils/pet'

const POST_LAB_PANELS = new Set(['final-quiz', 'summary'])
const RESULTS_INDEX = PANEL_ORDER.indexOf('results')

function labResultPassed(result) {
  return result?.status === 'passed'
}

export function useModuleFlowState({ moduleId, continueFromProgress, initialPanel, onNavigateToCourse }) {
  const initialPanelSafe = normalizeFlowPanel(initialPanel) || 'theory'
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
        const apiLab = m.last_lab_attempt || null
        const labPassed = labResultPassed(apiLab)
        let startPanel = 'theory'
        // Если модуль завершён или пользователь уже дошёл до итога — всегда показываем итог.
        if (prog.completed || prog.last_step === 'summary') {
          startPanel = 'summary'
        } else if (normalizeFlowPanel(initialPanel)) {
          startPanel = normalizeFlowPanel(initialPanel)
        } else if (continueFromProgress && normalizeFlowPanel(prog.last_step)) {
          startPanel = normalizeFlowPanel(prog.last_step)
        }
        if (POST_LAB_PANELS.has(startPanel) && !labPassed && !prog.completed) {
          startPanel = apiLab ? 'results' : 'lab'
        }
        setPanel(startPanel)
        const startIdx = PANEL_ORDER.indexOf(startPanel)
        const progressIdx =
          normalizeFlowPanel(prog.last_step) != null
            ? PANEL_ORDER.indexOf(normalizeFlowPanel(prog.last_step))
            : -1
        let initialMax = Math.max(startIdx >= 0 ? startIdx : 0, progressIdx, 0)
        if (!labPassed && !prog.completed) {
          initialMax = Math.min(initialMax, RESULTS_INDEX)
        }
        setMaxReachedIndex(initialMax)
        setHasSeenSummary(prog.completed || prog.last_step === 'summary')
      })
      .catch((e) => alert('Ошибка загрузки модуля: ' + e.message))
  }, [moduleId, continueFromProgress])

  useEffect(() => {
    const normalized = normalizeFlowPanel(initialPanel)
    if (!normalized) return
    const apiLab = lastLabAttemptFromApi
    const labPassed = labResultPassed(lastSubmitResult || apiLab)
    const completed = currentModule?.progress?.completed
    let panelName = normalized
    if (POST_LAB_PANELS.has(panelName) && !labPassed && !completed) {
      panelName = apiLab || lastSubmitResult ? 'results' : 'lab'
    }
    setPanel(panelName)
    const idx = PANEL_ORDER.indexOf(panelName)
    if (idx >= 0) {
      setMaxReachedIndex((prev) => {
        const next = Math.max(prev, idx)
        return !labPassed && !completed ? Math.min(next, RESULTS_INDEX) : next
      })
    }
    if (panelName === 'summary') setHasSeenSummary(true)
  }, [initialPanel, lastLabAttemptFromApi, lastSubmitResult, currentModule?.progress?.completed])

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
      const labPassed = labResultPassed(lastSubmitResult || lastLabAttemptFromApi)
      const completed = currentModule?.progress?.completed
      if (POST_LAB_PANELS.has(name) && !labPassed && !completed) {
        if (lastSubmitResult || lastLabAttemptFromApi) {
          name = 'results'
        } else {
          name = 'lab'
        }
      }
      setPanel(name)
      const idx = PANEL_ORDER.indexOf(name)
      setMaxReachedIndex((prev) => {
        const next = idx > prev ? idx : prev
        return !labPassed && !completed ? Math.min(next, RESULTS_INDEX) : next
      })
      saveProgress(name)
      if (name === 'summary') {
        setHasSeenSummary(true)
      }
    },
    [saveProgress, lastSubmitResult, lastLabAttemptFromApi, currentModule?.progress?.completed]
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

  const persistQuizAnswer = useCallback((quiz, questionIndex, value) => {
    const quest = (quiz?.questions || [])[questionIndex]
    if (!quiz?.id || !quest?.id || value == null) return Promise.resolve()
    markPetActivity('study')
    return post(`/quizzes/${quiz.id}/answer`, {
      question_id: quest.id,
      answer: value,
      correct: value === quest.correct,
    }).catch(() => {})
  }, [])

  const syncCheckpointQuizAnswers = useCallback(() => {
    const q = currentModule?.checkpoint_quiz
    const questions = q?.questions || []
    return Promise.all(
      questions.map((_, i) =>
        quizAnswers[i] != null ? persistQuizAnswer(q, i, quizAnswers[i]) : Promise.resolve()
      )
    )
  }, [currentModule?.checkpoint_quiz, quizAnswers, persistQuizAnswer])

  const syncFinalQuizAnswers = useCallback(() => {
    const q = currentModule?.final_quiz
    const questions = q?.questions || []
    return Promise.all(
      questions.map((_, i) =>
        finalQuizAnswers[i] != null ? persistQuizAnswer(q, i, finalQuizAnswers[i]) : Promise.resolve()
      )
    )
  }, [currentModule?.final_quiz, finalQuizAnswers, persistQuizAnswer])

  const handleQuizAnswer = useCallback((questionIndex, value) => {
    setQuizAnswers((prev) => ({ ...prev, [questionIndex]: value }))
    const q = currentModule?.checkpoint_quiz
    const quest = (q?.questions || [])[questionIndex]
    persistQuizAnswer(q, questionIndex, value)
  }, [currentModule?.checkpoint_quiz, persistQuizAnswer])

  const handleFinalQuizAnswer = useCallback((questionIndex, value) => {
    setFinalQuizAnswers((prev) => ({ ...prev, [questionIndex]: value }))
    const q = currentModule?.final_quiz
    const quest = (q?.questions || [])[questionIndex]
    persistQuizAnswer(q, questionIndex, value)
  }, [currentModule?.final_quiz, persistQuizAnswer])

  const handleLabSubmit = useCallback(() => {
    const lab = currentModule?.lab
    if (!lab) return
    // Не даём пересдавать лабу в рамках одной попытки (пока есть результат в этой сессии).
    if (lastSubmitResult) return
    const files = Object.entries(fileContents).map(([path, content]) => ({ path, content }))
    markPetActivity('study')
    post(`/labs/${lab.id}/submit`, { submission_id: `draft-${Date.now()}`, files })
      .then((res) => {
        setLastSubmitResult(res)
        if (labResultPassed(res)) {
          showPanel('results')
        } else {
          setPanel('results')
          setMaxReachedIndex((prev) => Math.min(Math.max(prev, RESULTS_INDEX), RESULTS_INDEX))
          saveProgress('results')
        }
      })
      .catch((e) => alert('Ошибка: ' + e.message))
  }, [currentModule?.lab, fileContents, showPanel, saveProgress, lastSubmitResult])

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

  const applyModuleResult = useCallback(async (passed) => {
    if (!currentModule?.id) return
    markPetActivity('study')
    await Promise.all([syncCheckpointQuizAnswers(), syncFinalQuizAnswers()])
    await post(`/modules/${currentModule.id}/progress`, {
      last_step: 'summary',
      completed: Boolean(passed),
    }).catch(() => {})
    try {
      const m = await get(`/modules/${currentModule.id}`)
      setSummaryProgress(m.progress)
      setSavedQuizStats(m.quiz_stats || null)
      setLastLabAttemptFromApi(m.last_lab_attempt || null)
      setCurrentModule((prev) => (prev ? { ...prev, progress: m.progress } : prev))
    } catch {
      /* ignore */
    }
  }, [
    currentModule?.id,
    syncCheckpointQuizAnswers,
    syncFinalQuizAnswers,
  ])

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
    syncCheckpointQuizAnswers,
    syncFinalQuizAnswers,
  }
}
