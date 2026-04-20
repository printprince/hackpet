import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../constants'
import { REAL_ARTICLES } from '../data/articles'
import { ArticleMediaImage } from '../features/articles'

export default function ArticlesPage() {
  const [topic, setTopic] = useState('')
  const [query, setQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const topics = useMemo(() => {
    const uniq = new Set(REAL_ARTICLES.map((a) => a.topic))
    return Array.from(uniq)
  }, [])
  const filtered = useMemo(
    () =>
      REAL_ARTICLES.filter((a) => {
        const byTopic = !topic || a.topic === topic
        const byQuery =
          !query ||
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.summary.toLowerCase().includes(query.toLowerCase())
        return byTopic && byQuery
      }),
    [topic, query]
  )

  useEffect(() => {
    function handleEsc(event) {
      if (event.key === 'Escape') setIsAddModalOpen(false)
    }
    if (isAddModalOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isAddModalOpen])

  return (
    <div className="container articles-page">
      <div className="articles-page-head">
        <h1>Статьи по кибербезопасности</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
          Добавить статью
        </button>
      </div>
      <p className="page-desc">
        Полноценные практические статьи по DevSecOps и безопасной разработке.
      </p>

      <div className="articles-search">
        <input
          type="search"
          placeholder="Поиск по заголовку или теме..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="articles-filter">
        <span className="filter-label">Тема:</span>
        <button
          type="button"
          className={`filter-pill ${!topic ? 'active' : ''}`}
          onClick={() => setTopic('')}
        >
          Все
        </button>
        {topics.map((t) => (
          <button
            key={t}
            type="button"
            className={`filter-pill ${topic === t ? 'active' : ''}`}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="articles-grid">
        {filtered.map((a) => (
          <article key={a.id} className="article-card card">
            <ArticleMediaImage article={a} variant="card" />
            <div className="article-card-top">
              <span className="article-topic">{a.topic}</span>
              <span className="article-meta">{a.level}</span>
            </div>
            <h3>{a.title}</h3>
            <p className="article-summary">{a.summary}</p>
            <p className="muted">Что внутри: {a.sections.length} практических блока + чеклист.</p>
            <div className="article-card-actions">
              <Link to={ROUTES.ARTICLE(a.id)} className="btn btn-primary btn-sm">
                Читать статью
              </Link>
            </div>
          </article>
        ))}
      </div>

      {isAddModalOpen && (
        <div className="dev-modal-overlay" role="presentation" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="dev-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-article-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="dev-modal-close"
              aria-label="Закрыть модалку"
              onClick={() => setIsAddModalOpen(false)}
            >
              ×
            </button>
            <h2 id="add-article-modal-title">Создание статьи в разработке</h2>
            <p className="muted">
              Мы уже заложили каркас для добавления материалов. Скоро здесь будет полноценный редактор статьи.
            </p>
            <div className="dev-modal-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(false)}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
