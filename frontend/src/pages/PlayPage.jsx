import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, post } from '../api'
import { API } from '../constants'
import { getPetAura, getPetDisplayName, markPetActivity } from '../utils/pet'
import PlaySnippetViewer from '../components/PlaySnippetViewer'
import PetAvatar from '../components/PetAvatar'

const PLAY_ROUND_MS = 30_000

const HACKER_HP_MAX = 150
const SHOT_DAMAGE = 25
const WIN_CORRECT_ANSWERS = HACKER_HP_MAX / SHOT_DAMAGE
const PLAY_WIN_XP_REWARD = 25

export default function PlayPage() {
  const MAX_ROUNDS = 10
  const INITIAL_HP = HACKER_HP_MAX

  const [mode, setMode] = useState('menu') // 'menu' | 'game1'
  const [language, setLanguage] = useState('python')
  const [loading, setLoading] = useState(false)
  const [snippet, setSnippet] = useState(null)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState(null) // 'vulnerable' | 'safe'
  const [selectedFixId, setSelectedFixId] = useState(null)
  const [stage, setStage] = useState('idle') // 'idle' | 'choice' | 'fix' | 'result'
  const [result, setResult] = useState(null)
  const [rounds, setRounds] = useState(0)
  const [correctRounds, setCorrectRounds] = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [pet, setPet] = useState(null)
  /** Мастер: язык → сложность → playing. */
  const [game1Screen, setGame1Screen] = useState(null) // null | 'language' | 'difficulty' | 'playing'
  /** HP хакера-цели. */
  const [targetHP, setTargetHP] = useState(INITIAL_HP)
  const [gameOver, setGameOver] = useState(false)
  const [winRewardGranted, setWinRewardGranted] = useState(false)

  const roundsRef = useRef(0)
  const targetHPRef = useRef(INITIAL_HP)
  const roundSettledRef = useRef(false)
  const gameOverRef = useRef(false)
  /** Абсолютное время окончания раунда (Date.now()); не зависит от throttling setInterval в фоновых вкладках. */
  const roundEndsAtRef = useRef(null)

  useEffect(() => {
    roundsRef.current = rounds
  }, [rounds])
  useEffect(() => {
    targetHPRef.current = targetHP
  }, [targetHP])

  const petAuraClasses = useMemo(() => {
    if (!pet) return []
    const baseAura = getPetAura(pet.level || 1)
    const equippedId = pet.equipped_aura
    const aura = equippedId ? { ...baseAura, id: equippedId } : baseAura
    return aura?.id && aura.id !== 'none' ? [`pet-avatar-aura-${aura.id}`] : []
  }, [pet])

  const resetGame1Session = () => {
    setSnippet(null)
    setResult(null)
    setStage('idle')
    setChoice(null)
    setSelectedFixId(null)
    setTimeLeft(null)
    setTargetHP(INITIAL_HP)
    setRounds(0)
    setCorrectRounds(0)
    setGameOver(false)
    setWinRewardGranted(false)
    gameOverRef.current = false
    setError('')
    roundsRef.current = 0
    targetHPRef.current = INITIAL_HP
    roundSettledRef.current = false
    roundEndsAtRef.current = null
  }

  const startGame1 = () => {
    setMode('game1')
    setGame1Screen('language')
    resetGame1Session()
  }

  const exitGame1ToMenu = () => {
    setMode('menu')
    setGame1Screen(null)
    resetGame1Session()
  }

  const beginPlaySession = () => {
    markPetActivity('play')
    setGame1Screen('playing')
    loadRound()
  }

  const loadRound = useCallback(async () => {
    if (!language || gameOverRef.current) return
    roundSettledRef.current = false
    setLoading(true)
    setError('')
    setSnippet(null)
    setChoice(null)
    setSelectedFixId(null)
    setStage('idle')
    setResult(null)
    setTimeLeft(null)
    roundEndsAtRef.current = null
    try {
      const data = await get(`${API.PLAY.ROUND}?language=${encodeURIComponent(language)}`)
      const endsAt = Date.now() + PLAY_ROUND_MS
      roundEndsAtRef.current = endsAt
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
      setSnippet(data)
      setStage('choice')
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить раунд.')
    } finally {
      setLoading(false)
    }
  }, [language])

  // Загружаем питомца при входе в игру 1.
  useEffect(() => {
    if (mode !== 'game1') return
    get(API.PET.GET)
      .then((p) => setPet(p))
      .catch(() => setPet(null))
  }, [mode])

  useEffect(() => {
    if (stage !== 'result' || result?.endTitle !== 'won' || winRewardGranted) return
    post(API.PLAY.WIN, {})
      .then((payload) => {
        markPetActivity('play')
        if (payload?.pet) setPet(payload.pet)
      })
      .catch(() => {
        // Награда не должна ломать UX завершённой победной сессии.
      })
      .finally(() => setWinRewardGranted(true))
  }, [stage, result, winRewardGranted])

  const finalizeRound = useCallback((isCorrect, explanation, correctFixText, opts = {}) => {
    if (roundSettledRef.current) return
    roundSettledRef.current = true
    const timedOut = Boolean(opts.timedOut)

    const nextRounds = roundsRef.current + 1

    let targetNext = targetHPRef.current
    let lost = false
    let won = false
    let lossReason = null

    if (timedOut) {
      lost = true
      lossReason = 'timeout'
    } else {
      if (isCorrect) {
        targetNext = Math.max(0, targetHPRef.current - SHOT_DAMAGE)
      }
      if (targetNext <= 0) {
        won = true
      } else if (nextRounds >= MAX_ROUNDS) {
        lost = true
        lossReason = 'target_alive'
      }
    }

    roundsRef.current = nextRounds
    targetHPRef.current = targetNext

    setRounds(nextRounds)
    setTargetHP(targetNext)
    setCorrectRounds((c) => (isCorrect && !timedOut ? c + 1 : c))
    setResult({
      isCorrect: timedOut ? false : isCorrect,
      explanation,
      correctFix: correctFixText || null,
      endTitle: lost ? 'lost' : won ? 'won' : null,
      lossReason: lost ? lossReason : null,
    })
    setStage('result')
    setTimeLeft(null)
    roundEndsAtRef.current = null

    if (lost || won) {
      gameOverRef.current = true
      setGameOver(true)
    } else {
      gameOverRef.current = false
      setGameOver(false)
    }
  }, [MAX_ROUNDS, SHOT_DAMAGE])

  const TIMEOUT_EXPLANATION =
    'Время на раунд закончилось — партия проиграна. В реальной атаке уязвимость не ждёт: решай быстрее или начни заново.'

  // Таймер по дедлайну (roundEndsAtRef): в фоновой вкладке setInterval throttled, но время считается по Date.now().
  useEffect(() => {
    if (!snippet || (stage !== 'choice' && stage !== 'fix')) return
    if (roundEndsAtRef.current == null) return

    const tick = () => {
      if (roundSettledRef.current) return
      const end = roundEndsAtRef.current
      if (end == null) return
      const msLeft = end - Date.now()
      const sec = Math.max(0, Math.ceil(msLeft / 1000))
      setTimeLeft(sec)
      if (msLeft <= 0) {
        queueMicrotask(() => {
          finalizeRound(false, TIMEOUT_EXPLANATION, null, { timedOut: true })
        })
      }
    }

    tick()
    const id = setInterval(tick, 250)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [snippet, stage, finalizeRound])

  const playSessionLost = gameOver && result && result.endTitle === 'lost'
  const inputsLocked = gameOver || stage === 'result'

  const handleChoice = (nextChoice) => {
    if (!snippet || stage !== 'choice' || gameOver) return
    setChoice(nextChoice)
    if (snippet.is_vulnerable && nextChoice === 'vulnerable' && (snippet.fix_options || snippet.fixOptions || []).length) {
      setStage('fix')
    } else {
      const isCorrect =
        (snippet.is_vulnerable && nextChoice === 'vulnerable') ||
        (!snippet.is_vulnerable && nextChoice === 'safe')
      const explanation = snippet.is_vulnerable ? snippet.explanation_vulnerable : snippet.explanation_safe
      finalizeRound(isCorrect, explanation, null)
    }
  }

  const handleFix = (fixId) => {
    if (!snippet || stage !== 'fix' || gameOver) return
    setSelectedFixId(fixId)
    const fixes = snippet.fix_options || snippet.fixOptions || []
    const picked = fixes.find((f) => f.id === fixId)
    const correctFix = fixes.find((f) => f.correct)
    const isCorrect = Boolean(picked && picked.correct)
    const explanation = snippet.explanation_vulnerable
    finalizeRound(isCorrect, explanation, correctFix ? correctFix.text : null)
  }

  const handleNextRound = () => {
    roundSettledRef.current = false
    loadRound()
  }

  const handlePlayAgain = () => {
    resetGame1Session()
    setGame1Screen('playing')
    loadRound()
  }

  const resultPresentation =
    stage === 'result' && result
      ? {
          tone:
            result.endTitle === 'lost'
              ? 'error'
              : result.endTitle === 'won'
                ? 'success'
                : result.isCorrect
                  ? 'success'
                  : 'error',
          verdict:
            result.endTitle === 'lost'
              ? result.lossReason === 'timeout'
                ? 'Игра проиграна'
                : 'Игра проиграна'
              : result.endTitle === 'won'
                ? 'Победа! Хакер нейтрализован'
                : result.isCorrect
                  ? 'Верно'
                  : 'Неверно',
        }
      : null

  return (
    <div className="container">
      {mode === 'menu' ? (
        <>
          <div className="play-hero-card card">
            <h1 className="play-hero-title">Play</h1>
            <p className="play-hero-desc">
              Мини-игры по безопасности кода: быстрые раунды, таймер и разбор ошибок.
            </p>
          </div>

          <div className="play-grid">
            <section className="play-game-card">
              <div className="play-game-badge">Игра 1</div>
              <h2 className="play-game-title">Vulnerable or Safe?</h2>
              <p className="play-game-text">
                Определи, уязвим код или нет. Если уязвим — выбери правильный фикс.
              </p>
              <ul className="play-game-list">
                <li>Темы: XSS, SQLi, Path Traversal, логирование.</li>
                <li>Раунд: {Math.round(PLAY_ROUND_MS / 1000)} секунд. Таймер в ноль — поражение.</li>
                <li>
                  Победа: снять {INITIAL_HP} HP хакера ({WIN_CORRECT_ANSWERS} точных ответов по {SHOT_DAMAGE} урона).
                </li>
                <li>После ответа показывается короткий разбор.</li>
              </ul>
              <button
                type="button"
                className="btn btn-primary play-gradient-btn btn-nowrap"
                onClick={startGame1}
              >
                Играть
              </button>
            </section>

            <section className="play-game-card">
              <div className="play-game-badge">Игра 2</div>
              <h2 className="play-game-title">Bug Smash</h2>
              <p className="play-game-text">
                Кликаешь только по реальным уязвимостям. Промахи снижают очки.
              </p>
              <ul className="play-game-list">
                <li>Темповой режим.</li>
                <li>Таблица лучших результатов.</li>
              </ul>
              <Link to="#" className="btn btn-secondary btn-nowrap" aria-disabled="true">
                В разработке
              </Link>
            </section>
          </div>
        </>
      ) : (
        <div className="play-game-full-page">
          <div className="play-game-card play-game-full-card">
            <div className="play-game-full-header">
              <div className="play-game-full-title">
                <div className="play-game-badge">Игра 1</div>
                <h2 className="play-game-title">Vulnerable or Safe?</h2>
              </div>
              {!playSessionLost && (
                <button
                  type="button"
                  className="play-back-link"
                  onClick={() => {
                    if (game1Screen === 'difficulty') {
                      setGame1Screen('language')
                      return
                    }
                    exitGame1ToMenu()
                  }}
                >
                  {game1Screen === 'language' || game1Screen === 'difficulty' ? '← Назад' : '← К списку игр'}
                </button>
              )}
            </div>

            <div className="play-game-play-column">
              {game1Screen === 'language' && (
                <div className="play-wizard-step">
                  <h3 className="play-wizard-title">Выберите язык</h3>
                  <p className="play-game-text play-game-text-setup">
                    На каком языке показывать фрагменты?
                  </p>
                  <div className="play-lang-row">
                    <button
                      type="button"
                      className={`play-lang-btn ${language === 'python' ? 'active' : ''}`}
                      onClick={() => setLanguage('python')}
                    >
                      Python
                    </button>
                    <button type="button" className="play-lang-btn" disabled>
                      JavaScript (скоро)
                    </button>
                  </div>
                  <div className="play-wizard-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-nowrap"
                      onClick={() => setGame1Screen('difficulty')}
                      disabled={!language}
                    >
                      Далее
                    </button>
                  </div>
                </div>
              )}

              {game1Screen === 'difficulty' && (
                <div className="play-wizard-step">
                  <h3 className="play-wizard-title">Сложность</h3>
                  <div className="play-difficulty-list" role="list">
                    <div
                      className="play-difficulty-option play-difficulty-option-active"
                      role="listitem"
                      aria-current="true"
                    >
                      <span className="play-difficulty-name">Легко</span>
                    </div>
                    <div className="play-difficulty-option play-difficulty-option-soon" role="listitem" aria-disabled="true">
                      <span className="play-difficulty-name">Средне</span>
                      <span className="play-difficulty-soon">Скоро</span>
                    </div>
                    <div className="play-difficulty-option play-difficulty-option-soon" role="listitem" aria-disabled="true">
                      <span className="play-difficulty-name">Сложно</span>
                      <span className="play-difficulty-soon">Скоро</span>
                    </div>
                  </div>
                  <div className="play-wizard-actions">
                    <button
                      type="button"
                      className="btn btn-primary play-start-game-btn btn-nowrap"
                      onClick={beginPlaySession}
                      disabled={loading}
                    >
                      {loading ? 'Загрузка…' : 'Играть'}
                    </button>
                  </div>
                </div>
              )}

              {game1Screen === 'playing' && (
                <div className="play-battle-layout">
                  <aside className="play-battle-sidebar">
                    <div className="play-pet-strip play-side-card">
                      {pet ? (
                        <div className="play-pet-row">
                          <div className="pet-avatar-wrap play-pet-avatar-wrap">
                            <PetAvatar
                              level={pet.level || 1}
                              variant={pet.equipped_variant || 'classic'}
                              auraClassNames={petAuraClasses}
                            />
                          </div>
                          <div className="play-pet-meta">
                            <div className="play-pet-name">{getPetDisplayName(pet)}</div>
                            <div className="play-weapon-row" aria-label={`Попадания ${correctRounds} из ${WIN_CORRECT_ANSWERS}`}>
                              <span className="play-pet-hp-label">Попадания</span>
                              <div className="play-weapon-pips" role="presentation">
                                {Array.from({ length: WIN_CORRECT_ANSWERS }, (_, i) => (
                                  <span
                                    key={i}
                                    className={`play-weapon-pip ${i < correctRounds ? 'play-weapon-pip-full' : 'play-weapon-pip-empty'}`}
                                  />
                                ))}
                              </div>
                              <span className="play-pet-hp-value play-weapon-charges-count">
                                {correctRounds}/{WIN_CORRECT_ANSWERS}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="play-pet-row">
                          <div className="pet-avatar-wrap play-pet-avatar-wrap">
                            <PetAvatar level={1} variant="classic" />
                          </div>
                          <div className="play-pet-meta">
                            <div className="play-pet-name">Hackpet</div>
                            <div className="play-weapon-row" aria-label={`Попадания ${correctRounds} из ${WIN_CORRECT_ANSWERS}`}>
                              <span className="play-pet-hp-label">Попадания</span>
                              <div className="play-weapon-pips" role="presentation">
                                {Array.from({ length: WIN_CORRECT_ANSWERS }, (_, i) => (
                                  <span
                                    key={i}
                                    className={`play-weapon-pip ${i < correctRounds ? 'play-weapon-pip-full' : 'play-weapon-pip-empty'}`}
                                  />
                                ))}
                              </div>
                              <span className="play-pet-hp-value play-weapon-charges-count">
                                {correctRounds}/{WIN_CORRECT_ANSWERS}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="play-vs-divider" aria-hidden="true">
                      VS
                    </div>

                    <div className="play-target-strip play-side-card">
                      <div className="play-target-row">
                        <div className="play-target-icon" aria-hidden="true">
                          🧑‍💻
                        </div>
                        <div className="play-target-meta">
                          <div className="play-target-name">Хакер</div>
                          <p className="play-weapon-shot-hint muted">
                            <span className="play-weapon-shot-label">Правильный ответ</span> — это{' '}
                            <strong className="play-weapon-shot-word">выстрел</strong> по хакеру.
                          </p>
                          <p className="play-weapon-damage-hint muted">
                            Урон за выстрел: <span className="play-weapon-damage-value">−{SHOT_DAMAGE} HP</span>
                          </p>
                          <div className="play-pet-hp-row">
                            <span className="play-pet-hp-label">HP</span>
                            <div className="account-progress-bar play-pet-hp-bar play-target-hp-bar">
                              <div className="account-progress-bar-fill" style={{ width: `${(targetHP / INITIAL_HP) * 100}%` }} />
                            </div>
                            <span className="play-pet-hp-value">
                              {targetHP}/{INITIAL_HP}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(snippet && timeLeft != null) || rounds > 0 ? (
                      <div className="play-round-toolbar" aria-live="polite">
                        {snippet && timeLeft != null && (
                          <div className="play-timer play-timer-pill" role="timer" aria-label={`Осталось ${timeLeft} секунд`}>
                            <span className="play-timer-label">Время</span>
                            <span className="play-timer-value">{timeLeft}</span>
                            <span className="play-timer-unit">сек</span>
                          </div>
                        )}
                        {rounds > 0 && (
                          <div className="play-session-stats play-session-stats-inline">
                            <span>
                              Раунды {rounds} · попадания {correctRounds}/{WIN_CORRECT_ANSWERS}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {snippet && (stage === 'choice' || stage === 'fix') && !inputsLocked && (
                      <p className="play-round-rule-hint muted">
                        6 правильных ответов по {SHOT_DAMAGE} урона снимают все {INITIAL_HP} HP хакера. Таймер в ноль — проигрыш партии.
                      </p>
                    )}
                  </aside>

                  <div className="play-battle-main">
                    {playSessionLost && stage === 'result' && (
                      <div className="play-game-over-banner" role="alert" aria-live="assertive">
                        <span className="play-game-over-title">Game over</span>
                        <span className="play-game-over-subtitle">Игра окончена</span>
                      </div>
                    )}

                    {error && <p className="play-error">{error}</p>}

                    {snippet && (
                      <div className={`play-challenge-card${playSessionLost && stage === 'result' ? ' play-challenge-card-lost' : ''}`}>
                  <div className="play-challenge-head">
                    <span className="play-challenge-label">Фрагмент кода</span>
                    <div className="play-snippet-meta">
                      <span className="play-pill">{snippet.language}</span>
                      <span className="play-pill play-pill-muted">{snippet.topic}</span>
                    </div>
                  </div>
                  <PlaySnippetViewer key={snippet.id} code={snippet.code} language={snippet.language} maxVisibleLines={7} />

                  <div className="play-choice-row">
                    <button
                      type="button"
                      className={`play-choice-btn vulnerable ${choice === 'vulnerable' ? 'selected' : ''}`}
                      onClick={() => handleChoice('vulnerable')}
                      disabled={stage !== 'choice' || inputsLocked}
                    >
                      Уязвимо
                    </button>
                    <button
                      type="button"
                      className={`play-choice-btn safe ${choice === 'safe' ? 'selected' : ''}`}
                      onClick={() => handleChoice('safe')}
                      disabled={stage !== 'choice' || inputsLocked}
                    >
                      Безопасно
                    </button>
                  </div>

                {stage === 'fix' && (snippet.fix_options || snippet.fixOptions || []).length > 0 && (
                  <div className="play-fix-block">
                    <p className="play-fix-title">Фрагмент действительно уязвим. Выбери быстрый фикс:</p>
                    <div className="play-fix-options">
                      {(snippet.fix_options || snippet.fixOptions || []).map((fix) => (
                        <button
                          key={fix.id}
                          type="button"
                          className={`play-fix-btn ${selectedFixId === fix.id ? 'selected' : ''}`}
                          onClick={() => handleFix(fix.id)}
                          disabled={stage !== 'fix' || inputsLocked}
                        >
                          {fix.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {resultPresentation && (
                  <div className={`play-result play-result-paused ${resultPresentation.tone}`}>
                    <p className="play-result-verdict">{resultPresentation.verdict}</p>
                    {result.endTitle === 'lost' && result.lossReason === 'timeout' && (
                      <p className="play-result-sub muted">Лимит времени на раунд исчерпан — сессия завершена.</p>
                    )}
                    {result.endTitle === 'lost' && result.lossReason === 'target_alive' && (
                      <p className="play-result-sub muted">
                        Лимит в {MAX_ROUNDS} раундов исчерпан, хакер ещё жив — партия проиграна.
                      </p>
                    )}
                    {result.endTitle === 'won' && (
                      <p className="play-result-sub muted">
                        Хакер нейтрализован: {WIN_CORRECT_ANSWERS} попаданий по {SHOT_DAMAGE} урона сняли все {INITIAL_HP} HP. Hackpet получил +{PLAY_WIN_XP_REWARD} XP.
                      </p>
                    )}
                    <p className="play-result-text">{result.explanation}</p>
                    {result.correctFix && (
                      <p className="play-result-text muted">
                        Правильный быстрый фикс: <span className="play-result-code">{result.correctFix}</span>
                      </p>
                    )}
                    <div className="play-result-actions">
                      {!gameOver && (
                        <button
                          type="button"
                          className="btn btn-primary btn-nowrap"
                          onClick={handleNextRound}
                          disabled={loading}
                        >
                          {loading ? 'Загрузка…' : 'Далее'}
                        </button>
                      )}
                      {gameOver && (
                        <>
                          <button type="button" className="btn btn-primary btn-nowrap" onClick={handlePlayAgain}>
                            Играть снова
                          </button>
                          {playSessionLost && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-nowrap"
                              onClick={exitGame1ToMenu}
                            >
                              К списку игр
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

