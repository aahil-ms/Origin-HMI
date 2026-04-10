import { useState, useEffect } from 'react'
import {
  Play, Pause, Square, Save, FolderOpen, Trash2, Plus, ChevronRight, ChevronDown, Loader, ShieldAlert,
  BookOpen, MousePointer, Link2, Settings, Users,
  Radio, Thermometer, Radar,           // Sensors
  Hand, Flame, ArrowRight,             // Actuators
  GitBranch, GitFork, Timer,           // Control Flow
  ScanSearch, ShieldCheck,             // AI Vision
  MapPin, Zap, Navigation,             // Navigation
  ArrowUpFromLine, ArrowDownToLine, ArrowLeftRight, // Direct Motion
} from 'lucide-react'

// ── TVS Automotive Node Categories ────────────────────────────────
const TVS_CATEGORIES = [
  {
    id: 'sensors',
    label: 'Sensors',
    accent: '#3b82f6',
    icon: Radio,
    nodes: [
      { type: 'lidar_scanner',     label: 'Barcode / RFID Scan',      icon: Radar,       color: '#3b82f6' },
      { type: 'thermal_threshold', label: 'Hazardous Material Check',  icon: Thermometer, color: '#60a5fa' },
      { type: 'proximity_sensor',  label: 'Proximity Sensor',   icon: Radio,       color: '#93c5fd' },
    ],
  },
  {
    id: 'actuators',
    label: 'Actuators',
    accent: '#f97316',
    icon: Hand,
    nodes: [
      { type: 'pneumatic_gripper', label: 'Item Induction',  icon: Hand,        color: '#f97316' },
      { type: 'arc_weld_path',     label: 'Arc Weld Path',      icon: Flame,       color: '#fb923c' },
      { type: 'conveyor_sync',     label: 'Conveyor Sync',      icon: ArrowRight,  color: '#fdba74' },
    ],
  },
  {
    id: 'control_flow',
    label: 'Control Flow',
    accent: '#8b5cf6',
    icon: GitBranch,
    nodes: [
      { type: 'if_else',          label: 'IF/ELSE Condition',  icon: GitBranch,   color: '#8b5cf6' },
      { type: 'parallel_fork',    label: 'Parallel Fork',      icon: GitFork,     color: '#a78bfa' },
      { type: 'wait_for_state',   label: 'Wait for State',     icon: Timer,       color: '#c4b5fd' },
    ],
  },
  {
    id: 'ai_vision',
    label: 'AI Vision',
    accent: '#22c55e',
    icon: ScanSearch,
    nodes: [
      { type: 'ml_defect_check',      label: 'ML Defect Check',       icon: ScanSearch,  color: '#22c55e' },
      { type: 'safety_zone_monitor',  label: 'Safety Zone Monitor',   icon: ShieldCheck, color: '#4ade80' },
    ],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    accent: '#00d4ff',
    icon: Navigation,
    nodes: [
      { type: 'navigate_stop_1',  label: 'Navigate to Stop 1',  icon: MapPin,           color: '#00d4ff' },
      { type: 'navigate_stop_2',  label: 'Navigate to Stop 2',  icon: MapPin,           color: '#a855f7' },
      { type: 'dock_and_charge',  label: 'Dock & Charge',       icon: Zap,              color: '#fbbf24' },
      { type: 'linear_front',     label: 'Linear Front',        icon: ArrowUpFromLine,  color: '#22c55e' },
      { type: 'linear_back',      label: 'Linear Back',         icon: ArrowDownToLine,  color: '#ef4444' },
      { type: 'lateral_strafe',   label: 'Lateral Strafe',      icon: ArrowLeftRight,   color: '#34d399' },
    ],
  },
]

// Legacy flat palette (kept for backward compatibility)
const NODE_TYPES = [
  { type: 'navigate', label: '🗺 Navigate',   color: '#00d4ff', group: 'Motion' },
  { type: 'pick',     label: '🤏 Pick',       color: '#a855f7', group: 'Motion' },
  { type: 'place',    label: '📦 Place',      color: '#a855f7', group: 'Motion' },
  { type: 'dock',     label: '🔌 Dock',       color: '#22c55e', group: 'Motion' },
  { type: 'undock',   label: '🔓 Undock',     color: '#22c55e', group: 'Motion' },
  { type: 'charge',   label: '⚡ Charge',     color: '#84cc16', group: 'Motion' },
  { type: 'wait',     label: '⏱ Wait',       color: '#f59e0b', group: 'Utility' },
  { type: 'speak',    label: '💬 Speak',      color: '#ec4899', group: 'Utility' },
  { type: 'camera_vision', label: '📷 Camera Vision',   color: '#38bdf8', group: 'Advanced' },
  { type: 'lidar_scan',    label: '🔦 LIDAR Scan',       color: '#34d399', group: 'Advanced' },
  { type: 'conditional',   label: '🔀 Conditional',      color: '#fb923c', group: 'Advanced' },
  { type: 'loop',          label: '🔄 Loop / Repeat',    color: '#c084fc', group: 'Advanced' },
  { type: 'sensor_wait',   label: '🎛️ Wait for Sensor', color: '#fbbf24', group: 'Advanced' },
]

