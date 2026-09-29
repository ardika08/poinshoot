import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RotateCcw, Trophy, Gamepad2, AlertCircle, Volume2, VolumeX } from 'lucide-react'
import api, { playerStorage } from '../lib/api'
import sound from '../lib/sound'
import useBoardConfig from '../hooks/useBoardConfig'

const PlayPage = () => {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const { board } = useBoardConfig()

  const maxAttempts = board.max_attempts
  const CW = board.canvas.width
  const CH = board.canvas.height
  const BALL_R = board.canvas.ball_radius
  const START = board.canvas.ball_start

  const [player, setPlayer] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [lastScore, setLastScore] = useState(null)
  const [message, setMessage] = useState('')
  const [gameComplete, setGameComplete] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [currentDrag, setCurrentDrag] = useState({ x: 0, y: 0 })
  const [ball, setBall] = useState({ x: START.x, y: START.y, scale: 1, alpha: 1 })

  // Efek visual: lubang yang baru kena + popup poin
  const [hitEffect, setHitEffect] = useState(null) // { hole, t }
  const [popup, setPopup] = useState(null)         // { text, x, y, color, t }

  const [attemptLog, setAttemptLog] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveResult, setSaveResult] = useState(null)
  const [isLocked, setIsLocked] = useState(false) // kunci input saat bola terbang
  const [isMuted, setIsMuted] = useState(sound.isMuted())

  const playerName = player?.name || ''

  // ---------- guard registrasi ----------
  useEffect(() => {
    const saved = playerStorage.get()
    if (saved?.id) setPlayer(saved)
    else navigate('/')
  }, [navigate])

  // ---------- reset posisi bola kalau config berubah ----------
  useEffect(() => {
    setBall({ x: START.x, y: START.y, scale: 1, alpha: 1 })
  }, [START.x, START.y])

  // ---------- animasi efek (pulse ring + popup) ----------
  useEffect(() => {
    if (!hitEffect && !popup) return
    let raf
    const tick = () => {
      setHitEffect(e => (e && e.t < 1 ? { ...e, t: e.t + 0.045 } : null))
      setPopup(p => (p && p.t < 1 ? { ...p, t: p.t + 0.028 } : null))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [Boolean(hitEffect), Boolean(popup)])

  // ---------- render canvas ----------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const B = board.canvas.board

    ctx.clearRect(0, 0, CW, CH)

    // --- frame papan (meniru alat fisik: kanvas cream + rangka biru) ---
    ctx.fillStyle = '#1e3a8a'
    roundRect(ctx, B.x - 9, B.y - 9, B.width + 18, B.height + 18, 12)
    ctx.fill()

    ctx.fillStyle = '#fdfcf5'
    roundRect(ctx, B.x, B.y, B.width, B.height, 7)
    ctx.fill()
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // tali pengikat di sisi atas (detail visual alat)
    ctx.strokeStyle = 'rgba(30,58,138,0.35)'
    ctx.lineWidth = 1.5
    for (let i = 0; i <= 6; i++) {
      const lx = B.x + (B.width / 6) * i
      ctx.beginPath()
      ctx.moveTo(lx, B.y - 9)
      ctx.lineTo(lx, B.y + 5)
      ctx.stroke()
    }

    // --- lubang ---
    board.holes.forEach(hole => {
      // lubang gelap (mesh)
      ctx.beginPath()
      ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2)
      ctx.fillStyle = '#1e293b'
      ctx.fill()

      // ring warna
      ctx.beginPath()
      ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2)
      ctx.strokeStyle = hole.color
      ctx.lineWidth = hole.is_jackpot ? 5 : 3.5
      ctx.stroke()

      // angka poin
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${hole.is_jackpot ? 15 : 12}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(hole.points), hole.x, hole.y + 0.5)
    })

    // --- pulse ring saat kena ---
    if (hitEffect) {
      const { hole, t } = hitEffect
      ctx.beginPath()
      ctx.arc(hole.x, hole.y, hole.radius + t * 22, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(hole.color, 1 - t)
      ctx.lineWidth = 3 * (1 - t) + 1
      ctx.stroke()
    }

    // --- ketapel: tali + bola tertarik + prediksi arah ---
    let ballDrawX = ball.x
    let ballDrawY = ball.y

    if (isDragging && !isLocked) {
      const { pullX, pullY, pull, shotX, shotY, ratio } = aimVector()
      const level = powerLevel(ratio)

      if (pull >= board.physics.min_pull) {
        // Bola ditahan di titik tarikan
        ballDrawX = START.x + pullX
        ballDrawY = START.y + pullY

        // Tali ketapel dari titik awal ke bola
        ctx.beginPath()
        ctx.moveTo(START.x, START.y)
        ctx.lineTo(ballDrawX, ballDrawY)
        ctx.strokeStyle = level.color
        ctx.lineWidth = 3
        ctx.stroke()

        // Garis arah PENDEK dari titik awal (Opsi A): menunjukkan arah lempar
        // saja, TIDAK sampai ke lubang — jarak tetap ditebak sendiri.
        const shotDX = shotX - START.x
        const shotDY = shotY - START.y
        const shotLen = Math.hypot(shotDX, shotDY) || 1
        const guideLen = 46 // panjang tetap, tidak mengikuti kekuatan
        const gx = START.x + (shotDX / shotLen) * guideLen
        const gy = START.y + (shotDY / shotLen) * guideLen

        ctx.save()
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(START.x, START.y)
        ctx.lineTo(gx, gy)
        ctx.strokeStyle = hexToRgba(level.color, 0.7)
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.restore()

        // Kepala panah kecil di ujung garis arah
        const ang = Math.atan2(shotDY, shotDX)
        ctx.beginPath()
        ctx.moveTo(gx, gy)
        ctx.lineTo(gx - 7 * Math.cos(ang - 0.45), gy - 7 * Math.sin(ang - 0.45))
        ctx.lineTo(gx - 7 * Math.cos(ang + 0.45), gy - 7 * Math.sin(ang + 0.45))
        ctx.closePath()
        ctx.fillStyle = hexToRgba(level.color, 0.8)
        ctx.fill()

        // --- POWER BAR bertingkat ---
        const barW = CW - 48
        const barH = 9
        const barX = 24
        const barY = CH - 26

        // trek + garis pembatas tiap tingkat
        ctx.fillStyle = '#e2e8f0'
        roundRect(ctx, barX, barY, barW, barH, barH / 2)
        ctx.fill()

        const levels = board.physics.power_levels || []
        levels.slice(0, -1).forEach(l => {
          const x = barX + barW * l.max
          ctx.beginPath()
          ctx.moveTo(x, barY)
          ctx.lineTo(x, barY + barH)
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.stroke()
        })

        // isi sesuai kekuatan
        ctx.fillStyle = level.color
        roundRect(ctx, barX, barY, Math.max(barW * ratio, barH), barH, barH / 2)
        ctx.fill()

        // label kekuatan + persen
        ctx.fillStyle = level.color
        ctx.font = 'bold 11px Inter, system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(level.label, barX, barY - 5)
        ctx.textAlign = 'right'
        ctx.fillText(`${Math.round(ratio * 100)}%`, barX + barW, barY - 5)
      }
    }

    // --- bola ---
    if (ball.alpha > 0.02) {
      ctx.save()
      ctx.globalAlpha = ball.alpha
      ctx.beginPath()
      ctx.arc(ballDrawX, ballDrawY, BALL_R * ball.scale, 0, Math.PI * 2)
      ctx.fillStyle = '#fbbf24'
      ctx.fill()
      ctx.strokeStyle = '#92400e'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()
    }

    // Penanda posisi awal bola saat sedang ditarik
    if (isDragging && !isLocked) {
      ctx.beginPath()
      ctx.arc(START.x, START.y, BALL_R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(148,163,184,0.6)'
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
    }

    // --- popup poin ---
    if (popup) {
      ctx.save()
      ctx.globalAlpha = 1 - popup.t
      ctx.fillStyle = popup.color
      ctx.font = 'bold 19px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(popup.text, popup.x, popup.y - popup.t * 34)
      ctx.restore()
    }
  }, [board, ball, isDragging, dragStart, currentDrag, hitEffect, popup, isLocked, CW, CH, BALL_R])

  // ---------- helpers ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(a, 0)})`
  }

  /**
   * Vektor slingshot. Pemain menarik bola ke arah BERLAWANAN dari target
   * (seperti ketapel), jadi arah lempar = kebalikan arah tarikan.
   *
   * @returns {{ pullX, pullY, pull, shotX, shotY, ratio }}
   *   pull*  : vektor tarikan jari (bola ditahan di titik ini)
   *   shot*  : titik jatuh perkiraan bola
   *   ratio  : kekuatan 0..1 terhadap max_pull
   */
  function aimVector() {
    const P = board.physics
    const rawX = currentDrag.x - dragStart.x
    const rawY = currentDrag.y - dragStart.y
    const rawLen = Math.hypot(rawX, rawY)

    // Batasi panjang tarikan visual di max_pull
    const pull = Math.min(rawLen, P.max_pull)
    const scale = rawLen > 0 ? pull / rawLen : 0
    const pullX = rawX * scale
    const pullY = rawY * scale

    // Arah lempar = kebalikan tarikan
    const shotX = START.x - pullX * P.power_multiplier
    const shotY = START.y - pullY * P.power_multiplier

    return {
      pullX, pullY, pull,
      shotX, shotY,
      ratio: P.max_pull > 0 ? pull / P.max_pull : 0,
    }
  }

  /** Warna power sesuai ambang di config (hijau -> kuning -> merah) */
  function powerLevel(ratio) {
    const levels = board.physics.power_levels || []
    return levels.find(l => ratio <= l.max) || levels[levels.length - 1] || { color: '#22c55e', label: '' }
  }

  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (CW / rect.width),
      y: (clientY - rect.top) * (CH / rect.height),
    }
  }

  /** Cari lubang terdekat yang memuat titik jatuh bola */
  const findHole = useCallback((x, y) => {
    let best = null
    let bestDist = Infinity
    for (const hole of board.holes) {
      const d = Math.hypot(x - hole.x, y - hole.y)
      if (d < hole.radius && d < bestDist) {
        best = hole
        bestDist = d
      }
    }
    return best
  }, [board.holes])

  // ---------- input ----------
  const handleStart = (e) => {
    if (gameComplete || isLocked || attempts >= maxAttempts) return
    e.preventDefault()
    // Pointer capture membuat drag desktop tetap aktif saat pointer keluar
    // sedikit dari batas canvas ketika mengejar power maksimum.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const pos = getCanvasPos(e)
    setIsDragging(true)
    setDragStart(pos)
    setCurrentDrag(pos)
  }

  const handleMove = (e) => {
    if (!isDragging || isLocked) return
    e.preventDefault()
    setCurrentDrag(getCanvasPos(e))
  }
  const handleEnd = (e) => {
    if (!isDragging || isLocked) return
    e.preventDefault()
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    setIsDragging(false)

    const { pull, shotX, shotY } = aimVector()

    if (pull < board.physics.min_pull) {
      setMessage('Tarik bola lebih jauh!')
      setBall({ x: START.x, y: START.y, scale: 1, alpha: 1 })
      setTimeout(() => setMessage(''), 1400)
      return
    }

    // Drift kecil supaya tetap butuh keahlian, bukan tap presisi
    const drift = board.physics.aim_drift ?? 0
    const targetX = shotX + (Math.random() - 0.5) * 2 * drift
    const targetY = shotY + (Math.random() - 0.5) * 2 * drift

    setIsLocked(true)
    sound.throw()
    animateThrow(targetX, targetY)
  }

  /** Terbangkan bola ke titik target, lalu evaluasi hasilnya */
  const animateThrow = (tx, ty) => {
    const from = { x: ball.x, y: ball.y }
    const dur = 380
    const t0 = performance.now()

    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 2)
      setBall({
        x: from.x + (tx - from.x) * ease,
        y: from.y + (ty - from.y) * ease,
        scale: 1,
        alpha: 1,
      })
      if (p < 1) requestAnimationFrame(step)
      else resolveThrow(tx, ty)
    }
    requestAnimationFrame(step)
  }

  const resolveThrow = (tx, ty) => {
    const hole = findHole(tx, ty)
    const next = attempts + 1

    if (hole) {
      // bola "masuk" -> mengecil & memudar ke dalam lubang
      const t0 = performance.now()
      const shrink = (now) => {
        const p = Math.min((now - t0) / 260, 1)
        setBall({ x: hole.x, y: hole.y, scale: 1 - p * 0.85, alpha: 1 - p })
        if (p < 1) requestAnimationFrame(shrink)
      }
      requestAnimationFrame(shrink)

      setHitEffect({ hole, t: 0 })

      // Semua lubang sekarang bernilai positif; `is_successful` tetap membedakan masuk/meleset.
        if (hole.is_jackpot) sound.jackpot()
        else sound.score()
        setPopup({
          text: `+${hole.points}`,
          x: hole.x,
          y: hole.y - hole.radius,
          color: hole.is_jackpot ? '#2563eb' : '#16a34a',
          t: 0,
        })
        setMessage(hole.is_jackpot ? `🎯 JACKPOT! +${hole.points} poin` : `✅ +${hole.points} poin`)
        setLastScore(hole.points)
        setTotalScore(s => s + hole.points)
    } else {
      // meleset -> bola jatuh ke bawah
      sound.miss()
      const t0 = performance.now()
      const fall = (now) => {
        const p = Math.min((now - t0) / 320, 1)
        setBall(b => ({ x: b.x, y: ty + p * 60, scale: 1, alpha: 1 - p * 0.7 }))
        if (p < 1) requestAnimationFrame(fall)
      }
      requestAnimationFrame(fall)
      setMessage('❌ Meleset!')
      setLastScore(0)
    }

    setAttemptLog(prev => [...prev, {
      attempt_number: next,
      is_successful: Boolean(hole),
      points: hole ? hole.points : 0,
      zone_name: hole ? hole.id : null,
    }])
    setAttempts(next)

    if (next >= maxAttempts) {
      setTimeout(() => {
        setGameComplete(true)
        sound.finish()
        setTimeout(() => {
          sound.applause()
          setShowResultModal(true)
        }, 700)
      }, 1100)
    } else {
      setTimeout(() => {
        setBall({ x: START.x, y: START.y, scale: 1, alpha: 1 })
        setMessage('')
        setIsLocked(false)
      }, 950)
    }
  }

  // ---------- aksi ----------
  const resetGame = () => {
    setAttempts(0)
    setTotalScore(0)
    setLastScore(null)
    setMessage('')
    setGameComplete(false)
    setShowResultModal(false)
    setAttemptLog([])
    setSaveError('')
    setSaveResult(null)
    setIsSaving(false)
    setIsLocked(false)
    setHitEffect(null)
    setPopup(null)
    setBall({ x: START.x, y: START.y, scale: 1, alpha: 1 })
  }

  const handleSubmitScore = async () => {
    if (isSaving || saveResult || !player?.id) return
    setIsSaving(true)
    setSaveError('')
    try {
      const result = await api.submitSimulationRound(player.id, attemptLog)
      setSaveResult(result)
      setTimeout(() => navigate('/leaderboard'), 1300)
    } catch (err) {
      setSaveError(err.message || 'Gagal menyimpan skor. Coba lagi.')
      setIsSaving(false)
    }
  }

  const maxScore = board.max_round_score
  const rating = totalScore >= maxScore * 0.6 ? '🏆 Luar Biasa!'
    : totalScore >= maxScore * 0.3 ? '👍 Hebat!'
    : '💪 Coba Lagi!'

  return (
    <div className="container-narrow py-4 sm:py-6">
      {/* Header */}
      <div className="relative text-center mb-3 sm:mb-4">
        <h1 className="text-base sm:text-xl font-display font-bold text-gray-900 flex items-center justify-center space-x-2">
          <Gamepad2 className="w-5 h-5 text-primary-600" />
          <span>Shoot Points Game</span>
        </h1>
        {playerName && (
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Pemain: <span className="font-semibold text-gray-700">{playerName}</span>
          </p>
        )}
        <button
          onClick={() => setIsMuted(sound.toggleMute())}
          className="absolute right-0 top-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title={isMuted ? 'Nyalakan suara' : 'Matikan suara'}
          aria-label={isMuted ? 'Nyalakan suara' : 'Matikan suara'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Pesan hasil lemparan */}
      <div className="h-9 mb-1 flex items-center justify-center">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-3 py-1.5 rounded-lg text-center font-semibold text-xs sm:text-sm ${
              message.includes('JACKPOT') ? 'bg-blue-50 text-blue-700'
                : message.includes('✅') ? 'bg-green-50 text-green-700'
                : message.includes('❌') ? 'bg-red-50 text-red-700'
                : 'bg-yellow-50 text-yellow-700'
            }`}
          >
            {message}
          </motion.div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
        <div className="bg-white rounded-xl shadow-sm p-2.5 border border-gray-100 text-center">
          <div className="text-xs text-gray-500">Percobaan</div>
          <div className="text-base sm:text-xl font-display font-bold text-primary-600">
            {Math.min(attempts + (gameComplete ? 0 : 1), maxAttempts)}/{maxAttempts}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-2.5 border border-gray-100 text-center">
          <div className="text-xs text-gray-500">Terakhir</div>
          <div className="text-base sm:text-xl font-display font-bold text-yellow-600">
            {lastScore === null ? '—' : lastScore}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-2.5 border border-gray-100 text-center">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-base sm:text-xl font-display font-bold text-green-600">{totalScore}</div>
        </div>
      </div>

      {/* Riwayat percobaan */}
      <div className="flex gap-1.5 mb-3">
        {Array.from({ length: maxAttempts }, (_, i) => {
          const log = attemptLog[i]
          const isNow = i === attempts && !gameComplete
          return (
            <div
              key={i}
              className={`flex-1 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${
                log
                  ? log.is_successful
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-500'
                  : isNow
                    ? 'bg-primary-50 border-primary-400 text-primary-600'
                    : 'bg-white border-gray-200 text-gray-300'
              }`}
            >
              {log ? (log.is_successful ? log.points : '×') : i + 1}
            </div>
          )
        })}
      </div>

      {/* Canvas */}
      <div className="flex justify-center mb-3">
        <div className="relative bg-white rounded-2xl shadow-md overflow-hidden" style={{ width: '100%', maxWidth: '300px' }}>
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            className="w-full h-auto touch-none block"
            onPointerDown={handleStart}
            onPointerMove={handleMove}
            onPointerUp={handleEnd}
            onPointerCancel={handleEnd}
          />
        </div>
      </div>

      {/* Instruksi */}
      <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
        <h3 className="font-semibold text-xs sm:text-sm text-blue-900 mb-1.5 flex items-center space-x-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Cara Bermain</span>
        </h3>
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Tarik bola ke arah berlawanan</strong> dari lubang yang dituju — seperti ketapel —
          lalu lepas. Panah pendek menunjukkan <strong>arah</strong>, tapi jaraknya tebak sendiri
          lewat power bar: <span className="text-green-600 font-semibold">hijau</span> = dekat,
          <span className="text-amber-600 font-semibold"> kuning</span> = sedang,
          <span className="text-red-600 font-semibold"> merah</span> = paling jauh.
          Lubang biru kecil bernilai <strong>100</strong> — paling sulit tapi paling besar poinnya.
          Semua lubang memberikan poin saat terkena.
        </p>
      </div>

      {/* Modal hasil */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
          >
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Trophy className="w-8 h-8 text-white" fill="currentColor" />
            </div>

            <h2 className="text-xl font-display font-bold text-gray-900 mb-1">Selesai!</h2>
            <p className="text-sm text-gray-500 mb-4">Total Skor Kamu</p>

            <div className="bg-primary-50 rounded-xl p-4 mb-4">
              <div className="text-4xl font-display font-bold text-primary-600">{totalScore}</div>
              <div className="text-xs text-gray-500">dari maksimal {maxScore} poin</div>
            </div>

            <div className="text-sm font-semibold text-gray-700 mb-5">{rating}</div>

            {saveResult && (
              <div className={`rounded-xl p-3 mb-4 border ${saveResult.is_podium ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                <p className={`text-sm font-semibold ${saveResult.is_podium ? 'text-yellow-800' : 'text-green-800'}`}>
                  {saveResult.is_podium
                    ? `🎉 Masuk podium! Peringkat #${saveResult.estimated_rank}`
                    : `✅ Tersimpan! Peringkat #${saveResult.estimated_rank}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Mengalihkan ke leaderboard...</p>
              </div>
            )}

            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-red-700">{saveError}</p>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={handleSubmitScore}
                disabled={isSaving || Boolean(saveResult)}
                className="btn-primary w-full inline-flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>{saveResult ? 'Tersimpan ✓' : 'Simpan & Lihat Leaderboard'}</span>
                )}
              </button>
              <button
                onClick={resetGame}
                disabled={isSaving || Boolean(saveResult)}
                className="btn-secondary w-full inline-flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Main Lagi</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default PlayPage
