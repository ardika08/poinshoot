import { useEffect, useRef } from 'react'

/**
 * HeroAnimation - Colorful, playful preview for students
 * Ketapel otomatis, target warna-warni, glow, trail, burst, dan popup poin.
 */
const HeroAnimation = () => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const W = 280
    const H = 320

    // Colorful holes with varied sizes — no zero-point hole in the public preview
    const holes = [
      { x: 70,  y: 80,  radius: 22, points: 20, color: '#f97316' },
      { x: 210, y: 80,  radius: 18, points: 100, color: '#2563eb', jackpot: true },
      { x: 140, y: 130, radius: 18, points: 40, color: '#22c55e' },
      { x: 60,  y: 170, radius: 20, points: 15, color: '#06b6d4' },
      { x: 220, y: 170, radius: 19, points: 50, color: '#a855f7' },
      { x: 140, y: 200, radius: 21, points: 30, color: '#eab308' },
    ]

    // Ball state
    let ball = { x: W / 2, y: H - 20, vx: 0, vy: 0, radius: 7 }
    let phase = 'idle' // idle -> aim -> shoot -> land -> reset
    let phaseTimer = 0
    let targetHole = null
    let hitPoints = 0
    let popups = []
    let particles = []
    let trail = []

    const pickTarget = () => {
      return holes[Math.floor(Math.random() * holes.length)]
    }

    const reset = () => {
      ball = { x: W / 2, y: H - 20, vx: 0, vy: 0, radius: 7 }
      phase = 'idle'
      phaseTimer = 0
      targetHole = null
      hitPoints = 0
      particles = []
      trail = []
    }

    const addPopup = (x, y, text, color) => {
      popups.push({ x, y, text, color, life: 1, vy: -0.8 })
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H)

      holes.forEach(hole => {
        // colorful glow + filled target
        ctx.save()
        ctx.shadowColor = hole.color
        ctx.shadowBlur = hole.jackpot ? 16 : 8
        ctx.beginPath()
        ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2)
        ctx.fillStyle = `${hole.color}22`
        ctx.fill()
        ctx.strokeStyle = hole.color
        ctx.lineWidth = hole.jackpot ? 4 : 2.5
        ctx.stroke()
        ctx.restore()

        ctx.beginPath()
        ctx.arc(hole.x, hole.y, hole.radius - 5, 0, Math.PI * 2)
        ctx.fillStyle = '#172554'
        ctx.fill()
        ctx.strokeStyle = `${hole.color}99`
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${hole.jackpot ? 13 : 11}px Poppins, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(hole.points, hole.x, hole.y)
      })

      // ===== Phase: idle (pause before next shot) =====
      if (phase === 'idle') {
        phaseTimer++
        if (phaseTimer > 40) {
          targetHole = pickTarget()
          phase = 'aim'
          phaseTimer = 0
        }
      }

      // ===== Phase: aim (draw trajectory) =====
      if (phase === 'aim') {
        phaseTimer++
        const progress = Math.min(phaseTimer / 30, 1)

        // Animated short trajectory / aim arrow
        const dx = targetHole.x - ball.x
        const dy = targetHole.y - ball.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const guide = Math.min(42, len * progress)
        ctx.save()
        ctx.setLineDash([5, 4])
        ctx.lineDashOffset = -phaseTimer * 0.7
        ctx.beginPath()
        ctx.moveTo(ball.x, ball.y)
        ctx.lineTo(ball.x + (dx / len) * guide, ball.y + (dy / len) * guide)
        ctx.strokeStyle = targetHole.color
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.restore()

        if (phaseTimer >= 30) {
          phase = 'shoot'
          phaseTimer = 0
          // Calculate velocity toward target
          const angle = Math.atan2(dy, dx)
          const speed = 5
          ball.vx = Math.cos(angle) * speed
          ball.vy = Math.sin(angle) * speed
        }
      }

      // ===== Phase: shoot (ball flies) =====
      if (phase === 'shoot') {
        ball.x += ball.vx
        ball.y += ball.vy
        trail.push({ x: ball.x, y: ball.y })

        // Check if ball reached target hole
        const dx = ball.x - targetHole.x
        const dy = ball.y - targetHole.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < targetHole.radius) {
          // Hit!
          hitPoints = targetHole.points
          phase = 'land'
          phaseTimer = 0

          // Highlight + confetti burst
          for (let i = 0; i < (targetHole.jackpot ? 22 : 12); i++) {
            const angle = (Math.PI * 2 * i) / (targetHole.jackpot ? 22 : 12)
            const speed = 1.2 + Math.random() * 2.2
            particles.push({ x: targetHole.x, y: targetHole.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: targetHole.color })
          }

          addPopup(targetHole.x, targetHole.y - targetHole.radius - 5, `+${hitPoints}`, targetHole.jackpot ? '#f59e0b' : targetHole.color)
        }

        // Miss if ball goes too far
        if (ball.y < -20 || ball.y > H + 20 || ball.x < -20 || ball.x > W + 20) {
          phase = 'land'
          phaseTimer = 0
          addPopup(ball.x, ball.y, 'Miss', '#ef4444')
        }
      }

      // ===== Phase: land (show result, then reset) =====
      if (phase === 'land') {
        phaseTimer++

        // Pulse effect on hit hole
        if (targetHole && hitPoints > 0) {
          const pulse = 1 + Math.sin(phaseTimer * 0.3) * 0.15
          ctx.beginPath()
          ctx.arc(targetHole.x, targetHole.y, targetHole.radius * pulse, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(2, 132, 199, ${Math.max(0, 1 - phaseTimer / 50)})`
          ctx.lineWidth = 3
          ctx.stroke()
        }

        if (phaseTimer > 50) {
          reset()
        }
      }

      // ===== Draw particles / confetti =====
      particles = particles.filter(p => p.life > 0)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.035
        p.life -= 0.035
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
        ctx.globalAlpha = 1
      })

      // ===== Draw moving trail =====
      trail = trail.slice(-8)
      trail.forEach((p, i) => {
        ctx.globalAlpha = (i / trail.length) * 0.35
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2 + i * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = targetHole?.color || '#fbbf24'
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // ===== Draw popups =====
      popups = popups.filter(p => p.life > 0)
      popups.forEach(p => {
        p.y += p.vy
        p.life -= 0.02
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.life
        ctx.font = 'bold 13px Poppins, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.text, p.x, p.y)
        ctx.globalAlpha = 1
      })

      // ===== Draw ball =====
      if (phase !== 'land' || phaseTimer < 8) {
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
        ctx.fillStyle = '#fbbf24'
        ctx.fill()
        ctx.strokeStyle = '#d97706'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // ===== Draw launcher base =====
      ctx.fillStyle = '#cbd5e1'
      ctx.beginPath()
      ctx.roundRect(ball.x - 12, H - 16, 24, 6, 3)
      ctx.fill()

      animationRef.current = requestAnimationFrame(animate)
    }

    // Polyfill roundRect
    if (!ctx.roundRect) {
      ctx.roundRect = function(x, y, w, h, r) {
        this.beginPath()
        this.moveTo(x + r, y)
        this.lineTo(x + w - r, y)
        this.quadraticCurveTo(x + w, y, x + w, y + r)
        this.lineTo(x + w, y + h - r)
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        this.lineTo(x + r, y + h)
        this.quadraticCurveTo(x, y + h, x, y + h - r)
        this.lineTo(x, y + r)
        this.quadraticCurveTo(x, y, x + r, y)
        this.closePath()
      }
    }

    animate()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <div className="relative flex justify-center items-center">
      <canvas
        ref={canvasRef}
        width={280}
        height={320}
        className="w-full max-w-[280px] h-auto"
      />
    </div>
  )
}

export default HeroAnimation
