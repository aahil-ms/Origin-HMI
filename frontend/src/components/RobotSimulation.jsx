import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Text, Environment } from '@react-three/drei'
import { io } from 'socket.io-client'
import * as THREE from 'three'
import { ArrowLeft, Radio, Wifi, WifiOff, Terminal } from 'lucide-react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://yummy-foxes-report.loca.lt'

// ── Pose library ─────────────────────────────────────────────────────
const POSES = {
  idle:      [0,      0,     0    ],
  home:      [0,      0.1,  -0.1  ],
  scan:      [0.4,   -0.7,   0.5  ],
  thermal:   [-0.4,  -0.5,   0.4  ],
  proximity: [0,     -0.3,   0.6  ],
  pick:      [0,     -1.1,   1.0  ],
  place:     [0.8,   -0.9,   0.8  ],
  weld:      [0.5,   -0.8,   1.1  ],
  conveyor:  [1.3,   -0.4,   0.3  ],
  vision:    [0,     -0.6,   0.2  ],
  safety:    [-0.9,  -0.3,   0.1  ],
  condition: [-0.2,  -0.4,   0.4  ],
  charge:    [0,      0.2,  -0.2  ],
}

const NODE_TO_POSE = {
  start: 'home', end: 'home',
  lidar_scanner: 'scan', lidar_scan: 'scan',
  thermal_threshold: 'thermal',
  proximity_sensor: 'proximity',
  pneumatic_gripper: 'pick', pick: 'pick',
  place: 'place',
  arc_weld_path: 'weld',
  conveyor_sync: 'conveyor',
  ml_defect_check: 'vision', camera_vision: 'vision',
  safety_zone_monitor: 'safety',
  if_else: 'condition', conditional: 'condition',
  navigate: 'proximity',
  wait: 'idle', wait_for_state: 'idle', sensor_wait: 'idle',
  charge: 'charge', dock: 'home',
}

function lerp(a, b, t) { return a + (b - a) * t }

// ── Robotic Arm ───────────────────────────────────────────────────────
function RoboticArm({ jointAngles, isExecuting }) {
  const baseRef     = useRef()
  const shoulderRef = useRef()
  const elbowRef    = useRef()
  const gripperL    = useRef()
  const gripperR    = useRef()
  const current     = useRef([0, 0, 0])
  const gripOpen    = useRef(0.06)

  useFrame((_, delta) => {
    const speed = Math.min(1, delta * 3.2)
    current.current = current.current.map((c, i) => lerp(c, jointAngles[i], speed))
    const targetGrip = jointAngles[0] < -0.8 ? 0.01 : 0.055
    gripOpen.current = lerp(gripOpen.current, targetGrip, speed)

    if (baseRef.current)     baseRef.current.rotation.y     = current.current[0]
    if (shoulderRef.current) shoulderRef.current.rotation.x = current.current[1]
    if (elbowRef.current)    elbowRef.current.rotation.x    = current.current[2]
    if (gripperL.current)    gripperL.current.position.x    = -gripOpen.current
    if (gripperR.current)    gripperR.current.position.x    =  gripOpen.current
  })

  const glowIntensity  = isExecuting ? 0.35 : 0.08
  const accentColor    = '#00d4ff'
  const orangeColor    = '#f97316'

  return (
    <group>
      {/* Base disc */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.12, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Base rotation joint */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.09, 24]} />
        <meshStandardMaterial color={accentColor} metalness={0.8} roughness={0.1} emissive={accentColor} emissiveIntensity={glowIntensity} />
      </mesh>

      <group ref={baseRef} position={[0, 0.19, 0]}>
        <group ref={shoulderRef}>
          {/* Lower arm */}
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.13, 0.9, 0.13]} />
            <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Elbow joint sphere */}
          <mesh position={[0, 0.9, 0]} castShadow>
            <sphereGeometry args={[0.1, 20, 20]} />
            <meshStandardMaterial color={accentColor} metalness={0.8} roughness={0.1} emissive={accentColor} emissiveIntensity={glowIntensity} />
          </mesh>

          <group ref={elbowRef} position={[0, 0.9, 0]}>
            {/* Upper arm */}
            <mesh position={[0, 0.375, 0]} castShadow>
              <boxGeometry args={[0.1, 0.75, 0.1]} />
              <meshStandardMaterial color="#1e3a5f" metalness={0.85} roughness={0.15} />
            </mesh>
            {/* Wrist joint */}
            <mesh position={[0, 0.75, 0]} castShadow>
              <sphereGeometry args={[0.065, 16, 16]} />
              <meshStandardMaterial color={orangeColor} metalness={0.75} roughness={0.2} emissive={orangeColor} emissiveIntensity={isExecuting ? 0.4 : 0.1} />
            </mesh>
            {/* Gripper palm */}
            <mesh position={[0, 0.84, 0]} castShadow>
              <boxGeometry args={[0.16, 0.06, 0.1]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Gripper fingers */}
            <mesh ref={gripperL} position={[-0.055, 0.77, 0]} castShadow>
              <boxGeometry args={[0.03, 0.14, 0.08]} />
              <meshStandardMaterial color={orangeColor} metalness={0.75} roughness={0.2} emissive={orangeColor} emissiveIntensity={0.1} />
            </mesh>
            <mesh ref={gripperR} position={[0.055, 0.77, 0]} castShadow>
              <boxGeometry args={[0.03, 0.14, 0.08]} />
              <meshStandardMaterial color={orangeColor} metalness={0.75} roughness={0.2} emissive={orangeColor} emissiveIntensity={0.1} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

