import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '../constants'
import { getArticleById, getRelatedArticles } from '../data/articles'
import PageState from '../components/PageState'
import {
  buildArticleToc,
  getSectionTitle,
  getTopicExtension,
  ArticleToc,
  RelatedArticlesSection,
  ArticleMediaImage,
} from '../features/articles'

export default function ArticleDetailPage() {
  const { articleId } = useParams()
  const article = getArticleById(articleId)
  const related = getRelatedArticles(articleId, 3)
  const extension = getTopicExtension(article?.topic)

  if (!article) {
    return (
      <div className="container articles-page">
        <PageState
          type="empty"
          title="Статья не найдена"
          description="Проверьте ссылку или вернитесь к списку статей."
          actionLabel="К статьям"
          actionTo={ROUTES.ARTICLES}
        />
      </div>
    )
  }
  const tocItems = buildArticleToc(article)
  const scrollToBlock = (id) => {
    const element = document.getElementById(id)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="container articles-page">
      <p className="back-link-wrap">
        <Link to={ROUTES.ARTICLES}>← К списку статей</Link>
      </p>
      <div className="article-detail-layout">
        <ArticleToc items={tocItems} onScrollTo={scrollToBlock} />

        <article className="card article-detail-card">
          <div className="article-card-top">
            <span className="article-topic">{article.topic}</span>
            <span className="article-meta">{article.level}</span>
          </div>
          <h1>{article.title}</h1>
          <p className="article-summary">{article.summary}</p>
          <ArticleMediaImage article={article} variant="banner" />

          <section className="article-content">
            <h3 id="article-context">Контекст</h3>
            <p>
              Этот материал ориентирован на практику: как внедрить контроль безопасности в реальный
              цикл разработки и снизить риск регрессий в production.
            </p>
            {article.sections.map((paragraph, idx) => {
              const isScheme = paragraph.startsWith('СХЕМА:\n')
              const content = isScheme ? paragraph.replace(/^СХЕМА:\n/, '') : paragraph
              const explicitTitle = article.sectionTitles?.[idx]
              return (
                <div id={`article-section-${idx + 1}`} key={`${article.id}-p-${idx}`} className="article-block">
                  <h4>{explicitTitle || getSectionTitle(content, isScheme, idx)}</h4>
                  {isScheme ? (
                    <pre className="article-scheme">{content}</pre>
                  ) : (
                    <p>{content}</p>
                  )}
                </div>
              )
            })}
          </section>

          <section id="article-antipatterns" className="article-checklist article-antipatterns">
            <strong>Анти-паттерны</strong>
            <ul className="bullets">
              {extension.antiPatterns.map((item, idx) => (
                <li key={`${article.id}-a-${idx}`}>{item}</li>
              ))}
            </ul>
            <p className="muted"><strong>Совет:</strong> {extension.practice}</p>
          </section>

          <section id="article-checklist" className="article-checklist">
            <strong>Чеклист</strong>
            <ul className="bullets">
              {article.checklist.map((item, idx) => (
                <li key={`${article.id}-c-${idx}`}>{item}</li>
              ))}
            </ul>
          </section>
        </article>
      </div>
      <RelatedArticlesSection related={related} />
    </div>
  )
}
