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
const FINAL_QUIZ_INDEX = PANEL_ORDER.indexOf('final-quiz')

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
  const panelRef = useRef(panel)
  // Track which initialPanel value we last navigated to, so the effect only fires on actual changes.
  const lastAppliedInitialPanelRef = useRef(null)
  // Stable ref for initialPanel so the module-load effect can read it without it being a dep.
  // Using initialPanel as a dep would re-run the full module load on every sidebar step click.
  const initialPanelRef = useRef(initialPanel)
  useEffect(() => { initialPanelRef.current = initialPanel }, [initialPanel])

  useEffect(() => {
    if (!moduleId) return
    moduleHydratedRef.current = false
    // Reset lastApplied so the initialPanel effect re-applies for this module.
    lastAppliedInitialPanelRef.current = null
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

        // Use ref so sidebar step clicks (which change initialPanel) don't re-trigger this effect.
        const ip = initialPanelRef.current
        let startPanel = 'theory'
        if (normalizeFlowPanel(ip)) {
          startPanel = normalizeFlowPanel(ip)
        } else if (completed) {
          // Only auto-open Summary for truly completed modules.
          // If completed=false but last_step='summary', we drop back to final-quiz so the
          // Summary's onApplyResult does not fire again and overwrite progress on reload.
          startPanel = 'summary'
        } else if (continueFromProgress && normalizeFlowPanel(prog.last_step)) {
          const ls = normalizeFlowPanel(prog.last_step)
          // If the saved step is 'summary' but the module isn't completed, open final-quiz instead.
          startPanel = ls === 'summary' ? 'final-quiz' : ls
        }
        if (POST_LAB_PANELS.has(startPanel) && !apiLab && !completed) {
          startPanel = 'lab'
        }
        // Mark as handled so the initialPanel effect doesn't double-navigate on mount.
        lastAppliedInitialPanelRef.current = ip
        setPanel(startPanel)
        panelRef.current = startPanel
        const startIdx = PANEL_ORDER.indexOf(startPanel)
        const labSubmitted = Boolean(apiLab)
        let initialMax = completed
          ? PANEL_ORDER.length - 1
          : Math.max(startIdx >= 0 ? startIdx : 0, progressIdx, 0)
        if (!labSubmitted && !completed) {
          initialMax = Math.min(initialMax, PANEL_ORDER.indexOf('lab'))
        }
        setMaxReachedIndex(initialMax)
        moduleHydratedRef.current = true
      })
      .catch((e) => alert('Ошибка загрузки модуля: ' + e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, userId, continueFromProgress])

  // Keep panelRef in sync so the initialPanel effect can read latest panel without it being a dep.
  useEffect(() => { panelRef.current = panel }, [panel])

  // Navigate to initialPanel ONLY when initialPanel changes to a new value (e.g. sidebar/stepper click).
  // We intentionally avoid other deps to prevent this effect from resetting the panel during normal
  // flow transitions (lab submit, quiz answer, etc.).
  useEffect(() => {
    const normalized = normalizeFlowPanel(initialPanel)
    if (!normalized) return
    // Skip if we already handled this exact initialPanel value.
    if (lastAppliedInitialPanelRef.current === initialPanel) return
    // Skip until module has loaded — the module load effect already sets startPanel on mount.
    if (!moduleHydratedRef.current) return
    lastAppliedInitialPanelRef.current = initialPanel

    const apiLab = lastLabAttemptFromApi
    const labPassed = labResultPassed(lastSubmitResult || apiLab)
    const completed = currentModule?.progress?.completed
    let panelName = normalized
    if (POST_LAB_PANELS.has(panelName) && !(apiLab || lastSubmitResult) && !completed) {
      panelName = 'lab'
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
    if (!completed && !canNavigateToPanel(panelName, panelRef.current, navCtx)) return
    setPanel(panelName)
    const idx = PANEL_ORDER.indexOf(panelName)
    if (idx >= 0) {
      setMaxReachedIndex((prev) => {
        const next = Math.max(prev, idx)
        return !labPassed && !completed ? Math.min(next, FINAL_QUIZ_INDEX) : next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPanel])

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
      if (POST_LAB_PANELS.has(name) && !(lastSubmitResult || lastLabAttemptFromApi) && !completed) {
        name = 'lab'
      }
      setPanel(name)
      const idx = PANEL_ORDER.indexOf(name)
      setMaxReachedIndex((prev) => {
        const next = idx > prev ? idx : prev
        if (!completed && idx > prev) {
          saveProgress(name)
        }
        return next
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
    // Не даём пересдавать лабу если результат уже есть (в этой сессии или из БД).
    if (lastSubmitResult || lastLabAttemptFromApi) return
    const files = Object.entries(fileContents).map(([path, content]) => ({ path, content }))
    markPetActivity('study')
    post(`/labs/${lab.id}/submit`, { submission_id: `draft-${Date.now()}`, files })
      .then((res) => {
        setLastSubmitResult(res)
        clearLabDraft(userId, currentModule.id)
        setPanel('final-quiz')
        setMaxReachedIndex((prev) => Math.max(prev, FINAL_QUIZ_INDEX))
        saveProgress('final-quiz')
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
    const progressResp = await post(`/modules/${currentModule.id}/progress`, {
      last_step: 'summary',
      completed: Boolean(passed),
    }).catch(() => null)
    if (progressResp?.xp_reward) {
      window.dispatchEvent(new CustomEvent('pet:xp_gained', {
        detail: { xp: progressResp.xp_reward, pet: progressResp.pet },
      }))
    }
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

  const labLocked = Boolean(effectiveLabResult) || isReadOnlyReview
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