export default function Sidebar({ currentWorkflow, setCurrentWorkflow, engineStatus, onRun, onPause, onResume, onStop, backend, showToast }) {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wfName, setWfName] = useState('')
  const [openSections, setOpenSections] = useState({ sensors: true, actuators: false, control_flow: false, ai_vision: false, navigation: false, legacy: false })

  const toggleSection = (id) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))

  useEffect(() => {
    fetchSavedWorkflows()
  }, [])

  async function fetchSavedWorkflows() {
    setLoading(true)
    try {
      const stored = localStorage.getItem('ORIGIN_WORKFLOWS')
      setWorkflows(stored ? JSON.parse(stored) : [])
    } catch (e) {
      console.error("Failed to load local workflows", e)
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }

  async function saveWorkflow() {
    setSaving(true)
    // Fire event — FlowBuilder listens, prompts user, and saves with live nodes/edges
    window.dispatchEvent(new CustomEvent('SAVE_CURRENT_FLOW'))
  }

  // Listen for save result
  useEffect(() => {
    const onSaved = (e) => {
      setSaving(false)
      setCurrentWorkflow(e.detail)
      fetchSavedWorkflows()
      showToast(`✅ Workflow "${e.detail.name}" saved!`, 'success')
    }
    const onError = (e) => {
      setSaving(false)
      showToast(`❌ Save failed: ${e.detail.msg}`, 'error')
    }
    window.addEventListener('WORKFLOW_SAVED', onSaved)
    window.addEventListener('WORKFLOW_SAVE_ERROR', onError)
    return () => {
      window.removeEventListener('WORKFLOW_SAVED', onSaved)
      window.removeEventListener('WORKFLOW_SAVE_ERROR', onError)
    }
  }, [])

  async function deleteWorkflow(id) {
    if (id.startsWith('tpl-')) return
    const stored = localStorage.getItem('ORIGIN_WORKFLOWS')
    if (stored) {
      const list = JSON.parse(stored)
      const filtered = list.filter(w => w.id !== id)
      localStorage.setItem('ORIGIN_WORKFLOWS', JSON.stringify(filtered))
    }
    if (currentWorkflow?.id === id) setCurrentWorkflow(null)
    fetchSavedWorkflows()
  }

  const isRunning = engineStatus.running
  const isPaused  = engineStatus.paused

  function onDragStart(e, nodeType) {
    e.dataTransfer.setData('application/reactflow-type', nodeType.type)
    e.dataTransfer.setData('application/reactflow-label', nodeType.label)
    e.dataTransfer.effectAllowed = 'move'
  }

  const simulateSafetyCheck = () => {
    if (!currentWorkflow || !currentWorkflow.nodes) return
    let navIndex = currentWorkflow.nodes.findIndex(n => n.data?.type === 'navigate')
    if (navIndex >= 0) {
      showToast('⚠️ Safety Warning: Path from WP1 to WP2 crosses a restricted forklift zone. Consider adding a \'Wait\' node.', 'warn')
      const updatedNodes = [...currentWorkflow.nodes]
      updatedNodes[navIndex] = {
        ...updatedNodes[navIndex],
        data: { ...updatedNodes[navIndex].data, invalid: 'Crosses restricted zone' }
      }
      setCurrentWorkflow(prev => ({ ...prev, nodes: updatedNodes }))
    } else {
      showToast('Flow looks safe. No hazardous navigation paths detected.', 'info')
    }
  }

  return (
    <aside style={{
      width: 220, background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Workflow Controls */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 10 }}>Workflow</h3>
        <input
          value={wfName || currentWorkflow?.name || ''}
          onChange={e => setWfName(e.target.value)}
          placeholder="Workflow name…"
          style={{
            width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 7, padding: '6px 10px', color: 'var(--text-primary)',
            fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 8,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={saveWorkflow} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
            {saving ? <Loader size={12} className="spin" /> : <Save size={12} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => {
              setCurrentWorkflow(null)
              setWfName('')
              showToast('New canvas ready — drag nodes to begin', 'info')
            }}
            className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
            <Plus size={12} /> New
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={simulateSafetyCheck} className="btn btn-ghost btn-sm" style={{ flex: 1, borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--warning)' }} disabled={!currentWorkflow}>
            <ShieldAlert size={12} /> Validate Safety
          </button>
        </div>

        {/* Run/Pause/Stop */}
        <div style={{ display: 'flex', gap: 6 }}>
          {!isRunning ? (
            <button onClick={() => onRun(currentWorkflow)} className="btn btn-success btn-sm"
              style={{ flex: 1 }} disabled={!currentWorkflow}>
              <Play size={12} /> Run
            </button>
          ) : isPaused ? (
            <button onClick={onResume} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
              <Play size={12} /> Resume
            </button>
          ) : (
            <button onClick={onPause} className="btn btn-warning btn-sm" style={{ flex: 1 }}>
              <Pause size={12} /> Pause
            </button>
          )}
          <button onClick={onStop} className="btn btn-ghost btn-sm" disabled={!isRunning}>
            <Square size={12} />
          </button>
        </div>

        {isRunning && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              <span>Step {engineStatus.currentStep}/{engineStatus.totalSteps}</span>
              <span>{Math.round((engineStatus.currentStep / Math.max(engineStatus.totalSteps, 1)) * 100)}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg-overlay)', borderRadius: 99 }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${(engineStatus.currentStep / Math.max(engineStatus.totalSteps, 1)) * 100}%`,
                background: 'var(--accent)',
                boxShadow: 'var(--glow-accent)',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* TVS Node Palette */}
      <div style={{ borderBottom: '1px solid var(--border)', overflowY: 'auto', maxHeight: 380 }}>
        {/* TVS Category Header */}
        <div style={{ padding: '10px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>TVS Component Library</span>
        </div>

        {TVS_CATEGORIES.map(cat => {
          const CatIcon = cat.icon
          const isOpen = openSections[cat.id]
          return (
            <div key={cat.id}>
              {/* Collapsible Header */}
              <button
                onClick={() => toggleSection(cat.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', background: isOpen ? `${cat.accent}12` : 'transparent',
                  border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: `${cat.accent}22`, border: `1px solid ${cat.accent}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CatIcon size={11} style={{ color: cat.accent }} />
                </div>
                <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: isOpen ? cat.accent : 'var(--text-primary)', textAlign: 'left' }}>
                  {cat.label}
                </span>
                {isOpen
                  ? <ChevronDown size={12} style={{ color: cat.accent }} />
                  : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
              </button>

              {/* Node Items (collapsed/expanded) */}
              {isOpen && (
                <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {cat.nodes.map(node => {
                    const NodeIcon = node.icon
                    return (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('application/reactflow-type', node.type)
                          e.dataTransfer.setData('application/reactflow-label', node.label)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px', borderRadius: 7, cursor: 'grab',
                          background: 'var(--bg-raised)', border: `1px solid ${node.color}30`,
                          fontSize: '0.78rem', transition: 'all 0.15s', userSelect: 'none',
                          color: 'var(--text-primary)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `${node.color}18`
                          e.currentTarget.style.borderColor = `${node.color}80`
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--bg-raised)'
                          e.currentTarget.style.borderColor = `${node.color}30`
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: `${node.color}22`, border: `1px solid ${node.color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <NodeIcon size={11} style={{ color: node.color }} />
                        </div>
                        <span style={{ flex: 1, fontSize: '0.77rem', fontWeight: 500 }}>{node.label}</span>
                        <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Legacy nodes collapsible */}
        <div>
          <button
            onClick={() => toggleSection('legacy')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', background: openSections.legacy ? 'rgba(139,149,176,0.08)' : 'transparent',
              border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left' }}>General Nodes</span>
            {openSections.legacy
              ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
              : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
          </button>
          {openSections.legacy && (
            <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {(() => {
                let lastGroup = null
                return NODE_TYPES.map(nt => {
                  const showHeader = nt.group !== lastGroup
                  lastGroup = nt.group
                  return (
                    <div key={nt.type}>
                      {showHeader && (
                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 2px 3px', opacity: 0.7 }}>
                          {nt.group}
                        </div>
                      )}
                      <div draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('application/reactflow-type', nt.type)
                          e.dataTransfer.setData('application/reactflow-label', nt.label)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        style={{
                          padding: '5px 8px', borderRadius: 6, cursor: 'grab',
                          background: 'var(--bg-raised)', border: '1px solid var(--border)',
                          fontSize: '0.77rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          transition: 'all 0.15s', userSelect: 'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = nt.color; e.currentTarget.style.background = 'var(--bg-overlay)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
                      >
                        <span>{nt.label}</span>
                        <ChevronRight size={11} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Saved Workflows */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3>Saved</h3>
          <button onClick={fetchSavedWorkflows} className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }}>
            {loading ? <Loader size={11} className="spin" /> : <FolderOpen size={11} />}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {workflows.map(wf => (
            <div key={wf.id}
              style={{
                padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                background: currentWorkflow?.id === wf.id ? 'var(--accent-dim)' : 'var(--bg-raised)',
                border: `1px solid ${currentWorkflow?.id === wf.id ? 'var(--border-accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '0.8rem', transition: 'all 0.15s',
              }}
              onClick={() => { setCurrentWorkflow(wf) }}>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: currentWorkflow?.id === wf.id ? 'var(--accent)' : 'var(--text-primary)',
              }}>
                {wf.id.startsWith('tpl-') ? '📋 ' : '📄 '}{wf.name}
              </span>
              {!wf.id.startsWith('tpl-') && (
                <button onClick={e => { e.stopPropagation(); deleteWorkflow(wf.id) }}
                  className="btn btn-ghost btn-sm btn-icon" style={{ padding: 3, opacity: 0.5 }}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>


    </aside>
  )
}
