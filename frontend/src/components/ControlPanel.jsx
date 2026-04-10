import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpFromLine, ArrowDownToLine, Hand, Handshake, Square, Sparkles, Loader } from 'lucide-react'

const LOG_COLORS = { info: 'var(--text-secondary)', success: 'var(--success)', warn: 'var(--warning)', error: 'var(--danger)' }
const LOG_ICONS  = { info: '▸', success: '✓', warn: '⚠', error: '✗' }

export default function ControlPanel({ engineStatus, onSendVel, onRun, onPause, onResume, onStop, logs, currentWorkflow }) {
  const logsEndRef = useRef(null)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [precisionMode, setPrecisionMode] = useState(false)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const explainFlow = () => {
    if (!currentWorkflow || !currentWorkflow.nodes) {
      setExplanation("There is no active flow to explain.")
      return
    }
    setExplaining(true)
    setExplanation('')
    setTimeout(() => {
      const nodes = currentWorkflow.nodes
      const types = nodes.map(n => n.data?.type).filter(t => t !== 'start' && t !== 'end')
      let text = `This flow begins at Start, then it `
      if (types.length === 0) {
        text += 'does nothing and finishes.'
      } else if (types.length === 1) {
        text += `executes a ${types[0]} action before ending.`
      } else {
        text += `proceeds to ${types.slice(0, -1).join(', ')} and finally ${types[types.length - 1]}, before coming to a stop.`
      }
      setExplanation(text)
      setExplaining(false)
    }, 1500)
  }

  function sendManualMove(dir) {
    window.dispatchEvent(new CustomEvent('MANUAL_MOVE', { detail: { dir, precision: precisionMode } }))
  }

  function sendManualAction(actionName) {
    window.dispatchEvent(new CustomEvent('MANUAL_ACTION', { detail: { action: actionName } }))
  }

  const btnStyle = (bg = 'var(--bg-overlay)', activeColor = 'var(--accent)') => ({
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, border: '1px solid var(--border)', borderRadius: 10,
    cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Manual Drive */}
      <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 12 }}>Manual Drive</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 'fit-content', margin: '0 auto' }}>
          
          {/* XY Navigation (Base & Drive) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, margin: '0 auto' }}>
            <div />
            <button style={btnStyle('var(--accent-dim)')} onMouseDown={() => sendManualMove('FORWARD')} onMouseUp={() => sendManualMove('STOP')} title="Direct Move: Forward">
              <ArrowUp size={16} style={{ color: 'var(--accent)' }} />
            </button>
            <div />
            <button style={btnStyle()} onMouseDown={() => sendManualMove('LEFT')} onMouseUp={() => sendManualMove('STOP')} title="Direct Move: Strafe Left">
              <ArrowLeft size={16} />
            </button>
            <button style={{ ...btnStyle('rgba(239,68,68,0.15)'), border: '1px solid rgba(239,68,68,0.4)' }} onClick={() => sendManualMove('STOP')} title="Emergency Stop Base">
              <Square size={14} style={{ color: 'var(--danger)' }} />
            </button>
            <button style={btnStyle()} onMouseDown={() => sendManualMove('RIGHT')} onMouseUp={() => sendManualMove('STOP')} title="Direct Move: Strafe Right">
              <ArrowRight size={16} />
            </button>
            <div />
            <button style={btnStyle()} onMouseDown={() => sendManualMove('BACKWARD')} onMouseUp={() => sendManualMove('STOP')} title="Direct Move: Reverse">
              <ArrowDown size={16} />
            </button>
            <div />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {/* Z-Axis (Vertical) */}
            <button style={btnStyle()} onMouseDown={() => sendManualMove('UP')} onMouseUp={() => sendManualMove('STOP')} title="Arm Up">
              <ArrowUpFromLine size={16} color="#00d4ff" />
            </button>
            <button style={btnStyle()} onMouseDown={() => sendManualMove('DOWN')} onMouseUp={() => sendManualMove('STOP')} title="Arm Down">
              <ArrowDownToLine size={16} color="#00d4ff" />
            </button>
            
            {/* End Effector */}
            <button style={btnStyle('rgba(168, 85, 247, 0.1)', '#a855f7')} onClick={() => sendManualAction('PICK')} title="Close Gripper">
              <Handshake size={16} color="#ef4444" />
            </button>
            <button style={btnStyle('rgba(249, 115, 22, 0.1)', '#f97316')} onClick={() => sendManualAction('DROP')} title="Open Gripper">
              <Hand size={16} color="#f97316" />
            </button>
          </div>
        </div>
        
        {/* Precision Mode Toggle */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg-raised)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', width: 'fit-content', margin: '14px auto 0' }}>
          <span style={{ fontSize: '0.7rem', color: precisionMode ? '#22c55e' : 'var(--text-secondary)', fontWeight: 600 }}>Precision Mode (50% Spd)</span>
          <div 
            onClick={() => setPrecisionMode(!precisionMode)}
            style={{ width: 32, height: 18, background: precisionMode ? '#22c55e' : '#4b5563', borderRadius: 12, cursor: 'pointer', position: 'relative', transition: '0.3s' }}
          >
            <div style={{ position: 'absolute', top: 2, left: precisionMode ? 16 : 2, width: 14, height: 14, background: '#fff', borderRadius: '50%', transition: '0.3s' }} />
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 10 }}>
          [TELE-OPERATION MODE LIVE]
        </p>
      </div>

      {/* AI Flow Assistant */}
      <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} style={{ color: '#a855f7' }} /> AI Flow Assistant
        </h3>
        <button onClick={explainFlow} className="btn btn-ghost btn-sm" disabled={explaining} style={{ width: '100%', marginBottom: 8, border: '1px solid var(--accent2-dim)', color: 'var(--accent2)' }}>
          {explaining ? <Loader size={12} className="spin" /> : <Sparkles size={12} />}
          Explain Current Flow
        </button>
        {explanation && (
          <div style={{
            padding: '10px 12px', background: 'var(--accent2-dim)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-primary)',
            lineHeight: 1.4, animation: 'fadeIn 0.3s ease'
          }}>
            {explanation}
          </div>
        )}
      </div>

      {/* Execution Log */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 14 }}>
        <h3 style={{ marginBottom: 8 }}>Execution Log</h3>
        <div style={{
          flex: 1, overflowY: 'auto', background: 'var(--bg-base)',
          borderRadius: 8, padding: 8, border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {logs.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: 8, textAlign: 'center' }}>
              No logs yet
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} style={{
              display: 'flex', gap: 6, alignItems: 'flex-start',
              fontSize: '0.72rem', lineHeight: 1.4,
              animation: i === logs.length - 1 ? 'fadeIn 0.2s ease' : undefined,
            }}>
              <span style={{ color: LOG_COLORS[log.level] || 'var(--text-secondary)', flexShrink: 0 }}>
                {LOG_ICONS[log.level] || '▸'}
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: LOG_COLORS[log.level] || 'var(--text-secondary)',
                wordBreak: 'break-word',
              }}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  )
}
