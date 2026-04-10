import { useEffect, useRef } from 'react'
import { Battery, MapPin, Activity, Cpu } from 'lucide-react'

function StatCard({ icon: Icon, label, value, unit, color = 'var(--accent)', sub }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}20`, border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
          {unit && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{unit}</span>}
        </div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

function RobotMap({ position }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

    // Waypoints (static for demo)
    const waypoints = [[80, 60], [200, 60], [200, 160], [80, 160]]
    ctx.strokeStyle = 'rgba(0,212,255,0.2)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    waypoints.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.closePath(); ctx.stroke()
    ctx.setLineDash([])

    waypoints.forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,212,255,0.4)'; ctx.fill()
      ctx.strokeStyle = 'rgba(0,212,255,0.8)'; ctx.lineWidth = 1; ctx.stroke()
    })

    // Robot position (map real coords to canvas)
    const scale = 20
    const cx = w / 2 + (position?.x || 0) * scale
    const cy = h / 2 - (position?.y || 0) * scale
    const theta = position?.theta || 0

    // Robot shadow
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,212,255,0.08)'; ctx.fill()

    // Robot body
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2)
    ctx.fillStyle = '#0a0c10'; ctx.fill()
    ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2; ctx.stroke()

    // Direction arrow
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(theta) * 12, cy - Math.sin(theta) * 12)
    ctx.lineTo(cx + Math.cos(theta + 2.4) * 7, cy - Math.sin(theta + 2.4) * 7)
    ctx.lineTo(cx + Math.cos(theta - 2.4) * 7, cy - Math.sin(theta - 2.4) * 7)
    ctx.closePath()
    ctx.fillStyle = '#00d4ff'; ctx.fill()

    // Glow
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,212,255,0.3)'; ctx.lineWidth = 4; ctx.stroke()

    // Origin
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill()
  }, [position])

  return (
    <canvas ref={canvasRef} width={300} height={220}
      style={{ borderRadius: 10, background: 'var(--bg-base)', width: '100%', maxWidth: 300 }} />
  )
}

function LogFeed({ logs }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const color = { info: 'var(--text-secondary)', success: 'var(--success)', warn: 'var(--warning)', error: 'var(--danger)' }
  const icon  = { info: '▸', success: '✓', warn: '⚠', error: '✗' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {logs.slice(-100).map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            {new Date(l.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span style={{ color: color[l.level], flexShrink: 0 }}>{icon[l.level]}</span>
          <span style={{ color: color[l.level] }}>{l.message}</span>
        </div>
      ))}
      <div ref={ref} />
    </div>
  )
}

export default function Dashboard({ robotState, engineStatus, logs }) {
  const bat = robotState?.battery ?? 0
  const batColor = bat > 50 ? 'var(--success)' : bat > 20 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 320px',
      gridTemplateRows: 'auto 1fr',
      gap: 16, padding: 20, height: '100%', overflow: 'auto',
    }}>
      {/* Stats row */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12 }}>
        <StatCard icon={Battery} label="Battery" value={bat.toFixed(1)} unit="%" color={batColor}
          sub={bat < 20 ? '⚠ Low — charge soon' : 'Nominal'} />
        <StatCard icon={MapPin} label="Position" value={`${(robotState?.position?.x||0).toFixed(2)}, ${(robotState?.position?.y||0).toFixed(2)}`} unit="m"
          color="var(--accent2)" sub={`θ = ${((robotState?.position?.theta||0) * 180 / Math.PI).toFixed(1)}°`} />
        <StatCard icon={Activity} label="Workflow Step" value={engineStatus.running ? engineStatus.currentStep : '–'}
          unit={engineStatus.running ? `/ ${engineStatus.totalSteps}` : ''}
          color="var(--accent)" sub={engineStatus.workflowName || 'No workflow running'} />
        <StatCard icon={Cpu} label="Mode" value={robotState?.simMode ? 'SIM' : 'LIVE'}
          color={robotState?.simMode ? 'var(--warning)' : 'var(--success)'}
          sub={robotState?.simMode ? 'Simulation active' : 'ROS2 connected'} />
      </div>

      {/* Map */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>Robot Position Map</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Origin-centered coordinate frame</p>
        <RobotMap position={robotState?.position} />
        <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span>X: <strong style={{ color: 'var(--accent)' }}>{(robotState?.position?.x||0).toFixed(3)} m</strong></span>
          <span>Y: <strong style={{ color: 'var(--accent)' }}>{(robotState?.position?.y||0).toFixed(3)} m</strong></span>
          <span>θ: <strong style={{ color: 'var(--accent)' }}>{((robotState?.position?.theta||0)*180/Math.PI).toFixed(1)}°</strong></span>
        </div>
      </div>

      {/* Battery timeline */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>System Status</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {[
            { label: 'Battery Level', value: bat, max: 100, color: batColor, unit: '%' },
            { label: 'Workflow Progress', value: engineStatus.running ? (engineStatus.currentStep / Math.max(engineStatus.totalSteps, 1)) * 100 : 0, max: 100, color: 'var(--accent)', unit: '%' },
            { label: 'CPU Load (sim)', value: 34, max: 100, color: 'var(--accent2)', unit: '%' },
            { label: 'Memory (sim)', value: 62, max: 100, color: '#f59e0b', unit: '%' },
          ].map(({ label, value, color, unit }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span className="mono" style={{ color }}>{value.toFixed(0)}{unit}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-overlay)', borderRadius: 99 }}>
                <div style={{
                  height: '100%', width: `${Math.min(100, value)}%`,
                  background: color, borderRadius: 99,
                  boxShadow: `0 0 8px ${color}`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Robot state badges */}
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { label: 'Motors', ok: true },
            { label: 'LiDAR', ok: !robotState?.simMode },
            { label: 'Camera', ok: !robotState?.simMode },
            { label: 'Nav Stack', ok: engineStatus.running },
            { label: 'Arm', ok: false },
            { label: 'rosbridge', ok: !robotState?.simMode },
          ].map(({ label, ok }) => (
            <span key={label} className={`badge ${ok ? 'badge-success' : 'badge-muted'}`}>
              <span className={`pulse-dot ${ok ? 'green' : 'muted'}`} style={{ width: 6, height: 6 }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Log feed */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, gridRow: 2, overflow: 'hidden' }}>
        <h2>Execution Log</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['info', 'success', 'warn', 'error'].map(l => (
            <span key={l} className={`badge badge-${l === 'info' ? 'info' : l === 'success' ? 'success' : l === 'warn' ? 'warning' : 'danger'}`}>
              {logs.filter(x => x.level === l).length} {l}
            </span>
          ))}
        </div>
        <LogFeed logs={logs} />
      </div>
    </div>
  )
}
