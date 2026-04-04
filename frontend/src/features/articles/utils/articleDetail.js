export const TOPIC_EXTENSIONS = {
  DevSecOps: {
    antiPatterns: [
      'Сканер безопасности запускается только перед релизом.',
      'Security-правила отключаются при первом ложном срабатывании.',
      'Нет владельца security-критериев в команде.',
    ],
    practice: 'Введи минимальный набор security-гейтов на PR и расширяй постепенно, когда команда привыкнет к сигналам.',
  },
  'Секреты': {
    antiPatterns: [
      'API-ключи в .env и коммитятся в репозиторий.',
      'Один и тот же секрет используется в dev/stage/prod.',
      'Логи содержат токены и Authorization заголовки.',
    ],
    practice: 'Привяжи секреты к окружению, включи ротацию и маскирование в логах как обязательный стандарт.',
  },
  'API Security': {
    antiPatterns: [
      'Проверяется только аутентификация, но не авторизация ресурса.',
      'Ошибки API раскрывают внутреннюю структуру.',
      'Отсутствует rate limiting на критичных эндпоинтах.',
    ],
    practice: 'Сделай threat-based чеклист для каждого endpoint: authn, authz, валидация, rate limit, observability.',
  },
  'Зависимости': {
    antiPatterns: [
      'Автообновления библиотек без policy.',
      'Нет SLA на исправление критичных CVE.',
      'Транзитивные зависимости не отслеживаются.',
    ],
    practice: 'Зафиксируй policy по severity и включи dependency scanning на каждом PR и nightly.',
  },
}

export function getSectionTitle(content, isScheme, idx) {
  if (isScheme) return `Схема: блок ${idx + 1}`
  const clean = String(content || '').replace(/\s+/g, ' ').trim()
  if (!clean) return `Блок ${idx + 1}`
  const firstSentence = clean.split(/[.!?]/)[0].trim()
  const title = firstSentence || clean
  return title.length > 84 ? `${title.slice(0, 84).trimEnd()}…` : title
}

function getTocLabel(title) {
  if (!title) return ''
  if (title.startsWith('Схема:')) return title
  const words = title.split(/\s+/).filter(Boolean)
  if (words.length <= 6) return title
  return `${words.slice(0, 6).join(' ')}…`
}

export function buildArticleToc(article) {
  const items = [{ id: 'article-context', title: 'Контекст', label: 'Контекст' }]
  article.sections.forEach((paragraph, idx) => {
    const isScheme = paragraph.startsWith('СХЕМА:\n')
    const content = isScheme ? paragraph.replace(/^СХЕМА:\n/, '') : paragraph
    const explicitTitle = article.sectionTitles?.[idx]
    const fullTitle = explicitTitle || getSectionTitle(content, isScheme, idx)
    items.push({
      id: `article-section-${idx + 1}`,
      title: fullTitle,
      label: getTocLabel(fullTitle),
    })
  })
  items.push({ id: 'article-antipatterns', title: 'Анти-паттерны', label: 'Анти-паттерны' })
  items.push({ id: 'article-checklist', title: 'Чеклист', label: 'Чеклист' })
  return items
}

export function getTopicExtension(topic) {
  return TOPIC_EXTENSIONS[topic] || {
    antiPatterns: ['Нет списка типичных ошибок для этой темы.'],
    practice: 'Применяй чеклист из статьи к текущему модулю или PR.',
  }
}
