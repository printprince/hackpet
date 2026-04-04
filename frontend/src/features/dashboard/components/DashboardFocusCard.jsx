import { useEffect, useState } from 'react'

export default function DashboardFocusCard({ checklist }) {
  const [doneMap, setDoneMap] = useState({})

  useEffect(() => {
    setDoneMap((prev) => {
      const next = {}
      checklist.forEach((item) => {
        next[item.id] = Boolean(item.done) || Boolean(prev[item.id])
      })
      return next
    })
  }, [checklist])

  const toggleTask = (taskId) => {
    setDoneMap((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  return (
    <article className="card dashboard-focus-card">
      <h2>Фокус на сегодня</h2>
      <ul className="dashboard-checklist">
        {checklist.map((item) => {
          const isDone = Boolean(doneMap[item.id])
          return (
            <li key={item.id} className={isDone ? 'done' : ''}>
              <button
                type="button"
                className={`dashboard-task-toggle ${isDone ? 'done' : ''}`}
                aria-label={isDone ? 'Отметить задачу как невыполненную' : 'Отметить задачу как выполненную'}
                onClick={() => toggleTask(item.id)}
              >
                {isDone ? '✓' : '○'}
              </button>
              <span className="dashboard-check-copy">
                <strong>{item.text}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
