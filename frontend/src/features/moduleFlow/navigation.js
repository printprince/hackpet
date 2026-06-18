import { PANEL_ORDER } from './constants'
import { allQuizQuestionsAnswered } from '../../utils/modulePersistence'

function labResultPassed(result) {
  return result?.status === 'passed'
}

function meetsStepEntryRequirements(panel, ctx) {
  switch (panel) {
    case 'theory':
    case 'quiz':
      return true
    case 'lab':
      return (
        ctx.quizRevealed &&
        allQuizQuestionsAnswered(ctx.checkpointQuiz, ctx.quizAnswers)
      )
    case 'final-quiz':
      return Boolean(ctx.effectiveLabResult)
    case 'summary':
      return allQuizQuestionsAnswered(ctx.finalQuiz, ctx.finalQuizAnswers)
    default:
      return false
  }
}

/** Можно ли открыть этап из текущего (степпер / сайдбар / showPanel). */
export function canNavigateToPanel(targetPanel, currentPanel, ctx) {
  const {
    lockMode,
    maxReachedIndex,
    quizRevealed,
    quizAnswers,
    checkpointQuiz,
    finalQuizAnswers,
    finalQuiz,
    effectiveLabResult,
    completed,
  } = ctx

  if (completed || lockMode === 'review') return true

  const targetIdx = PANEL_ORDER.indexOf(targetPanel)
  const currentIdx = PANEL_ORDER.indexOf(currentPanel)
  if (targetIdx < 0 || currentIdx < 0) return false

  // Текущий этап.
  if (targetIdx === currentIdx) return true

  // Жёсткие гейты проверяются всегда, даже для уже достигнутых шагов.
  // Без отправки лабы final-quiz и summary недоступны независимо от maxReachedIndex.
  if (!meetsStepEntryRequirements(targetPanel, {
    quizRevealed,
    quizAnswers,
    checkpointQuiz,
    finalQuizAnswers,
    finalQuiz,
    effectiveLabResult,
  })) return false

  // Уже достигнутый этап — доступен (назад или вперёд к пройденному).
  if (targetIdx <= maxReachedIndex) return true

  // Новый этап вперёд — только на один шаг.
  return targetIdx === currentIdx + 1
}
