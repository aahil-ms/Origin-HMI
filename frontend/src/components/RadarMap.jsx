import { useEffect, useRef } from 'react'

const MAP_SIZE = 20   // world units shown on each axis (−10 to +10 metres)
const GRID_STEP = 2   // grid lines every 2 metres

export default function RadarMap({ robotPosition = { x: 0, y: 0 } }) {
  const canvasRef = useRef(null)
  const pulseRef  = useRef(0)
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const W = canvas.width
    const H = canvas.height

    // World → canvas coordinate transform
    const toCanvas = (wx, wy) => ({
      cx: ((wx + MAP_SIZE / 2) / MAP_SIZE) * W,
      cy: H - ((wy + MAP_SIZE / 2) / MAP_SIZE) * H,   // flip Y
    })

    const draw = (ts) => {
      pulseRef.current = ts

      // Background
      ctx.fillStyle = '#070d14'
      ctx.fillRect(0, 0, W, H)

      // Grid lines
      const gridPixelStep = (GRID_STEP / MAP_SIZE) * W
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)'
      ctx.lineWidth = 1
      for (let gx = 0; gx <= W; gx += gridPixelStep) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
      }
      for (let gy = 0; gy <= H; gy += gridPixelStep) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
      }

      // Axis cross-hair
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.18)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()

      // Robot dot with pulsing glow
      const { cx, cy } = toCanvas(robotPosition.x, robotPosition.y)
      const pulseScale = 1 + 0.4 * Math.sin(ts / 400)
      const outerR = 16 * pulseScale

      // Outer pulse ring
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR)
      grad.addColorStop(0,   'rgba(34, 197, 94, 0.3)')
      grad.addColorStop(0.6, 'rgba(34, 197, 94, 0.1)')
      grad.addColorStop(1,   'rgba(34, 197, 94, 0)')
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Solid dot
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#22c55e'
      ctx.shadowColor = '#22c55e'
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0

      // Origin marker
      const { cx: ox, cy: oy } = toCanvas(0, 0)
      ctx.beginPath()
      ctx.arc(ox, oy, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,212,255,0.4)'
      ctx.fill()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [robotPosition.x, robotPosition.y])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
        2D Radar Map — ROS2 Sim
      </div>
      <canvas
        ref={canvasRef}
        width={220}
        height={220}
        style={{
          borderRadius: 12,
          border: '1px solid rgba(0,212,255,0.2)',
          display: 'block',
          boxShadow: '0 0 20px rgba(0,212,255,0.05)',
        }}
      />
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
        x={robotPosition.x?.toFixed(2) ?? '0.00'} &nbsp; y={robotPosition.y?.toFixed(2) ?? '0.00'}
      </div>
    </div>
  )
}
