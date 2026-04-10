import { useEffect, useState, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import FlowBuilder from './components/FlowBuilder'
import Dashboard from './components/Dashboard'
import ControlPanel from './components/ControlPanel'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import EmergencyStop from './components/EmergencyStop'
import Login from './components/Login'
import RadarMap from './components/RadarMap'
import DigitalTwinMaster from './components/DigitalTwinMaster'
import { supabase } from './supabaseClient'
import './App.css'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://yummy-foxes-report.loca.lt'
console.log('🤖 OriginHMI — Current Backend connected to:', BACKEND)

export default function App() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [robotState, setRobotState] = useState({ battery: 85, status: 'idle', simMode: true, position: { x: 0, y: 0, theta: 0 } })
  const [engineStatus, setEngineStatus] = useState({ running: false, paused: false, currentStep: 0, totalSteps: 0, workflowName: null })
  const [logs, setLogs] = useState([])
  const [activeTab, setActiveTab] = useState('flow') // 'flow' | 'dashboard'
  const [currentWorkflow, setCurrentWorkflow] = useState(null)
  const [eStop, setEStop] = useState(false)
  const [toast, setToast] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    // Live listener: fires immediately when magic link is clicked in email
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }, [])

  useEffect(() => {
    const socket = io(BACKEND, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('robot_state', (s) => setRobotState(s))
    socket.on('engine_status', (s) => setEngineStatus(s))
    socket.on('log', (entry) => setLogs(prev => [...prev.slice(-199), entry]))
    socket.on('log_history', (entries) => setLogs(entries))
    socket.on('emergency_stop', () => { setEStop(true); setTimeout(() => setEStop(false), 4000) })

    return () => socket.disconnect()
  }, [])

  const runWorkflow = useCallback(async (wf) => {
    await fetch(`${BACKEND}/api/workflow/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wf)
    })
  }, [])

  const pauseWorkflow = useCallback(() => fetch(`${BACKEND}/api/workflow/pause`, { method: 'POST' }), [])
  const resumeWorkflow = useCallback(() => fetch(`${BACKEND}/api/workflow/resume`, { method: 'POST' }), [])
  const stopWorkflow = useCallback(() => fetch(`${BACKEND}/api/workflow/stop`, { method: 'POST' }), [])

  const emergencyStop = useCallback(() => {
    socketRef.current?.emit('estop')
    setEStop(true)
    setTimeout(() => setEStop(false), 4000)
  }, [])

  const sendCmdVel = useCallback((linear, angular) => {
    socketRef.current?.emit('cmd_vel', {
      linear: { x: linear.x || 0, y: linear.y || 0, z: 0 },
      angular: { x: 0, y: 0, z: angular.z || 0 }
    })
  }, [])

  if (!session) {
    return <Login setSession={setSession} />
  }

  return (
    <div className="app-shell">
      {activeTab === 'simulation' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#020617' }}>
          <DigitalTwinMaster isFullscreen />
          <button
            onClick={() => setActiveTab('flow')}
            style={{
              position: 'fixed', bottom: 20, left: 20, zIndex: 10000,
              background: 'rgba(7,13,20,0.9)', backdropFilter: 'blur(12px)',
              border: '1px solid #00d4ff40', borderRadius: 8, padding: '8px 16px',
              color: '#00d4ff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            ← Back to Flow
          </button>
        </div>
      )}
      {eStop && <div className="estop-overlay"><EmergencyStop /></div>}
      
      {toast && (
        <div style={{
          position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'warn' ? 'var(--warning)' : 'var(--bg-surface)',
          border: `1px solid ${toast.type === 'warn' ? '#d97706' : 'var(--border)'}`,
          boxShadow: toast.type === 'warn' ? '0 0 20px rgba(245, 158, 11, 0.4)' : 'var(--shadow-lg)',
          color: toast.type === 'warn' ? '#000' : 'var(--text-primary)',
          padding: '12px 24px', borderRadius: 12, fontWeight: 600, fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.3s ease'
        }}>
          {toast.msg}
        </div>
      )}

      <Header
        connected={connected}
        robotState={robotState}
        engineStatus={engineStatus}
        onEStop={emergencyStop}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="app-body">
        <Sidebar
          currentWorkflow={currentWorkflow}
          setCurrentWorkflow={setCurrentWorkflow}
          engineStatus={engineStatus}
          onRun={runWorkflow}
          onPause={pauseWorkflow}
          onResume={resumeWorkflow}
          onStop={stopWorkflow}
          backend={BACKEND}
          showToast={showToast}
        />

        <main className="app-main">
          {activeTab === 'flow' || activeTab === 'simulation' ? (
            <FlowBuilder
              currentWorkflow={currentWorkflow}
              setCurrentWorkflow={setCurrentWorkflow}
              engineStatus={engineStatus}
              backend={BACKEND}
              setActiveTab={setActiveTab}
              activeTab={activeTab}
            />
          ) : (
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
              <div style={{ flex: 1 }}>
                <Dashboard
                  robotState={robotState}
                  engineStatus={engineStatus}
                  logs={logs}
                  backend={BACKEND}
                />
              </div>
              <div style={{
                width: 260, padding: 16, borderLeft: '1px solid var(--border)',
                background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0,
              }}>
                <RadarMap robotPosition={robotState.position} />
              </div>
            </div>
          )}
        </main>

        {(activeTab === 'flow' || activeTab === 'simulation') && (
          <div className="right-panel">
            <ControlPanel
              engineStatus={engineStatus}
              currentWorkflow={currentWorkflow}
              onSendVel={sendCmdVel}
              onRun={() => currentWorkflow && runWorkflow(currentWorkflow)}
              onPause={pauseWorkflow}
              onResume={resumeWorkflow}
              onStop={stopWorkflow}
              logs={logs}
            />
          </div>
        )}
      </div>
    </div>
  )
}
