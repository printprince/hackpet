import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api'
import { API } from '../constants'
import { getPetAura } from '../utils/pet'
import PlaySnippetViewer from '../components/PlaySnippetViewer'

const PLAY_ROUND_MS = 20_000

/** Защита: монстр бьёт по HP питомца. Атака: оружие с 4 зарядами × 25 урона по HP цели (своего HP нет). */
const GAME1_ROLE = {
  DEFENSE: 'defense',
  ATTACK: 'attack',
}

const WEAPON_CHARGES_MAX = 4
const SHOT_DAMAGE = 25

export default function PlayPage() {
  const MAX_ROUNDS = 10
  const INITIAL_HP = 100
  /** В защите — удар монстра за ошибку. В атаке совпадает с уроном одного заряда. */
  const DAMAGE_PER_MISTAKE = SHOT_DAMAGE

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
  /** Мастер: формат → язык → сложность → playing. */
  const [game1Screen, setGame1Screen] = useState(null) // null | 'format' | 'language' | 'difficulty' | 'playing'
  const [game1Role, setGame1Role] = useState(GAME1_ROLE.DEFENSE)
  const [petHP, setPetHP] = useState(INITIAL_HP)
  /** Только атака: HP цели (100). */
  const [targetHP, setTargetHP] = useState(INITIAL_HP)
  /** Только атака: оставшиеся заряды оружия (каждый ответ тратит 1; попадание ещё и −25 к цели). */
  const [weaponCharges, setWeaponCharges] = useState(WEAPON_CHARGES_MAX)
  const [gameOver, setGameOver] = useState(false)

  const roundsRef = useRef(0)
  const petHPRef = useRef(INITIAL_HP)
  const targetHPRef = useRef(INITIAL_HP)
  const weaponChargesRef = useRef(WEAPON_CHARGES_MAX)
  const game1RoleRef = useRef(GAME1_ROLE.DEFENSE)
  const roundSettledRef = useRef(false)
  const gameOverRef = useRef(false)
  /** Абсолютное время окончания раунда (Date.now()); не зависит от throttling setInterval в фоновых вкладках. */
  const roundEndsAtRef = useRef(null)

  useEffect(() => {
    roundsRef.current = rounds
  }, [rounds])
  useEffect(() => {
    petHPRef.current = petHP
  }, [petHP])
  useEffect(() => {
    targetHPRef.current = targetHP
  }, [targetHP])
  useEffect(() => {
    weaponChargesRef.current = weaponCharges
  }, [weaponCharges])
  useEffect(() => {
    game1RoleRef.current = game1Role
  }, [game1Role])

  const resetGame1Session = () => {
    setSnippet(null)
    setResult(null)
    setStage('idle')
    setChoice(null)
    setSelectedFixId(null)
    setTimeLeft(null)
    setPetHP(INITIAL_HP)
    setTargetHP(INITIAL_HP)
    setWeaponCharges(WEAPON_CHARGES_MAX)
    setRounds(0)
    setCorrectRounds(0)
    setGameOver(false)
    gameOverRef.current = false
    setError('')
    roundsRef.current = 0
    petHPRef.current = INITIAL_HP
    targetHPRef.current = INITIAL_HP
    weaponChargesRef.current = WEAPON_CHARGES_MAX
    roundSettledRef.current = false
    roundEndsAtRef.current = null
  }

  const startGame1 = () => {
    setMode('game1')
    setGame1Role(GAME1_ROLE.DEFENSE)
    game1RoleRef.current = GAME1_ROLE.DEFENSE
    setGame1Screen('format')
    resetGame1Session()
  }

  const exitGame1ToMenu = () => {
    setMode('menu')
    setGame1Screen(null)
    resetGame1Session()
  }

  const beginPlaySession = () => {
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
      const data = await get(`/play/v1/round?language=${encodeURIComponent(language)}`)
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

  const finalizeRound = useCallback((isCorrect, explanation, correctFixText, opts = {}) => {
    if (roundSettledRef.current) return
    roundSettledRef.current = true
    const timedOut = Boolean(opts.timedOut)
    const role = game1RoleRef.current

    const nextRounds = roundsRef.current + 1

    let petNext = petHPRef.current
    let targetNext = targetHPRef.current
    let lost = false
    let won = false
    let lossReason = null

    if (role === GAME1_ROLE.DEFENSE) {
      if (timedOut) {
        petNext = 0
      } else if (isCorrect) {
        petNext = petHPRef.current
      } else {
        petNext = Math.max(0, petHPRef.current - DAMAGE_PER_MISTAKE)
      }
      lost = petNext <= 0
      won = !lost && nextRounds >= MAX_ROUNDS
      lossReason = lost ? (timedOut ? 'timeout' : 'hp') : null
    } else {
      if (timedOut) {
        lost = true
        lossReason = 'timeout'
      } else {
        let chargesNext = weaponChargesRef.current - 1
        targetNext = targetHPRef.current
        if (isCorrect) {
          targetNext = Math.max(0, targetHPRef.current - SHOT_DAMAGE)
        }
        weaponChargesRef.current = chargesNext
        setWeaponCharges(chargesNext)
        if (targetNext <= 0) {
          won = true
        } else if (chargesNext <= 0) {
          lost = true
          lossReason = 'out_of_ammo'
        } else if (nextRounds >= MAX_ROUNDS) {
          lost = true
          lossReason = 'target_alive'
        }
      }
    }

    roundsRef.current = nextRounds
    petHPRef.current = petNext
    targetHPRef.current = targetNext

    setRounds(nextRounds)
    setPetHP(petNext)
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
  }, [DAMAGE_PER_MISTAKE, MAX_ROUNDS, SHOT_DAMAGE])

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
  const inputsLocked =
    gameOver || stage === 'result' || (game1Role === GAME1_ROLE.DEFENSE && petHP <= 0)

  const handleChoice = (nextChoice) => {
    if (!snippet || stage !== 'choice' || gameOver || (game1Role === GAME1_ROLE.DEFENSE && petHP <= 0)) return
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
    if (!snippet || stage !== 'fix' || gameOver || (game1Role === GAME1_ROLE.DEFENSE && petHP <= 0)) return
    setSelectedFixId(fixId)
    const fixes = snippet.fix_options || snippet.fixOptions || []
    const picked = fixes.find((f) => f.id === fixId)
    const correctFix = fixes.find((f) => f.correct)
    const isCorrect = Boolean(picked && picked.correct)
    const explanation = snippet.explanation_vulnerable
    finalizeRound(isCorrect, explanation, correctFix ? correctFix.text : null)
  }

  const sessionAccuracy = rounds > 0 ? Math.round((correctRounds / rounds) * 100) : null

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
                : result.lossReason === 'target_alive'
                  ? 'Игра проиграна'
                  : result.lossReason === 'out_of_ammo'
                    ? 'Патроны кончились'
                    : 'HP на нуле'
              : result.endTitle === 'won'
                ? game1Role === GAME1_ROLE.ATTACK
                  ? 'Победа! Цель уничтожена'
                  : 'Победа!'
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
            <div className="play-hero-label">Новая зона</div>
            <h1 className="play-hero-title">Play</h1>
            <p className="play-hero-desc">
              Мини-игры по безопасности кода: короткие раунды, таймер и мгновенный разбор. В «Vulnerable or Safe?» если время
              раунда истечёт до ответа — партия считается проигранной.
            </p>
          </div>

          <div className="play-grid">
            <section className="play-game-card">
              <div className="play-game-badge">Игра 1</div>
              <h2 className="play-game-title">Vulnerable or Safe?</h2>
              <p className="play-game-text">
                Короткий фрагмент кода: реши, уязвим он или безопасен. Если уязвим — выбери быстрый фикс из вариантов.
              </p>
              <ul className="play-game-list">
                <li>Темы: XSS, SQLi, пути, логирование и др.</li>
                <li>
                  Условия: на каждый раунд — ограниченное время. Не ответить до конца таймера — проигрыш всей партии, не только
                  этого раунда.
                </li>
                <li>
                  Защита: монстр атакует твоё HP (ошибки и таймер бьют по нему). Атака: оружие с 4 зарядами по 25 урона — нужно
                  уничтожить HP цели; каждый ответ тратит заряд, попадание наносит урон.
                </li>
                <li>После ответа — разбор; следующий раунд начинаешь кнопкой «Далее».</li>
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
                На экране «падают» баги (XSS, SQLi, CSRF, race condition). Нужно кликать только по реальным
                уязвимостям — за промах снимаются очки, раунд длится 20 секунд.
              </p>
              <ul className="play-game-list">
                <li>Темповой режим на время.</li>
                <li>Рейтинг лучших результатов.</li>
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
                    if (game1Screen === 'language') {
                      setGame1Screen('format')
                      return
                    }
                    exitGame1ToMenu()
                  }}
                >
                  {game1Screen === 'language' || game1Screen === 'difficulty'
                    ? '← Назад'
                    : '← К списку игр'}
                </button>
              )}
            </div>

            <div className="play-game-play-column">
              {game1Screen === 'format' && (
                <div className="play-wizard-step">
                  <h3 className="play-wizard-title">Формат игры</h3>
                  <p className="play-game-text play-game-text-setup">
                    Защита — на тебя нападает монстр: держишь HP. Атака — своего HP нет, есть оружие на 4 заряда (каждый −25 к HP
                    цели при попадании); каждый ответ расходует заряд.
                  </p>
                  <div className="play-format-list" role="radiogroup" aria-label="Формат игры">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={game1Role === GAME1_ROLE.DEFENSE}
                      className={`play-format-option ${game1Role === GAME1_ROLE.DEFENSE ? 'play-format-option-active' : ''}`}
                      onClick={() => setGame1Role(GAME1_ROLE.DEFENSE)}
                    >
                      <span className="play-format-name">Защита</span>
                      <span className="play-format-desc">
                        Монстр бьёт по твоему HP: ошибка или нулевой таймер — минус здоровье; при 0 HP — поражение.
                      </span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={game1Role === GAME1_ROLE.ATTACK}
                      className={`play-format-option ${game1Role === GAME1_ROLE.ATTACK ? 'play-format-option-active' : ''}`}
                      onClick={() => setGame1Role(GAME1_ROLE.ATTACK)}
                    >
                      <span className="play-format-name">Атака</span>
                      <span className="play-format-desc">
                        Оружие: 4 заряда, каждый успешный выстрел — 25 урона по цели (100 HP). Любой ответ тратит заряд; промах не
                        бьёт по цели. Таймаут — сразу проигрыш.
                      </span>
                    </button>
                  </div>
                  <div className="play-wizard-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-nowrap"
                      onClick={() => setGame1Screen('language')}
                    >
                      Далее
                    </button>
                  </div>
                </div>
              )}

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
                <>
                  {game1Role === GAME1_ROLE.DEFENSE && (
                    <div className="play-combat-strip play-combat-strip-defense">
                      <div className="play-pet-strip play-side-card">
                        {pet ? (
                          (() => {
                            const baseAura = getPetAura(pet.level || 1)
                            const equippedId = pet.equipped_aura
                            const aura = equippedId ? { ...baseAura, id: equippedId } : baseAura
                            const avatarClassNames = ['pet-avatar', 'pet-avatar-hackpet']
                            if (aura?.id && aura.id !== 'none') {
                              avatarClassNames.push(`pet-avatar-aura-${aura.id}`)
                            }
                            return (
                              <div className="play-pet-row">
                                <div className="pet-avatar-wrap play-pet-avatar-wrap">
                                  <div className={avatarClassNames.join(' ')} aria-hidden="true">
                                    🐶
                                  </div>
                                </div>
                                <div className="play-pet-meta">
                                  <div className="play-pet-name">{pet.name || 'Hackpet'}</div>
                                  <div className="play-pet-hp-row">
                                    <span className="play-pet-hp-label">HP</span>
                                    <div className="account-progress-bar play-pet-hp-bar play-defense-hp-bar">
                                      <div
                                        className="account-progress-bar-fill"
                                        style={{ width: `${(petHP / INITIAL_HP) * 100}%` }}
                                      />
                                    </div>
                                    <span className="play-pet-hp-value">
                                      {petHP}/{INITIAL_HP}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })()
                        ) : (
                          <div className="play-pet-row">
                            <div className="play-side-placeholder" aria-hidden="true">
                              🛡️
                            </div>
                            <div className="play-pet-meta">
                              <div className="play-pet-name">Ты</div>
                              <div className="play-pet-hp-row">
                                <span className="play-pet-hp-label">HP</span>
                                <div className="account-progress-bar play-pet-hp-bar play-defense-hp-bar">
                                  <div
                                    className="account-progress-bar-fill"
                                    style={{ width: `${(petHP / INITIAL_HP) * 100}%` }}
                                  />
                                </div>
                                <span className="play-pet-hp-value">
                                  {petHP}/{INITIAL_HP}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="play-monster-strip">
                        <div className="play-monster-row">
                          <div className="play-monster-icon" aria-hidden="true">
                            👾
                          </div>
                          <div className="play-monster-meta">
                            <div className="play-monster-name">Монстр</div>
                            <p className="play-monster-hint muted">Бьёт по твоему HP за ошибки; таймер в ноль — критический удар.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {game1Role === GAME1_ROLE.ATTACK && (
                    <div className="play-combat-strip">
                      <div className="play-pet-strip play-side-card">
                        {pet ? (
                          (() => {
                            const baseAura = getPetAura(pet.level || 1)
                            const equippedId = pet.equipped_aura
                            const aura = equippedId ? { ...baseAura, id: equippedId } : baseAura
                            const avatarClassNames = ['pet-avatar', 'pet-avatar-hackpet']
                            if (aura?.id && aura.id !== 'none') {
                              avatarClassNames.push(`pet-avatar-aura-${aura.id}`)
                            }
                            return (
                              <div className="play-pet-row">
                                <div className="pet-avatar-wrap play-pet-avatar-wrap">
                                  <div className={avatarClassNames.join(' ')} aria-hidden="true">
                                    🐶
                                  </div>
                                </div>
                                <div className="play-pet-meta">
                                  <div className="play-pet-name">{pet.name || 'Hackpet'}</div>
                                  <div className="play-weapon-block">
                                    <div
                                      className="play-weapon-row"
                                      aria-label={`Заряды ${weaponCharges} из ${WEAPON_CHARGES_MAX}. Правильный ответ — выстрел, урон по цели ${SHOT_DAMAGE} HP`}
                                    >
                                      <span className="play-pet-hp-label">Оружие</span>
                                      <div className="play-weapon-pips" role="presentation">
                                        {Array.from({ length: WEAPON_CHARGES_MAX }, (_, i) => (
                                          <span
                                            key={i}
                                            className={`play-weapon-pip ${i < weaponCharges ? 'play-weapon-pip-full' : 'play-weapon-pip-empty'}`}
                                          />
                                        ))}
                                      </div>
                                      <span className="play-pet-hp-value play-weapon-charges-count">
                                        {weaponCharges}/{WEAPON_CHARGES_MAX}
                                      </span>
                                    </div>
                                    <p className="play-weapon-shot-hint muted">
                                      <span className="play-weapon-shot-label">Правильный ответ</span> — это{' '}
                                      <strong className="play-weapon-shot-word">выстрел</strong> по цели.
                                    </p>
                                    <p className="play-weapon-damage-hint muted">
                                      Урон за выстрел:{' '}
                                      <span className="play-weapon-damage-value">−{SHOT_DAMAGE} HP</span> у цели
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })()
                        ) : (
                          <div className="play-pet-row">
                            <div className="play-side-placeholder" aria-hidden="true">
                              ⚔️
                            </div>
                            <div className="play-pet-meta">
                              <div className="play-pet-name">Атака</div>
                              <div className="play-weapon-block">
                                <div
                                  className="play-weapon-row"
                                  aria-label={`Заряды ${weaponCharges} из ${WEAPON_CHARGES_MAX}. Правильный ответ — выстрел, урон по цели ${SHOT_DAMAGE} HP`}
                                >
                                  <span className="play-pet-hp-label">Оружие</span>
                                  <div className="play-weapon-pips" role="presentation">
                                    {Array.from({ length: WEAPON_CHARGES_MAX }, (_, i) => (
                                      <span
                                        key={i}
                                        className={`play-weapon-pip ${i < weaponCharges ? 'play-weapon-pip-full' : 'play-weapon-pip-empty'}`}
                                      />
                                    ))}
                                  </div>
                                  <span className="play-pet-hp-value play-weapon-charges-count">
                                    {weaponCharges}/{WEAPON_CHARGES_MAX}
                                  </span>
                                </div>
                                <p className="play-weapon-shot-hint muted">
                                  <span className="play-weapon-shot-label">Правильный ответ</span> — это{' '}
                                  <strong className="play-weapon-shot-word">выстрел</strong> по цели.
                                </p>
                                <p className="play-weapon-damage-hint muted">
                                  Урон за выстрел:{' '}
                                  <span className="play-weapon-damage-value">−{SHOT_DAMAGE} HP</span> у цели
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="play-target-strip">
                        <div className="play-target-row">
                          <div className="play-target-icon" aria-hidden="true">
                            🏛️
                          </div>
                          <div className="play-target-meta">
                            <div className="play-target-name">Цель</div>
                            <div className="play-pet-hp-row">
                              <span className="play-pet-hp-label">HP</span>
                              <div className="account-progress-bar play-pet-hp-bar play-target-hp-bar">
                                <div
                                  className="account-progress-bar-fill"
                                  style={{ width: `${(targetHP / INITIAL_HP) * 100}%` }}
                                />
                              </div>
                              <span className="play-pet-hp-value">
                                {targetHP}/{INITIAL_HP}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {playSessionLost && stage === 'result' && (
                    <div className="play-game-over-banner" role="alert" aria-live="assertive">
                      <span className="play-game-over-title">Game over</span>
                      <span className="play-game-over-subtitle">Игра окончена</span>
                    </div>
                  )}

                  {((snippet && timeLeft != null) || sessionAccuracy !== null) && (
                    <div className="play-round-toolbar" aria-live="polite">
                      {snippet && timeLeft != null && (
                        <div
                          className="play-timer play-timer-pill"
                          role="timer"
                          aria-label={`Осталось ${timeLeft} секунд`}
                        >
                          <span className="play-timer-label">Время</span>
                          <span className="play-timer-value">{timeLeft}</span>
                          <span className="play-timer-unit">сек</span>
                        </div>
                      )}
                      {sessionAccuracy !== null && (
                        <div className="play-session-stats play-session-stats-inline">
                          <span>
                            Раунды {rounds} · верно {correctRounds}
                          </span>
                          <span className="muted">Точность {sessionAccuracy}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {snippet && (stage === 'choice' || stage === 'fix') && !inputsLocked && (
                    <p className="play-round-rule-hint muted">
                      {game1Role === GAME1_ROLE.DEFENSE
                        ? 'Таймер в ноль — критический удар, HP падает в ноль. Неверный ответ — монстр снимает 25 HP.'
                        : 'Правильный ответ — выстрел по цели. Любой ответ тратит 1 заряд; промах не снимает HP. Заряды кончились, а цель жива — поражение. Таймер в ноль — проигрыш партии.'}
                    </p>
                  )}

                  {error && <p className="play-error">{error}</p>}

                  {snippet && (
                <div
                  className={`play-challenge-card${playSessionLost && stage === 'result' ? ' play-challenge-card-lost' : ''}`}
                >
                  <div className="play-challenge-head">
                    <span className="play-challenge-label">Фрагмент кода</span>
                    <div className="play-snippet-meta">
                      <span className="play-pill">{snippet.language}</span>
                      <span className="play-pill play-pill-muted">{snippet.topic}</span>
                    </div>
                  </div>
                  <PlaySnippetViewer key={snippet.id} code={snippet.code} language={snippet.language} />

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
                    {result.endTitle === 'lost' && result.lossReason === 'hp' && (
                      <p className="play-result-sub muted">HP на нуле — монстр прорвал защиту.</p>
                    )}
                    {result.endTitle === 'lost' && result.lossReason === 'out_of_ammo' && (
                      <p className="play-result-sub muted">
                        Все {WEAPON_CHARGES_MAX} заряда потрачены, а у цели ещё есть HP — нужно было попадать точнее.
                      </p>
                    )}
                    {result.endTitle === 'lost' && result.lossReason === 'target_alive' && (
                      <p className="play-result-sub muted">
                        Лимит в {MAX_ROUNDS} раундов исчерпан, цель жива — в этом режиме это поражение.
                      </p>
                    )}
                    {result.endTitle === 'won' && game1Role === GAME1_ROLE.ATTACK && (
                      <p className="play-result-sub muted">
                        Цель уничтожена: {WEAPON_CHARGES_MAX} попадания по {SHOT_DAMAGE} урона сняли все {INITIAL_HP} HP.
                      </p>
                    )}
                    {result.endTitle === 'won' && game1Role !== GAME1_ROLE.ATTACK && (
                      <p className="play-result-sub muted">Все раунды пройдены.</p>
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

