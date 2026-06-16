/** Маппинг сохранённых ответов API (question_id → индекс) в локальный формат { questionIndex → answerIndex }. */
export function mapSavedQuizAnswers(quiz, savedByQuestionId) {
  if (!quiz?.questions?.length || !savedByQuestionId) return {}
  const out = {}
  quiz.questions.forEach((q, i) => {
    if (q.id != null && savedByQuestionId[q.id] != null) {
      out[i] = savedByQuestionId[q.id]
    }
  })
  return out
}

export function allQuizQuestionsAnswered(quiz, answers) {
  const questions = quiz?.questions || []
  return questions.length > 0 && questions.every((_, i) => answers[i] != null)
}

function labDraftKey(userId, moduleId) {
  return `hackpet:lab-draft:${userId || 'anon'}:${moduleId}`
}

export function loadLabDraft(userId, moduleId) {
  try {
    const raw = localStorage.getItem(labDraftKey(userId, moduleId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLabDraft(userId, moduleId, fileContents) {
  try {
    localStorage.setItem(labDraftKey(userId, moduleId), JSON.stringify(fileContents))
  } catch {
    /* ignore quota */
  }
}

export function clearLabDraft(userId, moduleId) {
  try {
    localStorage.removeItem(labDraftKey(userId, moduleId))
  } catch {
    /* ignore */
  }
}

export function buildTemplateFileContents(lab) {
  const contents = {}
  ;(lab?.files || []).forEach((f) => {
    contents[f.path] = f.content
  })
  return contents
}
