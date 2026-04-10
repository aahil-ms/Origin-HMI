import { Handle, Position } from 'reactflow'

const TYPE_CONFIG = {
  // Core
  start:         { icon: '▶',  color: '#22c55e', label: 'START' },
  end:           { icon: '⏹',  color: '#ef4444', label: 'END' },
  navigate:      { icon: '🗺', color: '#00d4ff', label: 'NAVIGATE' },
  pick:          { icon: '🤏', color: '#a855f7', label: 'PICK' },
  place:         { icon: '📦', color: '#a855f7', label: 'PLACE' },
  wait:          { icon: '⏱', color: '#f59e0b', label: 'WAIT' },
  dock:          { icon: '🔌', color: '#22c55e', label: 'DOCK' },
  undock:        { icon: '🔓', color: '#22c55e', label: 'UNDOCK' },
  speak:         { icon: '💬', color: '#ec4899', label: 'SPEAK' },
  charge:        { icon: '⚡', color: '#84cc16', label: 'CHARGE' },
  camera_vision: { icon: '📷', color: '#38bdf8', label: 'CAMERA VISION' },
  lidar_scan:    { icon: '🔦', color: '#34d399', label: 'LIDAR SCAN' },
  conditional:   { icon: '🔀', color: '#fb923c', label: 'CONDITIONAL' },
  loop:          { icon: '🔄', color: '#c084fc', label: 'LOOP / REPEAT' },
  sensor_wait:   { icon: '🎛️', color: '#fbbf24', label: 'SENSOR WAIT' },
  // ─ TVS Sensors (Blue) ───────────────────────────────────
  lidar_scanner:    { icon: '🔵', color: '#3b82f6', label: 'LIDAR SCANNER' },
  thermal_threshold:{ icon: '🌡️', color: '#60a5fa', label: 'THERMAL THRESH.' },
  proximity_sensor: { icon: '📶', color: '#93c5fd', label: 'PROXIMITY SENSOR' },
  // ─ TVS Actuators (Orange) ─────────────────────────────
  pneumatic_gripper:{ icon: '✊', color: '#f97316', label: 'PNEUMATIC GRIPPER' },
  arc_weld_path:    { icon: '🔥', color: '#fb923c', label: 'ARC WELD PATH' },
  conveyor_sync:    { icon: '➡️', color: '#fdba74', label: 'CONVEYOR SYNC' },
  // ─ TVS Control Flow (Purple) ───────────────────────────
  if_else:         { icon: '❓', color: '#8b5cf6', label: 'IF/ELSE' },
  parallel_fork:   { icon: '―✿', color: '#a78bfa', label: 'PARALLEL FORK' },
  wait_for_state:  { icon: '⏳', color: '#c4b5fd', label: 'WAIT FOR STATE' },
  // ─ TVS AI Vision (Green) ───────────────────────────────
  ml_defect_check:    { icon: '🔍', color: '#22c55e', label: 'ML DEFECT CHECK' },
  safety_zone_monitor:{ icon: '🛡️', color: '#4ade80', label: 'SAFETY ZONE MON.' },
}

export default function CustomNode({ data, selected }) {
  const cfg = TYPE_CONFIG[data.type] || { icon: '◆', color: '#8b95b0', label: 'ACTION' }
  const isStart = data.type === 'start'
  const isEnd   = data.type === 'end'

  const isInvalid = !!data.invalid
  const glowColor = isInvalid ? '#f59e0b' : data.executing ? '#00d4ff' : data.done ? '#22c55e' : cfg.color

  return (
    <div style={{
      minWidth: 150, padding: '10px 14px',
      background: isInvalid
        ? 'rgba(245,158,11,0.15)'
        : data.executing
          ? 'rgba(0,212,255,0.12)'
          : data.done
            ? 'rgba(34,197,94,0.10)'
            : 'var(--bg-raised)',
      border: `1.5px solid ${selected ? '#ffffff' : glowColor}`,
      borderRadius: 12,
      boxShadow: isInvalid
        ? `0 0 0 2px rgba(245,158,11,0.6), 0 0 25px rgba(245,158,11,0.4)`
        : data.executing
          ? `0 0 0 2px rgba(0,212,255,0.4), 0 0 20px rgba(0,212,255,0.3)`
          : data.done
            ? `0 0 12px rgba(34,197,94,0.2)`
            : selected
              ? '0 0 0 2px rgba(255,255,255,0.3)'
              : `0 2px 12px rgba(0,0,0,0.4)`,
      transition: 'all 0.25s ease',
      cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Input handle */}
      {!isStart && (
        <Handle type="target" position={Position.Left}
          style={{ background: cfg.color, border: 'none', width: 10, height: 10 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${cfg.color}22`,
          border: `1px solid ${cfg.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
        }}>
          {data.executing ? (
            <div style={{
              width: 14, height: 14, border: '2px solid var(--accent)',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          ) : isInvalid ? <span style={{color: '#f59e0b'}}>⚠</span> : data.done ? '✓' : cfg.icon}
        </div>

        <div>
          <div style={{ fontSize: '0.65rem', color: cfg.color, fontWeight: 700, letterSpacing: 0.8, lineHeight: 1 }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginTop: 2 }}>
            {data.label}
          </div>
          {data.params && Object.keys(data.params).length > 0 && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {Object.entries(data.params).map(([k, v]) => `${k}=${v}`).join(' · ')}
            </div>
          )}
          {isInvalid && (
            <div style={{ fontSize: '0.68rem', color: 'var(--warning)', marginTop: 4, fontWeight: 600 }}>
              {data.invalid}
            </div>
          )}
        </div>
      </div>

      {/* Status bar when executing */}
      {data.executing && (
        <div style={{
          marginTop: 8, height: 3, borderRadius: 99,
          background: 'var(--bg-overlay)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: '60%', background: 'var(--accent)',
            borderRadius: 99,
            animation: 'dashmarch 1s linear infinite',
          }} />
        </div>
      )}

      {/* Output handle */}
      {!isEnd && (
        <Handle type="source" position={Position.Right}
          style={{ background: cfg.color, border: 'none', width: 10, height: 10 }} />
      )}
    </div>
  )
}
