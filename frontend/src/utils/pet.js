import { PET } from '../constants'

/**
 * Уровень Хакпета от числа пройденных модулей (1..LEVEL_MAX).
 */
export function getPetLevel(completedCount) {
  return Math.min(PET.LEVEL_MAX, 1 + (completedCount || 0))
}

/**
 * Текст состояния питомца по числу пройденных модулей.
 */
export function getPetMood(completedCount) {
  const n = completedCount ?? 0
  const found = PET.MOODS.find((m) => n >= m.completedMin && n <= m.completedMax)
  return found ? found.text : PET.MOODS[0].text
}

/**
 * Процент прогресса до следующего уровня (0..100).
 * На макс. уровне возвращаем 100.
 */
export function getPetProgressToNext(completedCount, level) {
  if (level >= PET.LEVEL_MAX) return 100
  if (level <= 0) return 0
  return Math.min(100, Math.round(((completedCount ?? 0) / level) * 100))
}

/**
 * Текущая активная аура по уровню питомца.
 * Берём последнюю из AURAS, чей minLevel <= level.
 */
export function getPetAura(level) {
  const lvl = level || 1
  const auras = (PET.AURAS || []).filter((a) => !a.unlockBy || a.unlockBy === 'level')
  let current = auras[0] || { id: 'none', label: 'Базовая аура', minLevel: 1 }
  for (const aura of auras) {
    if (lvl >= aura.minLevel && aura.minLevel >= current.minLevel) {
      current = aura
    }
  }
  return current
}

/**
 * Список всех уже разблокированных аур по текущему уровню.
 */
export function getUnlockedPetAuras(level, options = {}) {
  const { completedCourses = 0 } = options
  const lvl = level || 1
  return (PET.AURAS || []).filter((a) => {
    if (a.unlockBy === 'course_first') {
      return completedCourses >= 1
    }
    if (a.unlockBy === 'courses_3') {
      return completedCourses >= 3
    }
    // Дефолт — уровневые ауры.
    const min = a.minLevel || 1
    return lvl >= min
  })
}
