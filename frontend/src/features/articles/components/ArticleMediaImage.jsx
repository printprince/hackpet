/**
 * Обложка статьи: в сетке карточек и широкий баннер на странице материала.
 * Путь к файлу задаётся в данных статьи (coverImage), файлы лежат в public/articles/.
 */
export default function ArticleMediaImage({ article, variant = 'card' }) {
  const src = article?.coverImage
  if (!src) return null
  const alt = `Иллюстрация к статье «${article.title}»`

  if (variant === 'banner') {
    return (
      <div className="article-detail-banner">
        <img src={src} alt={alt} loading="lazy" width={800} height={450} decoding="async" />
      </div>
    )
  }

  return (
    <div className="article-card-cover">
      <img src={src} alt={alt} loading="lazy" width={800} height={450} decoding="async" />
    </div>
  )
}
