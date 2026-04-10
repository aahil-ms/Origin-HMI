import { Activity, Wifi, WifiOff, BotMessageSquare, LayoutDashboard, GitBranch, AlertOctagon, LogOut, Cpu } from 'lucide-react'
import { supabase } from '../supabaseClient'
function BatteryIcon({ level }) {
  const color = level > 50 ? 'var(--success)' : level > 20 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div title={`Battery ${level?.toFixed(0)}%`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 34, height: 16, border: `1.5px solid ${color}`,
        borderRadius: 3, position: 'relative', display: 'flex', alignItems: 'center', padding: '2px 2px',
      }}>
        <div style={{
          position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)',
          width: 4, height: 8, background: color, borderRadius: '0 2px 2px 0',
        }} />
        <div style={{
          width: `${Math.min(100, level || 0)}%`, height: '100%',
          background: color, borderRadius: 2,
          transition: 'width 0.5s ease',
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
      <span className="mono" style={{ fontSize: '0.75rem', color }}>{level?.toFixed(0)}%</span>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    idle:            { color: 'var(--text-secondary)', dot: 'blue',    label: 'IDLE' },
    moving:          { color: 'var(--accent)',          dot: 'blue',    label: 'MOVING' },
    emergency_stop:  { color: 'var(--danger)',          dot: 'red',     label: 'E-STOP' },
    executing:       { color: 'var(--success)',         dot: 'green',   label: 'EXECUTING' },
    paused:          { color: 'var(--warning)',         dot: 'yellow',  label: 'PAUSED' },
  }
  const s = map[status] || map['idle']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className={`pulse-dot ${s.dot}`} />
      <span className="mono" style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600 }}>{s.label}</span>
    </div>
  )
}

export default function Header({ connected, robotState, engineStatus, onEStop, activeTab, setActiveTab }) {
  const robotStatus = engineStatus.running
    ? (engineStatus.paused ? 'paused' : 'executing')
    : (robotState.status || 'idle')

  return (
    <header style={{
      height: 56,
      background: 'rgba(2, 6, 23, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(0, 212, 255, 0.12)',
      boxShadow: '0 1px 30px rgba(0, 212, 255, 0.06)',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      gap: 16, flexShrink: 0, position: 'relative', zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <div style={{
          width: 32, height: 32, background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--glow-accent)',
        }}>
          <BotMessageSquare size={18} color="#000" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: -0.5, lineHeight: 1.1, color: '#e2e8f0' }}>Origin HMI</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>⭐ Space Command Center</div>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(15, 23, 42, 0.6)', padding: 4, borderRadius: 10, border: '1px solid rgba(0,212,255,0.08)' }}>
        {[
          { id: 'flow',       icon: GitBranch,    label: 'Flow Builder',  color: '#00d4ff' },
          { id: 'dashboard',  icon: LayoutDashboard, label: 'Dashboard',  color: '#a855f7' },
          { id: 'simulation', icon: Cpu,          label: 'Digital Twin',  color: '#fbbf24' },
        ].map(({ id, icon: Icon, label, color }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
              background: activeTab === id ? `${color}18` : 'transparent',
              color: activeTab === id ? color : 'var(--text-secondary)',
              boxShadow: activeTab === id ? `inset 0 0 0 1px ${color}50, 0 0 12px ${color}20` : 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (activeTab !== id) e.currentTarget.style.color = color }}
            onMouseLeave={e => { if (activeTab !== id) e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Workflow running indicator */}
      {engineStatus.running && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
          borderRadius: 8, padding: '4px 12px', fontSize: '0.78rem',
        }}>
          <Activity size={13} style={{ color: 'var(--accent)' }} className="blink" />
          <span style={{ color: 'var(--accent)' }}>
            {engineStatus.workflowName} — Step {engineStatus.currentStep}/{engineStatus.totalSteps}
          </span>
        </div>
      )}

      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {connected
          ? <Wifi size={14} style={{ color: 'var(--success)' }} />
          : <WifiOff size={14} style={{ color: 'var(--danger)' }} />}
        <span style={{ fontSize: '0.75rem', color: connected ? 'var(--success)' : 'var(--danger)' }}>
          {connected ? 'Connected' : 'Offline'}
        </span>
        {robotState.simMode && (
          <span className="badge badge-warning" style={{ marginLeft: 4, fontSize: '0.65rem' }}>SIM</span>
        )}
      </div>

      {/* Battery */}
      <BatteryIcon level={robotState.battery} />

      {/* Robot status */}
      <StatusPill status={robotStatus} />

      {/* E-STOP */}
      <button onClick={onEStop} className="btn btn-danger btn-sm"
        style={{ marginLeft: 8, fontWeight: 800, letterSpacing: 1, gap: 6 }}>
        <AlertOctagon size={14} />
        E-STOP
      </button>

      {/* Logout */}
      <button
        onClick={() => supabase.auth.signOut()}
        title="Sign out"
        style={{
          marginLeft: 6, display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600,
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <LogOut size={13} />
        Logout
      </button>
    </header>
  )
}