// ── Scene label ───────────────────────────────────────────────────────
function SceneLabel({ text, isExecuting }) {
  return (
    <Text
      position={[0, 2.6, 0]}
      fontSize={0.14}
      color={isExecuting ? '#22c55e' : '#374151'}
      anchorX="center"
    >
      {isExecuting ? `▶ ${text.replace(/_/g, ' ').toUpperCase()}` : '◼ STANDBY'}
    </Text>
  )
}

// ── ROS2 Log Overlay ──────────────────────────────────────────────────
function RosLogOverlay({ logs }) {
  const listRef = useRef(null)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [logs])

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 20, width: 380, zIndex: 20,
      background: 'rgba(7, 13, 20, 0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid #00d4ff30', borderRadius: 12,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid #00d4ff20',
      }}>
        <Terminal size={12} style={{ color: '#00d4ff' }} />
        <span style={{ color: '#00d4ff', fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.65rem' }}>
          LIVE ROS 2 LOGS
        </span>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', marginLeft: 'auto', animation: 'pulse 1s infinite' }} />
      </div>
      <div ref={listRef} style={{ padding: 10, maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {logs.length === 0 && (
          <div style={{ color: '#374151', fontStyle: 'italic' }}>[INFO] Waiting for workflow execution...</div>
        )}
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.type === 'error' ? '#ef4444' : l.type === 'warn' ? '#f59e0b' : '#22c55e', lineHeight: 1.5 }}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Joint State HUD ───────────────────────────────────────────────────
function JointStateHUD({ angles, nodeType, step, totalSteps }) {
  return (
    <div style={{
      position: 'absolute', top: 20, right: 20, width: 220, zIndex: 20,
      background: 'rgba(7, 13, 20, 0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid #00d4ff30', borderRadius: 12,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem',
    }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #00d4ff20', color: '#00d4ff', fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.65rem' }}>
        /joint_states
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {['Base', 'Shoulder', 'Elbow'].map((name, i) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280' }}>{name}:</span>
            <span style={{ color: '#e2e8f0' }}>{(angles[i] || 0).toFixed(3)} rad</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #00d4ff15', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Node:</span>
          <span style={{ color: '#f97316' }}>{nodeType || 'idle'}</span>
        </div>
        {totalSteps > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280' }}>Step:</span>
            <span style={{ color: '#22c55e' }}>{step}/{totalSteps}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Global Warehouse Status HUD ───────────────────────────────────────
function WmsHUD() {
  return (
    <div style={{
      position: 'absolute', top: 180, right: 20, width: 220, zIndex: 20,
      background: 'rgba(7, 13, 20, 0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid #a855f730', borderRadius: 12,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem',
    }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #a855f720', color: '#a855f7', fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.65rem' }}>
        GLOBAL WAREHOUSE STATUS
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>AGV Battery:</span>
          <span style={{ color: '#22c55e' }}>88%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Path Efficiency:</span>
          <span style={{ color: '#00d4ff' }}>94%</span>
        </div>
        <div style={{ borderTop: '1px solid #a855f715', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Current Task:</span>
          <span style={{ color: '#f97316' }}>Sorting Order #827</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────
export default function RobotSimulation({ onBack }) {
  const [jointAngles, setJointAngles] = useState([0, 0, 0])
  const [nodeType, setNodeType] = useState('idle')
  const [isExecuting, setIsExecuting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [rosLogs, setRosLogs] = useState([])
  const [step, setStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)

  const addLog = (text, type = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
    setRosLogs(prev => [...prev.slice(-40), { text: `[${ts}] ${text}`, type }])
  }

  useEffect(() => {
    addLog('[INFO] ROS2 Digital Twin initialized')
    addLog('[INFO] Connecting to Socket.IO bridge...')

    const socket = io(BACKEND, { transports: ['websocket'] })

    socket.on('connect', () => {
      setConnected(true)
      addLog('[INFO] Connected to OriginHMI backend')
      addLog('[INFO] Subscribed to /joint_states, /hmi_workflow_status')
    })
    socket.on('disconnect', () => {
      setConnected(false)
      addLog('[WARN] Disconnected from backend', 'warn')
    })

    // Listen for joint state emissions from FlowBuilder "Run"
    socket.on('ros2_joint_states', (data) => {
      const pose = POSES[NODE_TO_POSE[data.nodeType] || 'idle'] || [0, 0, 0]
      setJointAngles(pose)
      setNodeType(data.nodeType)
      setIsExecuting(true)
      setStep(data.step || 0)
      setTotalSteps(data.totalSteps || 0)
      addLog(`[INFO] /joint_states → ${data.nodeType} [${pose.map(v => v.toFixed(2)).join(', ')}]`)
    })

    socket.on('engine_status', (status) => {
      if (!status.running) {
        setIsExecuting(false)
        setJointAngles(POSES.home)
        setNodeType('idle')
        if (status.currentStep === 0) {
          addLog('[INFO] Workflow stopped — arm returning to home', 'warn')
        } else {
          addLog('[INFO] Workflow complete ✓')
        }
      } else {
        setIsExecuting(true)
        setStep(status.currentStep)
        setTotalSteps(status.totalSteps)
      }
    })

    // Also listen for regular step events
    socket.on('step_start', (data) => {
      const nodeT = data?.node?.type || 'idle'
      const pose  = POSES[NODE_TO_POSE[nodeT] || 'idle'] || [0, 0, 0]
      setJointAngles(pose)
      setNodeType(nodeT)
      setIsExecuting(true)
      addLog(`[INFO] Executing step ${data?.step || '?'}: ${nodeT}`)
      addLog(`[ROS2] Publishing /joint_states: [${pose.map(v => v.toFixed(3)).join(', ')}]`)
    })

    return () => socket.disconnect()
  }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh', position: 'relative',
      background: 'radial-gradient(ellipse at 30% 30%, #0a1628 0%, #040810 100%)',
      fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 56, zIndex: 30,
        background: 'rgba(4, 8, 16, 0.90)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #00d4ff20',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px',
            background: 'rgba(0, 212, 255, 0.08)', border: '1px solid #00d4ff40',
            borderRadius: 8, color: '#00d4ff', fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.16)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,212,255,0.08)'}
        >
          <ArrowLeft size={14} />
          Back to Builder
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Radio size={14} style={{ color: '#00d4ff' }} />
          <span style={{ fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
            ROS 2 Digital Twin
          </span>
          <span style={{ fontSize: '0.72rem', color: '#4b5563', fontWeight: 500 }}>— TVS Assembly Arm</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {connected
            ? <><Wifi size={14} style={{ color: '#22c55e' }} /><span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>LIVE</span></>
            : <><WifiOff size={14} style={{ color: '#ef4444' }} /><span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>OFFLINE</span></>
          }
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 56 }}>
        <Suspense fallback={
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#040810', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#00d4ff', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.12em' }}>LOADING 3D ENGINE</div>
          </div>
        }>
          <Canvas
            shadows
            camera={{ position: [4, 4, 4], fov: 40, near: 0.01, far: 200 }}
            gl={{ antialias: true, alpha: false }}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            {/* Lighting */}
            <ambientLight intensity={0.35} color="#0d1b2a" />
            <pointLight position={[4, 6, 4]}  intensity={150} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} />
            <pointLight position={[-4, 4, -2]} intensity={50}  color="#00d4ff" />
            <pointLight position={[0, 1, 4]}   intensity={25}  color="#f97316" />

            {/* Grid floor */}
            <Grid
              position={[0, 0, 0]}
              args={[14, 14]}
              cellSize={0.5}
              cellThickness={0.4}
              cellColor="#0c1c2e"
              sectionSize={2.5}
              sectionThickness={0.8}
              sectionColor="#00d4ff"
              fadeDistance={10}
              fadeStrength={1}
              infiniteGrid
            />

            {/* Shadow floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
              <planeGeometry args={[30, 30]} />
              <shadowMaterial opacity={0.4} />
            </mesh>

            {/* Robot arm */}
            <RoboticArm jointAngles={jointAngles} isExecuting={isExecuting} />

            {/* Scene label */}
            <SceneLabel text={nodeType} isExecuting={isExecuting} />

            {/* Camera controls */}
            <OrbitControls
              enableDamping
              dampingFactor={0.06}
              minDistance={2}
              maxDistance={12}
              maxPolarAngle={Math.PI / 2 - 0.02}
              target={[0, 0.9, 0]}
              autoRotate={!isExecuting}
              autoRotateSpeed={0.4}
            />
          </Canvas>
        </Suspense>
      </div>

      {/* Overlays */}
      <JointStateHUD angles={jointAngles} nodeType={nodeType} step={step} totalSteps={totalSteps} />
      <WmsHUD />
      <RosLogOverlay logs={rosLogs} />

      {/* Status badge */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 20,
        background: isExecuting ? 'rgba(34,197,94,0.08)' : 'rgba(7,13,20,0.7)',
        border: `1px solid ${isExecuting ? '#22c55e40' : '#1f293740'}`,
        borderRadius: 10, padding: '8px 16px',
        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
        color: isExecuting ? '#22c55e' : '#374151',
        fontFamily: 'JetBrains Mono, monospace',
        transition: 'all 0.4s',
      }}>
        {isExecuting ? `▶ EXECUTING — ${nodeType.replace(/_/g, ' ').toUpperCase()}` : '◼ ARM STANDBY'}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  )
}
