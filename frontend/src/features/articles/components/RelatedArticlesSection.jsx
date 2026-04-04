import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants'

export default function RelatedArticlesSection({ related }) {
  if (related.length === 0) return null

  return (
    <section className="articles-related">
      <h2 className="section-title">Читать дальше</h2>
      <div className="articles-grid">
        {related.map((item) => (
          <article key={item.id} className="article-card card">
            <div className="mock-image mock-image-article" aria-label="Заглушка обложки статьи">
              Обложка статьи
            </div>
            <div className="article-card-top">
              <span className="article-topic">{item.topic}</span>
              <span className="article-meta">{item.level}</span>
            </div>
            <h3>{item.title}</h3>
            <p className="article-summary">{item.summary}</p>
            <div className="article-card-actions">
              <Link to={ROUTES.ARTICLE(item.id)} className="btn btn-primary btn-sm">
                Читать
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
