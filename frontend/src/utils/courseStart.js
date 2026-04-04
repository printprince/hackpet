const PREFIX = 'hackpet_started_courses_'

function getStorageKey(userId) {
  return `${PREFIX}${userId || 'guest'}`
}

function readMap(userId) {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(userId, value) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(getStorageKey(userId), JSON.stringify(value))
}

export function isCourseManuallyStarted(userId, courseId) {
  const map = readMap(userId)
  return Boolean(map[courseId])
}

export function markCourseStarted(userId, courseId) {
  const map = readMap(userId)
  map[courseId] = true
  writeMap(userId, map)
}
