import { Zap } from 'lucide-react'

export default function EmergencyStop() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      background: 'rgba(10,5,5,0.9)', padding: '40px 60px',
      borderRadius: 20, border: '2px solid var(--danger)',
      boxShadow: '0 0 60px rgba(239,68,68,0.5)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{ fontSize: 64, lineHeight: 1 }}>🛑</div>
      <h1 style={{ color: 'var(--danger)', fontSize: '2rem', fontWeight: 800, letterSpacing: 4 }}>
        EMERGENCY STOP
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
        All robot motion halted immediately
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warning)' }}>
        <Zap size={16} />
        <span className="mono" style={{ fontSize: '0.8rem' }}>CMD_VEL zeroed · Workflow stopped</span>
      </div>
    </div>
  )
}
