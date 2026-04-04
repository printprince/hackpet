export default function ArticleToc({ items, onScrollTo }) {
  return (
    <aside className="card article-toc">
      <h3>Оглавление</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="article-toc-item"
              title={item.title}
              onClick={() => onScrollTo(item.id)}
            >
              {item.label || item.title}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
