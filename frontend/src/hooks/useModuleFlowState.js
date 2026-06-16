import { useState, useEffect, useCallback, useRef } from 'react'
import { get, post } from '../api'
import { PANEL_ORDER, normalizeFlowPanel } from '../features/moduleFlow'
import { canNavigateToPanel } from '../features/moduleFlow/navigation'
import { markPetActivity } from '../utils/pet'
import {
  allQuizQuestionsAnswered,
  buildTemplateFileContents,
  clearLabDraft,
  loadLabDraft,
  mapSavedQuizAnswers,
  saveLabDraft,
} from '../utils/modulePersistence'

const POST_LAB_PANELS = new Set(['final-quiz', 'summary'])
const RESULTS_INDEX = PANEL_ORDER.indexOf('results')

function labResultPassed(result) {
  return result?.status === 'passed'
}

export function useModuleFlowState({ moduleId, userId, continueFromProgress, initialPanel, onNavigateToCourse }) {
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
  const skipLabDraftSaveRef = useRef(false)
  const moduleHydratedRef = useRef(false)

  useEffect(() => {
    if (!moduleId) return
    moduleHydratedRef.current = false
    get(`/modules/${moduleId}`)
      .then((m) => {
        setCurrentModule(m)
        setLastLabAttemptFromApi(m.last_lab_attempt || null)
        setSavedQuizStats(m.quiz_stats || null)

        const savedCheckpoint = mapSavedQuizAnswers(m.checkpoint_quiz, m.saved_quiz_answers?.checkpoint)
        const savedFinal = mapSavedQuizAnswers(m.final_quiz, m.saved_quiz_answers?.final)
        setQuizAnswers(savedCheckpoint)
        setFinalQuizAnswers(savedFinal)

        const prog = m.progress || {}
        const apiLab = m.last_lab_attempt || null
        const labPassed = labResultPassed(apiLab)
        const completed = Boolean(prog.completed)

        const templateContents = buildTemplateFileContents(m.lab)
        const draft = !labPassed && !completed ? loadLabDraft(userId, moduleId) : null
        skipLabDraftSaveRef.current = true
        setFileContents(draft ? { ...templateContents, ...draft } : templateContents)

        setLastSubmitResult(null)

        const quizIdx = PANEL_ORDER.indexOf('quiz')
        const progressIdx =
          normalizeFlowPanel(prog.last_step) != null
            ? PANEL_ORDER.indexOf(normalizeFlowPanel(prog.last_step))
            : -1
        const checkpointComplete = allQuizQuestionsAnswered(m.checkpoint_quiz, savedCheckpoint)
        setQuizRevealed(
          completed || progressIdx > quizIdx || (checkpointComplete && progressIdx >= quizIdx)
        )

        let startPanel = 'theory'
        // Завершённый модуль: уважаем initialPanel (просмотр этапа), иначе открываем Итог.
        if (normalizeFlowPanel(initialPanel)) {
          startPanel = normalizeFlowPanel(initialPanel)
        } else if (completed || prog.last_step === 'summary') {
          startPanel = 'summary'
        } else if (continueFromProgress && normalizeFlowPanel(prog.last_step)) {
          startPanel = normalizeFlowPanel(prog.last_step)
        }
        if (POST_LAB_PANELS.has(startPanel) && !labPassed && !completed) {
          startPanel = apiLab ? 'results' : 'lab'
        }
        setPanel(startPanel)
        const startIdx = PANEL_ORDER.indexOf(startPanel)
        let initialMax = completed
          ? PANEL_ORDER.length - 1
          : Math.max(startIdx >= 0 ? startIdx : 0, progressIdx, 0)
        if (!labPassed && !completed) {
          initialMax = Math.min(initialMax, RESULTS_INDEX)
        }
        setMaxReachedIndex(initialMax)
        moduleHydratedRef.current = true
      })
      .catch((e) => alert('Ошибка загрузки модуля: ' + e.message))
  }, [moduleId, userId, continueFromProgress, initialPanel])

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
    const navCtx = {
      lockMode: completed ? 'review' : 'normal',
      maxReachedIndex,
      quizRevealed,
      quizAnswers,
      checkpointQuiz: currentModule?.checkpoint_quiz,
      finalQuizAnswers,
      finalQuiz: currentModule?.final_quiz,
      effectiveLabResult: lastSubmitResult || apiLab,
      completed,
    }
    if (!completed && !canNavigateToPanel(panelName, panel, navCtx)) return
    setPanel(panelName)
    const idx = PANEL_ORDER.indexOf(panelName)
    if (idx >= 0) {
      setMaxReachedIndex((prev) => {
        const next = Math.max(prev, idx)
        return !labPassed && !completed ? Math.min(next, RESULTS_INDEX) : next
      })
    }
  }, [initialPanel, lastLabAttemptFromApi, lastSubmitResult, currentModule?.progress?.completed, maxReachedIndex, quizRevealed, quizAnswers, finalQuizAnswers, currentModule?.checkpoint_quiz, currentModule?.final_quiz, panel])

  useEffect(() => {
    if (!moduleId || !userId || !moduleHydratedRef.current) return
    if (skipLabDraftSaveRef.current) {
      skipLabDraftSaveRef.current = false
      return
    }
    const labPassed = labResultPassed(lastSubmitResult || lastLabAttemptFromApi)
    const completed = currentModule?.progress?.completed
    if (labPassed || completed) return
    if (!currentModule?.lab?.files?.length) return
    saveLabDraft(userId, moduleId, fileContents)
  }, [fileContents, moduleId, userId, lastSubmitResult, lastLabAttemptFromApi, currentModule?.progress?.completed, currentModule?.lab?.files])

  const saveProgress = useCallback(
    (step) => {
      if (currentModule?.id) {
        markPetActivity('study')
        post(`/modules/${currentModule.id}/progress`, { last_step: step }).catch(() => {})
      }
    },
    [currentModule?.id]
  )

  const effectiveLabResult = lastSubmitResult || lastLabAttemptFromApi
  const isCompletedModule = Boolean(currentModule?.progress?.completed)
  const lockMode = isCompletedModule ? 'review' : 'normal'
  const isReadOnlyReview = lockMode === 'review'

  const navigationCtx = {
    lockMode,
    maxReachedIndex,
    quizRevealed,
    quizAnswers,
    checkpointQuiz: currentModule?.checkpoint_quiz,
    finalQuizAnswers,
    finalQuiz: currentModule?.final_quiz,
    effectiveLabResult,
    completed: isCompletedModule,
  }

  const canOpenPanel = useCallback(
    (name) => canNavigateToPanel(name, panel, navigationCtx),
    [panel, navigationCtx]
  )

  const showPanel = useCallback(
    (name) => {
      if (!PANEL_ORDER.includes(name)) return
      if (!canNavigateToPanel(name, panel, navigationCtx)) return
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
        if (!completed && idx > prev) {
          saveProgress(name)
        }
        return !labPassed && !completed ? Math.min(next, RESULTS_INDEX) : next
      })
    },
    [saveProgress, lastSubmitResult, lastLabAttemptFromApi, currentModule?.progress?.completed, panel, navigationCtx]
  )

  const handleTryAgain = useCallback(() => {
    if (!currentModule?.id) return
    post(`/modules/${currentModule.id}/progress`, { reset: true })
      .then(() => {
        clearLabDraft(userId, currentModule.id)
        const contents = buildTemplateFileContents(currentModule.lab)
        skipLabDraftSaveRef.current = true
        setFileContents(contents)
        setLastSubmitResult(null)
        setLastLabAttemptFromApi(null)
        setQuizAnswers({})
        setQuizRevealed(false)
        setFinalQuizAnswers({})
        setPanel('theory')
        setMaxReachedIndex(PANEL_ORDER.indexOf('theory'))
      })
      .catch(() => {})
  }, [currentModule?.id, currentModule?.lab, userId])

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
          clearLabDraft(userId, currentModule.id)
          setPanel('results')
          setMaxReachedIndex((prev) => Math.max(prev, RESULTS_INDEX))
          saveProgress('results')
        } else {
          setPanel('results')
          setMaxReachedIndex((prev) => Math.min(Math.max(prev, RESULTS_INDEX), RESULTS_INDEX))
          saveProgress('results')
        }
      })
      .catch((e) => alert('Ошибка: ' + e.message))
  }, [currentModule?.lab, currentModule?.id, fileContents, saveProgress, lastSubmitResult, userId])

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

  const labLocked = Boolean(lastSubmitResult) || isReadOnlyReview
  const finalQuizLocked = isReadOnlyReview

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
    canOpenPanel,
    labLocked,
    finalQuizLocked,
    isReadOnlyReview,
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
