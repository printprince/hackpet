import { PET } from '../constants'
const PET_ACTIVITY_STORAGE_KEY = 'hackpet_pet_activity_v1'
const RECENT_ACTIVITY_MS = 1000 * 60 * 5

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
 * Прогресс до следующего уровня по накопленному XP.
 * Шаг уровня: 100 XP.
 */
export function getPetProgressFromXP(xp, level) {
  if ((level || 1) >= PET.LEVEL_MAX) return 100
  const normalizedXP = Math.max(0, Number(xp) || 0)
  return Math.min(100, Math.round((normalizedXP % 100)))
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
    const min = a.minLevel || 1
    return lvl >= min
  })
}

const evolutionMax = () => Math.max(1, PET.EVOLUTION_STAGE_MAX || 5)
const EVOLUTION_LEVEL_BANDS = [
  { lo: 1, hi: 5 },
  { lo: 6, hi: 10 },
  { lo: 11, hi: 15 },
  { lo: 16, hi: 20 },
  { lo: 21, hi: 30 },
]

/**
 * Стадия эволюции внутри выбранного вида.
 * 1–5 → 1, 6–10 → 2, 11–15 → 3, 16–20 → 4, 21–30+ → 5.
 */
export function getPetEvolutionStage(level) {
  const cap = evolutionMax()
  const lvl = Math.max(0, Number(level) || 0)
  for (let i = 0; i < Math.min(cap, EVOLUTION_LEVEL_BANDS.length); i += 1) {
    const band = EVOLUTION_LEVEL_BANDS[i]
    if (lvl >= band.lo && lvl <= band.hi) return i + 1
  }
  return cap
}

export function isKnownPetVariant(id) {
  return (PET.VARIANTS || []).some((v) => v.id === id)
}

export function isKnownPetFrame(id) {
  return (PET.FRAMES || []).some((f) => f.id === id)
}

export function getPetDisplayName(pet) {
  const baseName = pet?.name || 'Hackpet'
  const variantId = pet?.equipped_variant || 'classic'
  const variant = (PET.VARIANTS || []).find((v) => v.id === variantId)
  return variant ? `[${variant.label}] ${baseName}` : baseName
}

function readPetActivity() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PET_ACTIVITY_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePetActivity(data) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PET_ACTIVITY_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota/private mode errors
  }
}

export function markPetActivity(type, at = Date.now()) {
  if (type !== 'play') return
  const prev = readPetActivity()
  writePetActivity({ ...prev, last_play_at: at })
}

export function getPetActivityStatus(options = {}) {
  const { hasActiveCourse = false, now = Date.now() } = options
  const activity = readPetActivity()
  const normalizeTs = (value) => {
    const num = Number(value) || 0
    // Поддерживаем старый формат в секундах, если где-то сохранился.
    if (num > 0 && num < 1_000_000_000_000) return num * 1000
    return num
  }
  const lastPlayAt = normalizeTs(activity.last_play_at)
  const hasRecentPlay = lastPlayAt > 0 && now - lastPlayAt <= RECENT_ACTIVITY_MS
  if (hasRecentPlay) {
    return { id: 'playing', label: 'Веселится', className: 'pet-mood-playing' }
  }
  if (hasActiveCourse) {
    return { id: 'learning', label: 'Обучается', className: 'pet-mood-growing' }
  }
  return { id: 'inactive', label: 'Спит', className: 'pet-mood-inactive' }
}

/**
 * URL спрайта: вид + стадия эволюции (фон и детализация растут вместе внутри набора).
 */
export function getPetSpriteUrl(variantId, stage) {
  const v = isKnownPetVariant(variantId) ? variantId : 'classic'
  const cap = evolutionMax()
  const s = Math.min(cap, Math.max(1, Math.floor(Number(stage) || 1)))
  return `/pet/variants/${v}/evolve-${s}.svg?v=baratnik-bg-2`
}

/** Диапазон уровней для подписи под стадией эволюции. */
export function getEvolutionLevelBand(stage) {
  const cap = evolutionMax()
  const st = Math.min(cap, Math.max(1, Math.floor(Number(stage) || 1)))
  const fallback = { lo: 1, hi: PET.LEVEL_MAX }
  const band = EVOLUTION_LEVEL_BANDS[st - 1] || fallback
  const lo = band.lo
  const hi = band.hi
  return { lo, hi, label: lo === hi ? `ур. ${lo}` : `ур. ${lo}–${hi}` }
}
