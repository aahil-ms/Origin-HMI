import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { io } from 'socket.io-client'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://yummy-foxes-report.loca.lt'

// Hardcoded rotations per node type — no IK, no physics
const ROBOT_POSES = {
  start:                { base: 0,     arm1: 0,    arm2: 0    },
  end:                  { base: 0,     arm1: 0,    arm2: 0    },
  lidar_scanner:        { base: 1.57,  arm1: 0.3,  arm2: 0    },  // base 90°
  thermal_threshold:    { base: -0.78, arm1: 0.5,  arm2: 0.3  },  // base -45°
  proximity_sensor:     { base: 0,     arm1: 0.5,  arm2: 0.5  },
  pneumatic_gripper:    { base: 0,     arm1: -1.2, arm2: 1.0  },  // reach down
  arc_weld_path:        { base: 0.78,  arm1: -0.8, arm2: 1.1  },  // weld angle
  conveyor_sync:        { base: 1.57,  arm1: -0.4, arm2: 0.3  },  // side reach
  if_else:              { base: -0.4,  arm1: -0.4, arm2: 0.4  },
  parallel_fork:        { base: 0.4,   arm1: -0.5, arm2: 0.5  },
  wait_for_state:       { base: 0,     arm1: 0.2,  arm2: -0.1 },
  ml_defect_check:      { base: 0,     arm1: -0.6, arm2: 0.2  },  // camera up
  safety_zone_monitor:  { base: -1.57, arm1: -0.3, arm2: 0.1  },  // sweep left
  navigate:             { base: 0,     arm1: 0.3,  arm2: 0.6  },
  pick:                 { base: 0,     arm1: -1.1, arm2: 1.0  },
  place:                { base: 0.9,   arm1: -0.9, arm2: 0.8  },
  wait:                 { base: 0,     arm1: 0.1,  arm2: -0.1 },
  charge:               { base: 0,     arm1: 0.3,  arm2: -0.2 },
}

function lerpVal(a, b, t) { return a + (b - a) * t }

// ── Box Robot: 3 cubes ─────────────────────────────────────────────
function BoxRobot({ pose, active }) {
  const baseRef = useRef()
  const arm1Ref = useRef()
  const arm2Ref = useRef()
  const cur = useRef({ base: 0, arm1: 0, arm2: 0 })

  useFrame((_, dt) => {
    const s = Math.min(1, dt * 3)
    cur.current.base = lerpVal(cur.current.base, pose.base, s)
    cur.current.arm1 = lerpVal(cur.current.arm1, pose.arm1, s)
    cur.current.arm2 = lerpVal(cur.current.arm2, pose.arm2, s)

    if (baseRef.current) baseRef.current.rotation.y = cur.current.base
    if (arm1Ref.current) arm1Ref.current.rotation.x = cur.current.arm1
    if (arm2Ref.current) arm2Ref.current.rotation.x = cur.current.arm2
  })

  const glow = active ? 0.4 : 0.05

  return (
    <group>
      {/* BASE — large flat cube */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.2, 0.7]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Base rotation pivot */}
      <group ref={baseRef} position={[0, 0.2, 0]}>
        {/* Shoulder joint */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.1, 20]} />
          <meshStandardMaterial color="#00d4ff" metalness={0.8} roughness={0.1} emissive="#00d4ff" emissiveIntensity={glow} />
        </mesh>

        {/* ARM 1 — lower arm */}
        <group ref={arm1Ref} position={[0, 0.13, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[0.18, 0.7, 0.18]} />
            <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.15} />
          </mesh>

          {/* Elbow joint */}
          <mesh position={[0, 0.7, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color="#00d4ff" metalness={0.8} roughness={0.1} emissive="#00d4ff" emissiveIntensity={glow} />
          </mesh>

          {/* ARM 2 — upper arm */}
          <group ref={arm2Ref} position={[0, 0.7, 0]}>
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[0.13, 0.6, 0.13]} />
              <meshStandardMaterial color="#1e3a5f" metalness={0.85} roughness={0.15} />
            </mesh>

            {/* Wrist / end effector */}
            <mesh position={[0, 0.62, 0]} castShadow>
              <boxGeometry args={[0.2, 0.08, 0.12]} />
              <meshStandardMaterial color="#f97316" metalness={0.75} roughness={0.2} emissive="#f97316" emissiveIntensity={active ? 0.35 : 0.08} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

// ── ROS2 Log Box ───────────────────────────────────────────────────
function LogBox({ logs }) {
  const ref = useRef()
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 20,
      width: 400, maxHeight: 160,
      background: 'rgba(4,8,16,0.88)', backdropFilter: 'blur(12px)',
      border: '1px solid #00d4ff30', borderRadius: 10,
      fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '0.68rem', zIndex: 10,
    }}>
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #00d4ff20', color: '#00d4ff', fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s ease infinite' }} />
        LIVE ROS 2 LOGS — /joint_states
      </div>
      <div ref={ref} style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: 110, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.type === 'warn' ? '#f59e0b' : l.type === 'error' ? '#ef4444' : '#22c55e', lineHeight: 1.6 }}>{l.msg}</div>
        ))}
      </div>
    </div>
  )
}

