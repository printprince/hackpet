import { useCallback, useEffect, useRef, useState } from 'react'
import { get, post } from '../api'
import { API } from '../constants'
import PlaySnippetViewer from './PlaySnippetViewer'

const GRID_SIZE = 6
const GAME_DURATION = 60
const HIT_SCORE = 10
const MISS_PENALTY = 5
const SCORE_FLOOR = -10  // игра проиграна при достижении этого счёта
const COMBO_THRESHOLD = 3
const COMBO_BONUS = 5
const AUTO_ROTATE_MS = 8000
const ANIM_HIT_MS = 500
const ANIM_MISS_MS = 800

let uid = 0
const nextId = () => ++uid

function loadSnippet() {
  return get(`${API.PLAY.ROUND}?language=python`)
}

function makeCard(snippet) {
  return { id: nextId(), snippet, anim: null }
}

export default function BugSmashGame({ onExit }) {
  const [phase, setPhase] = useState('ready') // ready | playing | gameover
  const [cards, setCards] = useState([])
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [combo, setCombo] = useState(0)
  const [comboFlash, setComboFlash] = useState(false)
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(false)
  const [xpReward, setXpReward] = useState(null)

  const phaseRef = useRef('ready')
  const replacingRef = useRef(new Set())
  const comboRef = useRef(0)
  const scoreRef = useRef(0)
  const missesRef = useRef(0)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { comboRef.current = combo }, [combo])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { missesRef.current = misses }, [misses])

  const fetchScores = useCallback(async () => {
    try {
      const data = await get(API.PLAY.BUGSMASH_SCORES)
      setScores(data?.scores ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchScores()
  }, [fetchScores])

  const endGame = useCallback(async (finalScore) => {
    setPhase('gameover')
    try {
      const data = await post(API.PLAY.BUGSMASH_SCORE, { score: finalScore })
      if (data?.scores) setScores(data.scores)
      if (data?.xp_reward) {
        setXpReward(data.xp_reward)
        if (data?.pet) {
          window.dispatchEvent(new CustomEvent('pet:xp_gained', {
            detail: { xp: data.xp_reward, pet: data.pet },
          }))
        }
      }
    } catch { /* ignore — score shown anyway */ }
  }, [])

  const replaceCard = useCallback(async (cardId) => {
    if (phaseRef.current !== 'playing') return
    try {
      const snippet = await loadSnippet()
      setCards(prev => prev.map(c => c.id === cardId ? makeCard(snippet) : c))
    } catch {
      setTimeout(() => replaceCard(cardId), 1000)
    } finally {
      replacingRef.current.delete(cardId)
    }
  }, [])

  const startGame = useCallback(async () => {
    setLoading(true)
    try {
      const snippets = await Promise.all(Array.from({ length: GRID_SIZE }, loadSnippet))
      setCards(snippets.map(makeCard))
      setScore(0)
      setTimeLeft(GAME_DURATION)
      setHits(0)
      setMisses(0)
      setCombo(0)
      setXpReward(null)
      replacingRef.current.clear()
      setPhase('playing')
    } catch {
      alert('Не удалось загрузить карточки. Попробуй ещё раз.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          endGame(scoreRef.current)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, endGame])

  // Auto-rotate oldest idle card
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => {
      if (phaseRef.current !== 'playing') return
      setCards(prev => {
        const idle = prev.filter(c => !replacingRef.current.has(c.id) && !c.anim)
        if (!idle.length) return prev
        const target = idle[0]
        replacingRef.current.add(target.id)
        replaceCard(target.id)
        return prev.map(c => c.id === target.id ? { ...c, anim: 'rotating' } : c)
      })
    }, AUTO_ROTATE_MS)
    return () => clearInterval(id)
  }, [phase, replaceCard])

  const handleClick = useCallback((card) => {
    if (phaseRef.current !== 'playing') return
    if (replacingRef.current.has(card.id) || card.anim) return

    replacingRef.current.add(card.id)
    const isVuln = Boolean(card.snippet?.is_vulnerable)

    setCards(prev => prev.map(c => c.id === card.id ? { ...c, anim: isVuln ? 'hit' : 'miss' } : c))

    if (isVuln) {
      const newCombo = comboRef.current + 1
      setCombo(newCombo)
      const bonus = newCombo >= COMBO_THRESHOLD ? COMBO_BONUS : 0
      setScore(s => s + HIT_SCORE + bonus)
      setHits(h => h + 1)
      if (newCombo >= COMBO_THRESHOLD) {
        setComboFlash(true)
        setTimeout(() => setComboFlash(false), 600)
      }
      setTimeout(() => replaceCard(card.id), ANIM_HIT_MS)
    } else {
      setCombo(0)
      const newScore = scoreRef.current - MISS_PENALTY
      scoreRef.current = newScore
      setScore(newScore)
      setMisses(m => m + 1)
      if (newScore <= SCORE_FLOOR) {
        setTimeout(() => endGame(newScore), ANIM_MISS_MS)
      } else {
        setTimeout(() => replaceCard(card.id), ANIM_MISS_MS)
      }
    }
  }, [replaceCard, endGame])

  const timerPct = (timeLeft / GAME_DURATION) * 100
  const timerColor = timeLeft > 20 ? '#10b981' : timeLeft > 10 ? '#f59e0b' : '#ef4444'

  if (phase === 'ready') {
    return (
      <div className="bugsmash-ready">
        <h2 className="bugsmash-title">Bug Smash</h2>
        <p className="bugsmash-desc">
          На экране появляются фрагменты кода. Кликай только по уязвимым.
          Промахи снижают очки.
        </p>
        <div className="bugsmash-rules">
          <div className="bugsmash-rule bugsmash-rule-hit">✓ уязвимый <strong>+{HIT_SCORE} очков</strong></div>
          <div className="bugsmash-rule bugsmash-rule-miss">✗ безопасный <strong>−{MISS_PENALTY} очков</strong></div>
          <div className="bugsmash-rule">⚡ комбо ×{COMBO_THRESHOLD}+ <strong>+{COMBO_BONUS} бонус</strong></div>
          <div className="bugsmash-rule bugsmash-rule-miss">💀 счёт {SCORE_FLOOR} = конец игры</div>
          <div className="bugsmash-rule">⏱ {GAME_DURATION} секунд</div>
        </div>
        <div className="bugsmash-ready-actions">
          <button className="btn btn-primary btn-nowrap" onClick={startGame} disabled={loading}>
            {loading ? 'Загрузка…' : 'Начать игру'}
          </button>
          <button className="btn btn-secondary btn-nowrap" onClick={onExit}>Назад</button>
        </div>
        {scores.length > 0 && (
          <div className="bugsmash-leaderboard">
            <h3 className="bugsmash-lb-title">Лучшие результаты</h3>
            <ol className="bugsmash-lb-list">
              {scores.map((s, i) => (
                <li key={i} className={`bugsmash-lb-item ${i === 0 ? 'bugsmash-lb-first' : ''}`}>
                  <span className="bugsmash-lb-rank">#{i + 1}</span>
                  <span className="bugsmash-lb-name">{s.username}</span>
                  <span className="bugsmash-lb-score">{s.score} очков</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'gameover') {
    const best = scores[0]?.score ?? 0
    const isNewRecord = score > 0 && score >= best
    return (
      <div className="bugsmash-gameover">
        <div className="bugsmash-gameover-card">
          {isNewRecord && <div className="bugsmash-new-record">🏆 Новый рекорд!</div>}
          <h2 className="bugsmash-gameover-score">{score}</h2>
          <p className="bugsmash-gameover-label">очков</p>
          {xpReward > 0 && (
            <p className="bugsmash-xp-reward">+{xpReward} XP питомцу</p>
          )}
          <div className="bugsmash-gameover-stats">
            <div className="bugsmash-stat">
              <span className="bugsmash-stat-val bugsmash-stat-hit">{hits}</span>
              <span className="bugsmash-stat-lbl">попаданий</span>
            </div>
            <div className="bugsmash-stat">
              <span className="bugsmash-stat-val bugsmash-stat-miss">{misses}</span>
              <span className="bugsmash-stat-lbl">промахов</span>
            </div>
            <div className="bugsmash-stat">
              <span className="bugsmash-stat-val">{hits + misses}</span>
              <span className="bugsmash-stat-lbl">всего</span>
            </div>
          </div>
          <div className="bugsmash-gameover-actions">
            <button className="btn btn-primary btn-nowrap" onClick={startGame} disabled={loading}>
              {loading ? 'Загрузка…' : 'Играть снова'}
            </button>
            <button className="btn btn-secondary btn-nowrap" onClick={onExit}>К списку игр</button>
          </div>
          {scores.length > 0 && (
            <div className="bugsmash-leaderboard">
              <h3 className="bugsmash-lb-title">Таблица лучших</h3>
              <ol className="bugsmash-lb-list">
                {scores.map((s, i) => (
                  <li key={i} className={`bugsmash-lb-item ${i === 0 ? 'bugsmash-lb-first' : ''}`}>
                    <span className="bugsmash-lb-rank">#{i + 1}</span>
                    <span className="bugsmash-lb-name">{s.username}</span>
                    <span className="bugsmash-lb-score">{s.score} очков</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    )
  }

  // phase === 'playing'
  return (
    <div className="bugsmash-game">
      {/* HUD */}
      <div className="bugsmash-hud">
        <div className="bugsmash-hud-score">
          <span className="bugsmash-hud-score-val">{score}</span>
          <span className="bugsmash-hud-score-lbl">очков</span>
        </div>
        {combo >= COMBO_THRESHOLD && (
          <div className={`bugsmash-combo ${comboFlash ? 'bugsmash-combo-flash' : ''}`}>
            ⚡ Комбо ×{combo}
          </div>
        )}
        <div className="bugsmash-hud-stats">
          <span className="bugsmash-hud-hit">✓ {hits}</span>
          <span className="bugsmash-hud-miss">✗ {misses}</span>
        </div>
        <div className="bugsmash-timer" style={{ '--timer-color': timerColor }}>
          <div className="bugsmash-timer-bar">
            <div className="bugsmash-timer-fill" style={{ width: `${timerPct}%`, background: timerColor }} />
          </div>
          <span className="bugsmash-timer-val" style={{ color: timerColor }}>{timeLeft}с</span>
        </div>
      </div>

      {/* Grid */}
      <div className="bugsmash-grid">
        {cards.map(card => (
          <button
            key={card.id}
            type="button"
            className={`bugsmash-card ${card.anim ? `bugsmash-card-${card.anim}` : ''}`}
            onClick={() => handleClick(card)}
            disabled={!!card.anim || replacingRef.current.has(card.id)}
          >
            {card.snippet ? (
              <>
                <div className="bugsmash-card-head">
                  <span className="play-pill">{card.snippet.language}</span>
                  <span className="play-pill play-pill-muted">{card.snippet.topic}</span>
                </div>
                <PlaySnippetViewer
                  key={card.snippet.id}
                  code={card.snippet.code}
                  language={card.snippet.language}
                  maxVisibleLines={10}
                />
                {card.anim === 'hit' && (
                  <div className="bugsmash-card-verdict bugsmash-card-verdict-hit">
                    +{HIT_SCORE} {combo >= COMBO_THRESHOLD ? `+${COMBO_BONUS} комбо!` : ''}
                  </div>
                )}
                {card.anim === 'miss' && (
                  <div className="bugsmash-card-verdict bugsmash-card-verdict-miss">−{MISS_PENALTY}</div>
                )}
              </>
            ) : (
              <div className="bugsmash-card-loading">…</div>
            )}
          </button>
        ))}
      </div>

      <p className="bugsmash-hint muted">Кликай только по уязвимым фрагментам</p>
    </div>
  )
}
