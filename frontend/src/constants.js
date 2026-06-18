/**
 * Единый источник констант приложения.
 * Маршруты, статусы, подписи, лимиты — без магических строк в компонентах.
 */

/** Шрифты: единый основной стиль для всего интерфейса. */
export const FONTS = {
  HEADING: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace",
  BODY: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  MONO: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace",
}

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LOGIN: '/login',
  REGISTER: '/register',
  PLAY: '/play',
  ARTICLES: '/articles',
  ARTICLE: (id) => `/articles/${id}`,
  COURSES: '/courses',
  COURSE: (id) => `/courses/${id}`,
  COURSE_MODULE: (courseId, moduleId) => `/courses/${courseId}/module/${moduleId}`,
  ACCOUNT: '/account',
  /** Профиль с открытой вкладкой «Питомец» (имя, аура). */
  ACCOUNT_PET: '/account?section=pet',
  ACHIEVEMENTS: '/achievements',
  PREMIUM: '/premium',
}

export const AUTH_TOKEN_KEY = 'hackpet_token'

export const API = {
  BASE: '/api',
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    ME: '/auth/me',
    PROFILE: '/auth/profile',
    AVATAR: '/auth/avatar',
  },
  COURSES: '/courses',
  COURSE: (id) => `/courses/${id}`,
  COURSE_CERTIFICATE: (id) => `/courses/${id}/certificate`,
  COURSE_CTF_SUBMIT: (id) => `/courses/${id}/ctf/submit`,
  MODULES: '/modules',
  MODULE: (id) => `/modules/${id}`,
  MODULE_PROGRESS: (id) => `/modules/${id}/progress`,
  LAB_SUBMIT: (id) => `/labs/${id}/submit`,
  PET: {
    GET: '/pet',
    UPDATE_NAME: '/pet/name',
    UPDATE_AURA: '/pet/aura',
    UPDATE_VARIANT: '/pet/variant',
    UPDATE_FRAME: '/pet/frame',
  },
  FOCUS: '/focus',
  TODOS: '/todos',
  BEST_PRACTICES: '/best-practices',
  PLAY: {
    ROUND: '/play/v1/round',
    WIN: '/play/v1/win',
  },
}

export const COURSE_STATUS = {
  AVAILABLE: 'available',
  COMING_SOON: 'coming_soon',
  PREMIUM: 'premium',
}

export const PROGRESS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
}

export const PROGRESS_LABELS = {
  [PROGRESS_STATUS.NOT_STARTED]: 'Не начат',
  [PROGRESS_STATUS.IN_PROGRESS]: 'В процессе',
  [PROGRESS_STATUS.COMPLETED]: 'Пройден',
}

export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
}

export const DIFFICULTY_LABELS = {
  [DIFFICULTY.EASY]: 'Легко',
  [DIFFICULTY.MEDIUM]: 'Средне',
  [DIFFICULTY.HARD]: 'Сложно',
}

export const DIFFICULTY_OPTIONS = [DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD]

/** Дефолтный курс для ссылок, когда courseId не задан (fallback). */
export const DEFAULT_COURSE_ID = 'devsecops-go'

/** Хакпет: уровни, настроение и ауры подсветки. */
export const PET = {
  // Оставляем запас уровней под будущий рост.
  LEVEL_MAX: 50,
  MOODS: [
    { completedMin: 0, completedMax: 0, text: 'Хакпет готов к первой тренировке' },
    { completedMin: 1, completedMax: 2, text: 'Хакпет осваивается' },
    { completedMin: 3, completedMax: 5, text: 'Хакпет активно тренируется' },
    { completedMin: 6, completedMax: Infinity, text: 'Хакпет в отличной форме' },
  ],
  // Ауры подсветки для аватарки. Разлочка по уровням.
  AURAS: [
    // Уровневые ауры.
    { id: 'none', label: 'Аура 1 уровня', minLevel: 1 },
    { id: 'level3', label: 'Аура 3 уровня', minLevel: 3 },
    { id: 'level5', label: 'Аура 5 уровня', minLevel: 5 },
    // Дальше — каждые 5 уровней, начиная с 10.
    { id: 'level15', label: 'Аура 10 уровня', minLevel: 10 },
    { id: 'level25', label: 'Аура 15 уровня', minLevel: 15 },
    { id: 'level35', label: 'Аура 20 уровня', minLevel: 20 },
    { id: 'level45', label: 'Аура 25 уровня', minLevel: 25 },
    { id: 'geo_spikes', label: 'Аура 30 уровня', minLevel: 30 },
    { id: 'geo_wave', label: 'Аура 40 уровня', minLevel: 40 },
    // Ауры за достижения.
    { id: 'course1', label: 'Первый пройденный курс', minLevel: 1, unlockBy: 'course_first' },
    { id: 'course3', label: 'Три пройденных курса', minLevel: 1, unlockBy: 'courses_3' },
  ],
  /** Сколько стадий эволюции внутри одного вида (1–5, 6–10, 11–15, 16–20, 21–30). */
  EVOLUTION_STAGE_MAX: 5,
  /** Визуальные виды: у каждого свои `/pet/variants/{id}/evolve-1…5.svg`, стиль единый внутри вида. */
  VARIANTS: [
    { id: 'classic', label: 'Баратник', hint: 'Живой код-талисман: мягкий, но с характером.' },
    { id: 'neon', label: 'Киберлинк', hint: 'Техно-оболочка, неон и системные огни.' },
    { id: 'ember', label: 'Пиробайт', hint: 'Термоядро и искры: горячий боевой режим.' },
  ],
  /** Рамка вокруг круга аватара (CSS). */
  FRAMES: [
    { id: 'ring', label: 'Кольцо' },
    { id: 'chrome', label: 'Хром' },
    { id: 'soft', label: 'Мягкая' },
  ],
}

/** Бейджи достижений: id, название, описание, условие (ctx => bool). */
export const ACHIEVEMENT_BADGES = [
  { id: 'first_module', title: 'Первый модуль', desc: 'Пройден хотя бы один модуль', check: (ctx) => ctx.completedModules >= 1 },
  { id: 'full_course', title: 'Курс целиком', desc: 'Пройден хотя бы один курс полностью', check: (ctx) => ctx.completedCourses >= 1 },
  { id: 'five_modules', title: 'Пять модулей', desc: 'Пройдено 5 модулей', check: (ctx) => ctx.completedModules >= 5 },
  { id: 'ten_attempts', title: 'Упорство', desc: '10 попыток на лабах', check: (ctx) => ctx.totalAttempts >= 10 },
]

/** Маппинг языка лабы на язык Monaco Editor. */
export const MONACO_LANGUAGE = {
  go: 'go',
  python: 'python',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  cpp: 'cpp',
  'c++': 'cpp',
}

/** Подписи шагов модуля (theory, quiz, lab, …). */
export const MODULE_STEP_LABELS = {
  theory: 'Теория',
  quiz: 'Квиз',
  lab: 'Лаба',
  results: 'Результат',
  'final-quiz': 'Финальный тест',
  summary: 'Итог',
}