// ── Info HUD ───────────────────────────────────────────────────────
function InfoHUD({ connected, pose, nodeType, step, total }) {
  return (
    <div style={{
      position: 'absolute', top: 70, right: 20,
      width: 210, background: 'rgba(4,8,16,0.88)', backdropFilter: 'blur(12px)',
      border: '1px solid #00d4ff25', borderRadius: 10,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', zIndex: 10,
    }}>
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #00d4ff15', color: '#00d4ff', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em' }}>
        /joint_states
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[['base', pose.base], ['arm1', pose.arm1], ['arm2', pose.arm2]].map(([name, val]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#4b5563' }}>{name}:</span>
            <span style={{ color: '#e2e8f0' }}>{(val * 180 / Math.PI).toFixed(1)}°</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #00d4ff15', paddingTop: 5, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#4b5563' }}>node:</span>
          <span style={{ color: '#f97316', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeType || 'idle'}</span>
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#4b5563' }}>step:</span>
            <span style={{ color: '#22c55e' }}>{step}/{total}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#4b5563' }}>bridge:</span>
          <span style={{ color: connected ? '#22c55e' : '#ef4444' }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────
export default function Simulation() {
  const [pose, setPose]         = useState({ base: 0, arm1: 0, arm2: 0 })
  const [nodeType, setNodeType] = useState('idle')
  const [active, setActive]     = useState(false)
  const [connected, setConn]    = useState(false)
  const [logs, setLogs]         = useState([])
  const [step, setStep]         = useState(0)
  const [total, setTotal]       = useState(0)

  const log = (msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(p => [...p.slice(-50), { msg: `[${ts}] ${msg}`, type }])
  }

  useEffect(() => {
    log('[INFO] ROS2 Digital Twin — ready')
    log('[INFO] Connecting to backend socket...')

    const socket = io(BACKEND, { transports: ['websocket'] })

    socket.on('connect',    () => { setConn(true);  log('[INFO] Socket connected ✓') })
    socket.on('disconnect', () => { setConn(false); log('[WARN] Socket lost', 'warn') })

    // Primary: listen for explicit robot-command
    socket.on('robot-command', (data) => {
      const p = {
        base: (data.base || 0) * Math.PI / 180,
        arm1: (data.arm1 || 0) * Math.PI / 180,
        arm2: (data.arm2 || 0) * Math.PI / 180,
      }
      setPose(p)
      setNodeType(data.nodeType || 'cmd')
      setActive(true)
      log(`[ROS2] /joint_states ← base:${data.base}° arm1:${data.arm1}° arm2:${data.arm2}°`)
    })

    // Fallback: listen for step_start and map to hardcoded pose
    socket.on('step_start', (data) => {
      const nt = data?.node?.type || 'idle'
      const p  = ROBOT_POSES[nt] || ROBOT_POSES.start
      setPose(p)
      setNodeType(nt)
      setActive(true)
      log(`[INFO] step_start → ${nt}`)
      log(`[ROS2] Pose: base=${(p.base*180/Math.PI).toFixed(0)}° arm1=${(p.arm1*180/Math.PI).toFixed(0)}° arm2=${(p.arm2*180/Math.PI).toFixed(0)}°`)
    })

    socket.on('engine_status', (s) => {
      setStep(s.currentStep || 0)
      setTotal(s.totalSteps || 0)
      if (!s.running) {
        setActive(false)
        setPose(ROBOT_POSES.start)
        setNodeType('idle')
        log('[INFO] Workflow finished — arm returned home')
      }
    })

    // Also listen from window events (same-tab usage)
    const handleWindow = (e) => {
      const { nodeType: nt, degrees } = e.detail || {}
      const p = degrees || (ROBOT_POSES[nt] ? {
        base: ROBOT_POSES[nt].base * 180/Math.PI,
        arm1: ROBOT_POSES[nt].arm1 * 180/Math.PI,
        arm2: ROBOT_POSES[nt].arm2 * 180/Math.PI,
      } : {base:0,arm1:0,arm2:0})
      socket.emit('robot-command', { ...p, nodeType: nt })
    }
    window.addEventListener('MOVE_ROBOT', handleWindow)

    return () => {
      socket.disconnect()
      window.removeEventListener('MOVE_ROBOT', handleWindow)
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#040810', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 52, zIndex: 20,
        background: 'rgba(4,8,16,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #00d4ff20',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14,
      }}>
        <button
          onClick={() => window.close()}
          style={{
            padding: '5px 12px', background: 'rgba(0,212,255,0.08)',
            border: '1px solid #00d4ff35', borderRadius: 7,
            color: '#00d4ff', fontSize: '0.78rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ← Close
        </button>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em' }}>
          🤖 ROS2 Digital Twin
        </span>
        <span style={{ color: '#374151', fontSize: '0.75rem' }}>TVS Assembly Arm</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 600, color: connected ? '#22c55e' : '#ef4444' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', animation: connected ? 'pulse 1s infinite' : 'none' }} />
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [4, 4, 4], fov: 45 }}
        style={{ position: 'absolute', inset: 0, paddingTop: 52 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 8, 5]}  intensity={120} castShadow />
        <pointLight position={[-4, 4, -3]} intensity={40}  color="#00d4ff" />
        <pointLight position={[0, 2, 5]}   intensity={20}  color="#f97316" />

        <Grid
          args={[12, 12]} cellSize={0.5} cellThickness={0.4}
          cellColor="#0c1c2e" sectionSize={2.5} sectionThickness={0.8}
          sectionColor="#00d4ff" fadeDistance={8} infiniteGrid
        />
        <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.35} />
        </mesh>

        <BoxRobot pose={pose} active={active} />

        <OrbitControls
          enableDamping dampingFactor={0.07}
          minDistance={2} maxDistance={14}
          maxPolarAngle={Math.PI/2 - 0.02}
          target={[0, 0.8, 0]}
          autoRotate={!active} autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Overlays */}
      <InfoHUD connected={connected} pose={pose} nodeType={nodeType} step={step} total={total} />
      <LogBox logs={logs} />

      {/* Status */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 10,
        padding: '7px 16px', borderRadius: 9,
        background: active ? 'rgba(34,197,94,0.08)' : 'rgba(4,8,16,0.7)',
        border: `1px solid ${active ? '#22c55e40' : '#1f293740'}`,
        color: active ? '#22c55e' : '#374151',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.08em', transition: 'all 0.3s',
      }}>
        {active ? `▶ EXECUTING — ${nodeType.replace(/_/g, ' ').toUpperCase()}` : '◼ STANDBY'}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
      `}</style>
    </div>
  )
}
