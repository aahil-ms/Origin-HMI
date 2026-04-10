import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Line, Environment, ContactShadows, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

// ── Movement map: label keywords → joint targets ──────────────────
function getPoseForLabel(label) {
  const l = (label || '').toLowerCase()

  if (l.includes('start'))
    return { base: 0, shoulder: 0, elbow: 0, tool: 0, color: '#22c55e', action: 'none', msg: '[SYS] Arm at HOME position — pre-flight OK' }

  if (l.includes('tuck'))
    return { base: 0, shoulder: 0, elbow: 0, tool: 0, color: '#a855f7', action: 'pick', msg: '[SYS] Tucking arm while maintaining grip...' }

  if (l.includes('end'))
    return { base: 0, shoulder: 0, elbow: 0, tool: 0, color: '#22c55e', action: 'none', msg: '[SYS] Workflow complete — arm returned HOME ✓' }

  if (l.includes('lidar') || l.includes('scan'))
    return { base: Math.PI / 2, shoulder: -0.2, elbow: 0.1, tool: -Math.PI / 2, color: '#00d4ff', action: 'none', msg: '[SYS] LiDAR Scanner — base rotating for 360° sweep...' }

  // Exaggerated PICK pose (Reach far right, down)
  if (l.includes('gripper') || l.includes('pick') || l.includes('pneumatic'))
    return { base: -Math.PI / 3, shoulder: -1.0, elbow: 1.3, tool: 0.5, color: '#a855f7', action: 'pick', msg: '[SYS] Pneumatic Gripper — DESCENDING AND PICKING PAYLOAD...' }

  // Exaggerated PLACE pose (Reach far left, down)
  if (l.includes('place') || l.includes('drop'))
    return { base: Math.PI / 3, shoulder: -0.9, elbow: 1.1, tool: 0.3, color: '#f97316', action: 'place', msg: '[SYS] Place Operation — POSITIONING PAYLOAD AND RELEASING...' }

  if (l.includes('vision') || l.includes('defect') || l.includes('ml'))
    return { base: 0.2, shoulder: -0.5, elbow: 0.4, tool: -0.8, color: '#22c55e', action: 'none', msg: '[SYS] AI Vision — running defect inference model...' }

  if (l.includes('weld') || l.includes('arc'))
    return { base: -0.4, shoulder: -0.6, elbow: 1.0, tool: -0.2, color: '#fbbf24', action: 'none', msg: '[SYS] Arc Weld Path — torch ignited, following seam...' }

  if (l.includes('thermal') || l.includes('temp'))
    return { base: 0.5, shoulder: -0.4, elbow: 0.5, tool: 0.1, color: '#ff6b2b', action: 'none', msg: '[SYS] Thermal Sensor — reading surface temperature...' }

  if (l.includes('conveyor'))
    return { base: Math.PI / 2, shoulder: 0, elbow: 0.2, tool: 0, color: '#00d4ff', action: 'none', msg: '[SYS] Conveyor Sync — matching belt speed...' }

  if (l.includes('navigate') || l.includes('go to'))
    return { base: -Math.PI / 4, shoulder: -0.3, elbow: 0.5, tool: 0.1, color: '#00d4ff', action: 'none', msg: '[SYS] Navigate — moving to waypoint...' }

  if (l.includes('wait') || l.includes('pause'))
    return { base: 0, shoulder: -0.1, elbow: 0.1, tool: 0, color: '#64748b', action: 'none', msg: '[SYS] Wait for State — holding position...' }

  return { base: 0.3, shoulder: -0.2, elbow: 0.3, tool: 0, color: '#f97316', action: 'none', msg: `[SYS] Executing: ${label}` }
}

function lerp(a, b, t) { return a + (b - a) * t }
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function ResizeWatcher() {
  const { gl, camera } = useThree()
  useEffect(() => {
    const fn = () => {
      const p = gl.domElement.parentElement
      if (!p) return
      gl.setSize(p.clientWidth, p.clientHeight)
      camera.aspect = p.clientWidth / p.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [gl, camera])
  return null
}

// ── Autonomous Mobile Robot Base ──
function AMRBase({ children, targetPos, color = '#00d4ff', botId = 'ALPHA', startX = 0, sequenceActiveRef }) {
  const amrRef = useRef()
  const chassisRef = useRef()
  const posEvent = botId === 'ALPHA' ? 'AMR_POSITION' : 'AMR_POSITION_BETA'

  useEffect(() => {
    if (!amrRef.current || !chassisRef.current) return;
    
    // When sequence is active, movement is blocked.
    if (sequenceActiveRef?.current) return;

    // Calculate direction for tilt
    const dx = targetPos[0] - amrRef.current.position.x;
    const dz = targetPos[1] - amrRef.current.position.z;
    const isMovingFront = dz < -0.1;
    const isMovingBack = dz > 0.1;

    gsap.killTweensOf(amrRef.current.position);
    gsap.killTweensOf(chassisRef.current.rotation);

    // Initial Tilt (Inertia Lean - 5 degrees = 0.087 rad)
    if (isMovingFront) {
      gsap.to(chassisRef.current.rotation, { x: 0.087, duration: 0.5, ease: 'power2.out' });
    } else if (isMovingBack) {
      gsap.to(chassisRef.current.rotation, { x: -0.087, duration: 0.5, ease: 'power2.out' });
    }

    // Main translation (Smoothing via power2.inOut lerp)
    gsap.to(amrRef.current.position, {
      x: targetPos[0],
      z: targetPos[1],
      duration: 1.8,
      ease: 'power2.inOut',
      onUpdate: () => {
        window.dispatchEvent(new CustomEvent(posEvent, {
          detail: { x: amrRef.current.position.x, z: amrRef.current.position.z }
        }))
      },
      onComplete: () => {
        // Settlement / Recoil / Zero-out
        gsap.to(chassisRef.current.rotation, { 
          x: isMovingFront ? -0.02 : (isMovingBack ? 0.02 : 0), 
          duration: 0.3, 
          onComplete: () => gsap.to(chassisRef.current.rotation, { x: 0, duration: 0.4, ease: 'back.out(2)' }) 
        });
      }
    });
  }, [targetPos[0], targetPos[1], sequenceActiveRef?.current]);

  return (
    <group ref={amrRef} position={[startX, 0, 0]}>
      {/* AMR Chassis */}
      <mesh ref={chassisRef} position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.4, 1.6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} emissive={color} emissiveIntensity={0.06} />
      </mesh>
      {/* Color accent stripe on top */}
      <mesh position={[0, 0.41, 0]}>
        <boxGeometry args={[1.2, 0.03, 1.6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* 4 Wheels */}
      {[[-0.65, 0.15, 0.6], [0.65, 0.15, 0.6], [-0.65, 0.15, -0.6], [0.65, 0.15, -0.6]].map((pos, i) => (
        <mesh key={i} position={pos} rotation={[0, 0, Math.PI/2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 24]} />
          <meshStandardMaterial color="#020617" roughness={0.9} />
        </mesh>
      ))}
      {/* Payload Deck */}
      <mesh position={[0, 0.44, 0]} receiveShadow>
        <boxGeometry args={[1.0, 0.02, 1.4]} />
        <meshStandardMaterial color={color} metalness={0.8} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      {/* Bot ID label above */}
      <Text position={[0, 1.8, 0]} fontSize={0.2} color={color} anchorX="center" anchorY="middle"
        outlineWidth={0.025} outlineColor="#000000">
        {`🤖 BOT ${botId}`}
      </Text>
      <pointLight color={color} intensity={15} distance={3} position={[0, 0.5, 0]} />
      {/* Arm mount point */}
      <group position={[0, 0.4, 0]}>
        {children}
      </group>
    </group>
  )
}

// ── Floor Sticker with Pulse Glow ──
function FloorSticker({ position, color, label, isActive }) {
  const ringRef = useRef()
  const fillRef = useRef()

  useFrame(() => {
    if (!ringRef.current || !fillRef.current) return
    if (isActive) {
      const s = 1 + Math.sin(Date.now() * 0.005) * 0.15
      ringRef.current.scale.set(s, 1, s)
      ringRef.current.material.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.006) * 0.5
      fillRef.current.material.opacity = 0.4
    } else {
      ringRef.current.scale.set(1, 1, 1)
      ringRef.current.material.emissiveIntensity = 0.3
      fillRef.current.material.opacity = 0.12
    }
  })

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} ref={ringRef}>
        <ringGeometry args={[0.8, 1.0, 64]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} ref={fillRef}>
        <circleGeometry args={[0.7, 64]} />
        <meshStandardMaterial color={color} transparent opacity={0.12} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      {isActive && <pointLight color={color} intensity={40} distance={6} />}
      <Text position={[0, 0.6, 0]} fontSize={0.22} color={color} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
        {label}
      </Text>
    </group>
  )
}

function PathVisualizer({ targetPos, color = '#a855f7', startPos = [0, 0] }) {
  const points = [
    [startPos[0], 0.02, startPos[1]],
    [startPos[0], 0.02, targetPos[1]],
    [targetPos[0], 0.02, targetPos[1]]
  ]
  return (
    <Line 
      points={points} 
      color={color} 
      lineWidth={2} 
      dashed 
      dashScale={10} 
      dashSize={2} 
      opacity={0.5} 
      transparent 
    />
  )
}

// ── Industrial 6-Axis Arm With Payload Logic ──
function SixAxisArm({ target, boxState, setBoxState, sequenceActiveRef }) {
  const baseRef     = useRef()  // Y rotation
  const shoulderRef = useRef()  // X rotation
  const elbowRef    = useRef()  // X rotation
  const toolRef     = useRef()  // Z rotation
  const effColorRef = useRef()
  const gripperCenterRef = useRef() // Point where box attaches
  const fingerLRef  = useRef()
  const fingerRRef  = useRef()

  const cur = useRef({ base: 0, shoulder: 0, elbow: 0, tool: 0 })
  const curColor = useRef(new THREE.Color('#f97316'))

  const [ikTarget, setIkTarget] = useState(null)
  const [isScanning, setIsScanning] = useState(false)

  // Watch for target action to run pick/drop sequence timeline
  useEffect(() => {
    if (!target.action || target.action === 'none') {
      if (sequenceActiveRef) sequenceActiveRef.current = false;
      setIkTarget(null);
      setIsScanning(false);
      return;
    }
    
    // Block base movement immediately
    if (sequenceActiveRef) sequenceActiveRef.current = true;

    if (target.action === 'pick') {
      // Visual Feedback: Faint Scanning Beam flashes right before pick
      setIsScanning(true);
      
      const tScan = setTimeout(() => {
        setIsScanning(false); // Scan finished after 150ms

        // Stage 1 (Pitch Down): Rotate shoulder from 0° to -Math.PI / 4 over 600ms
        setIkTarget({ shoulder: -Math.PI / 4, color: '#00FFFF' }); // Base cyan color during approach

        const t1 = setTimeout(() => {
          // Stage 2 (Attach): Emerald Green, parent the box mesh
          setBoxState('picked'); 
          setIkTarget({ shoulder: -Math.PI / 4, color: '#50C878' }); // Emerald Green

          // Start retract immediately after attaching (give a tiny 50ms buffer for react state and visual 'grab' before lifting)
          const t2 = setTimeout(() => {
            // Stage 3 (Retract): Rotate shoulder back to 0° (Home position)
            setIkTarget({ shoulder: 0, color: '#50C878' }); 
            
            // Crucial: base movement must wait until retract (400ms) finishes
            const t3 = setTimeout(() => { 
              if (sequenceActiveRef) sequenceActiveRef.current = false; // FINISHED: Unblocks Base
              setIkTarget(null); 
            }, 400);
          }, 50);
        }, 600); // 600ms for Pitch Down
      }, 150); // Flash duration
      
      return () => { clearTimeout(tScan); };
      
    } else if (target.action === 'drop' || target.action === 'place') {
      
      // Stage 1 (Approach): Rotate down to -45°
      setIkTarget({ shoulder: -Math.PI / 4, color: '#50C878' });

      const t1 = setTimeout(() => {
        // Stage 2 (Release): Gripper back to Cyan, unparent box
        setBoxState('placed'); 
        setIkTarget({ shoulder: -Math.PI / 4, color: '#00FFFF' }); // Cyan

        const t2 = setTimeout(() => {
          // Stage 3 (Reset): Return to 0° vertical position
          setIkTarget({ shoulder: 0, color: '#00FFFF' });
          
          const t3 = setTimeout(() => { 
            if (sequenceActiveRef) sequenceActiveRef.current = false; 
            setIkTarget(null);
          }, 400); // Wait for reset to finish unlocking base
        }, 50); // slight pause to visualize release
      }, 600); // Wait for approach
      
      return () => { clearTimeout(t1); };
    }
  }, [target.action, setBoxState, sequenceActiveRef])

  useFrame((_, dt) => {
    const activeTarget = ikTarget || target
    const speed = easeInOutCubic(Math.min(1, dt * 2.5)) // Smooth industrial speed
    
    cur.current.base     = lerp(cur.current.base,     activeTarget.base ?? target.base, speed)
    cur.current.shoulder = lerp(cur.current.shoulder, activeTarget.shoulder ?? target.shoulder, speed)
    cur.current.elbow    = lerp(cur.current.elbow,    activeTarget.elbow ?? target.elbow, speed)
    cur.current.tool     = lerp(cur.current.tool,     activeTarget.tool ?? target.tool, speed)

    if (baseRef.current)     baseRef.current.rotation.y     = cur.current.base
    if (shoulderRef.current) shoulderRef.current.rotation.x = cur.current.shoulder
    if (elbowRef.current)    elbowRef.current.rotation.x    = cur.current.elbow
    if (toolRef.current)     toolRef.current.rotation.z     = cur.current.tool

    if (effColorRef.current) {
      curColor.current.lerp(new THREE.Color(activeTarget.color ?? target.color), speed)
      effColorRef.current.material.color.copy(curColor.current)
      effColorRef.current.material.emissive.copy(curColor.current)
    }

    // Realistic Hinge Finger Pick Animation
    if (fingerLRef.current && fingerRRef.current) {
      const isGripping = target.action === 'pick' || boxState === 'picked'
      const fingerTarget = isGripping ? 0.06 : 0.11 // Slides inward to grip box
      fingerLRef.current.position.x = lerp(fingerLRef.current.position.x, -fingerTarget, speed * 2)
      fingerRRef.current.position.x = lerp(fingerRRef.current.position.x, fingerTarget, speed * 2)
    }
  })

  return (
    <group>
      {/* ── WORK ZONES (Visual pads) ── */}
      <mesh position={[-0.9, 0.01, -0.2]} receiveShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 32]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[1.1, 0.01, 0.5]} receiveShadow>
        <boxGeometry args={[0.6, 0.02, 0.6]} />
        <meshStandardMaterial color="#1e3a8a" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Base Mount */}
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.3, 0.35, 0.08, 36]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* J1: Base Pivot */}
      <group ref={baseRef} position={[0, 0.08, 0]}>
        {/* Rotating chassis cylinder */}
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.25, 0.3, 32]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.2} />
        </mesh>
        
        {/* J2: Shoulder Pivot */}
        <group ref={shoulderRef} position={[0, 0.3, 0]}>
          {/* Shoulder Hinge Horizontal Cylinder */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.34, 24]} />
            <meshStandardMaterial color="#0ea5e9" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Upper Arm Link */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 1.2, 24]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.2} />
          </mesh>

          {/* J3: Elbow Pivot */}
          <group ref={elbowRef} position={[0, 1.2, 0]}>
            {/* Elbow Hinge */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.26, 24]} />
              <meshStandardMaterial color="#f97316" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Forearm Link */}
            <mesh position={[0, 0.45, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.9, 24]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.2} />
            </mesh>

            {/* J4: Tool/Wrist Pivot */}
            <group ref={toolRef} position={[0, 0.9, 0]}>
              {/* Wrist / Effector Mount */}
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 24]} />
                <meshStandardMaterial color="#0ea5e9" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Gripper Base Plate */}
              <mesh position={[0, 0.06, 0]} castShadow>
                <boxGeometry args={[0.26, 0.04, 0.14]} />
                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Gripper Fingers */}
              <mesh ref={fingerLRef} position={[-0.1, 0.15, 0]} castShadow>
                <boxGeometry args={[0.02, 0.22, 0.08]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh ref={fingerRRef} position={[0.1, 0.15, 0]} castShadow>
                <boxGeometry args={[0.02, 0.22, 0.08]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh ref={effColorRef} position={[0, 0.08, 0]} castShadow>
                 <sphereGeometry args={[0.03, 16, 16]} />
                 <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.8} />
              </mesh>

              {/* AI Scanning Beam */}
              {isScanning && (
                <mesh position={[0, 0.8, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.4, 1.5, 32]} />
                  <meshStandardMaterial color="#00d4ff" transparent opacity={0.3} emissive="#00d4ff" emissiveIntensity={1.5} />
                </mesh>
              )}

              {/* Realistic Box Attachment when picking */}
              <group ref={gripperCenterRef} position={[0, 0.24, 0]}>
                {boxState === 'picked' && (
                  <mesh castShadow receiveShadow>
                    {/* Size fits exactly between the gripping fingers */}
                    <boxGeometry args={[0.16, 0.18, 0.16]} />
                    <meshStandardMaterial color="#d97706" roughness={0.9} metalness={0.1} />
                    {/* Packing Tape across the top */}
                    <mesh position={[0, 0.091, 0]} rotation={[-Math.PI/2, 0, 0]}>
                      <planeGeometry args={[0.06, 0.16]} />
                      <meshBasicMaterial color="#fef3c7" opacity={0.8} transparent />
                    </mesh>
                    {/* Delivery Label on the side */}
                    <mesh position={[0, 0, 0.081]}>
                      <planeGeometry args={[0.08, 0.06]} />
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                  </mesh>
                )}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

function ExecLog({ logs }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  return (
    <div style={{
      position: 'absolute', top: 35, left: 12, width: 'calc(100% - 24px)', zIndex: 10,
      background: 'rgba(4,8,16,0.5)', backdropFilter: 'blur(4px)',
      border: '1px solid #00d4ff30', borderRadius: 8,
      fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '0.6rem',
      pointerEvents: 'none', // Allow clicking through the log
    }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #00d4ff20', color: '#00d4ff', fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.55rem', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' }} />
        EXECUTION LOG
      </div>
      <div ref={ref} style={{ padding: '6px 10px', maxHeight: 60, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {logs.length === 0 && <div style={{ color: '#4b5563', fontStyle: 'italic' }}>Awaiting workflow activation...</div>}
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.c || '#22c55e', lineHeight: 1.5 }}>{l.t}</div>
        ))}
      </div>
    </div>
  )
}

export default function RobotSim({ hideLog = false, isFullscreen = false }) {
  const [target, setTarget] = useState({ base: 0, shoulder: 0, elbow: 0, tool: 0, color: '#22c55e', action: 'none' })
  const [navTarget, setNavTarget] = useState([0, 0])
  const [boxState, setBoxState] = useState('idle')
  const [stepName, setStepName] = useState('Standby')
  const [logs, setLogs] = useState([])
  const [executing, setExecuting] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [activeSticker, setActiveSticker] = useState(null)
  const [isCharging, setIsCharging] = useState(false)
  const [batteryLevel, setBatteryLevel] = useState(88)
  const [alphaStatus, setAlphaStatus] = useState('IDLE')
  const sequenceActiveRef = useRef(false)

  const log = (text, c = '#22c55e') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
    const entry = { t: `[${ts}] ${text}`, c }
    setLogs(p => [...p.slice(-40), entry])
    window.dispatchEvent(new CustomEvent('ROBOT_LOG', { detail: entry }))
  }

  useEffect(() => {
    log('[SYS] Digital Twin initialized — AMR Cobot system ready')

    const cmdHandlerA = (e) => {
      const label = e.detail?.label || e.detail?.type || e.detail?.stepType || 'idle'
      const pose = getPoseForLabel(label)
      setTarget(pose)
      setStepName(label)
      setExecuting(true)
      setNavigating(false)

      if (label.toLowerCase().includes('start')) { setBoxState('idle'); setNavTarget([0, 0]) }
      log(pose.msg)
      log(`[ALPHA_CMD] J1:${(pose.base*57.3).toFixed(1)}° J2:${(pose.shoulder*57.3).toFixed(1)}° J3:${(pose.elbow*57.3).toFixed(1)}°`, '#00d4ff')
      if (label.toLowerCase().includes('end') || label === 'idle' || label === 'Complete') setTimeout(() => setExecuting(false), 1200)
    }

    const navHandler = (e) => {
      const { x, z, nodeType } = e.detail
      setNavTarget([x, z])
      setStepName(nodeType || 'DESTINATION')
      setExecuting(false)
      setNavigating(true)
      setAlphaStatus(`DRIVING → ${(nodeType || '').toUpperCase().slice(0, 10)}`)
      log(`[ALPHA] Planning path to [X:${x.toFixed(1)}, Z:${z.toFixed(1)}]`, '#00d4ff')
    }

    const manualMoveHandler = (e) => {
      const { dir, precision } = e.detail
      const offset = precision ? 0.3 : 0.8
      setExecuting(true)
      setNavigating(true)
      setStepName(`MANUAL${precision ? ' [PRECISION]' : ''}: ${dir}`)
      log(`[MANUAL_MOVE] Tele-op shifting base ${dir}...`, '#fcd34d')

      // Tele-operation drives the AMR Base
      setNavTarget(prev => {
        let [x, z] = prev
        if (dir === 'FORWARD' || dir === 'UP') z -= offset 
        if (dir === 'BACKWARD' || dir === 'DOWN') z += offset 
        if (dir === 'LEFT') x -= offset 
        if (dir === 'RIGHT') x += offset 
        return [x, z]
      })
    }

    const manualActionHandler = (e) => {
      const { action } = e.detail
      setExecuting(true)
      setNavigating(false)
      setStepName(`MANUAL: ${action}`)
      log(`[MANUAL_ACTION] EndEffector instructed to ${action}.`, '#fcd34d')
      setTarget(prev => ({ ...prev, action: action === 'PICK' ? 'pick' : 'place' }))
    }

    const directMoveHandler = (e) => {
      const { direction, distance } = e.detail
      setExecuting(true)
      setNavigating(true)
      setStepName(`DRIVING: ${direction.toUpperCase()}`)
      log(`[ALPHA] Executing Direct Move: ${direction} (${distance} units)`, '#34d399')
      
      setNavTarget(prev => {
        let [x, z] = prev
        // Simplified vector math for fixed orientation (0 radians)
        // Orientation can be added later as state if rotation nodes are implemented
        if (direction === 'front' || direction === 'back') {
          return [x, z - distance] // Forward is -Z
        } else if (direction === 'lateral') {
          return [x + distance, z] // Right is +X
        }
        return prev
      })
    }

    const smoothMoveHandler = (e) => {
      const { x, z, direction } = e.detail
      setExecuting(true)
      setNavigating(true)
      setStepName(`REL-NAV: ${direction.toUpperCase()}`)
      log(`[ALPHA] Transition Glide → [X:${x.toFixed(1)}, Z:${z.toFixed(1)}]`, '#a855f7')
      setNavTarget([x, z])
    }

    window.addEventListener('NAVIGATE_TO', navHandler)
    window.addEventListener('NAVIGATE_TO_ALPHA', navHandler)
    window.addEventListener('ALPHA_CMD', cmdHandlerA)
    window.addEventListener('MANUAL_MOVE', manualMoveHandler)
    window.addEventListener('MANUAL_ACTION', manualActionHandler)
    window.addEventListener('DIRECT_MOVE', directMoveHandler)
    window.addEventListener('SMOOTH_MOVE', smoothMoveHandler)
    return () => {
      window.removeEventListener('NAVIGATE_TO', navHandler)
      window.removeEventListener('NAVIGATE_TO_ALPHA', navHandler)
      window.removeEventListener('ALPHA_CMD', cmdHandlerA)
      window.removeEventListener('MANUAL_MOVE', manualMoveHandler)
      window.removeEventListener('MANUAL_ACTION', manualActionHandler)
      window.removeEventListener('DIRECT_MOVE', directMoveHandler)
      window.removeEventListener('SMOOTH_MOVE', smoothMoveHandler)
    }
  }, [])

  // ── Proximity Detection for Stickers & Charging ──
  useEffect(() => {
    const dist = (ax, az, bx, bz) => Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2)
    const handler = (e) => {
      const { x, z } = e.detail
      
      // Update Stickers
      if (dist(x, z, 4, 4) < 1.2) setActiveSticker('stop1')
      else if (dist(x, z, -4, 2) < 1.2) setActiveSticker('stop2')
      else if (dist(x, z, 0, -5) < 1.2) setActiveSticker('charge')
      else setActiveSticker(null)

      // Task 1 & 4: Distance logic for Charging Pad at [0, -5]
      if (dist(x, z, 0, -5) < 0.8) {
        window.dispatchEvent(new CustomEvent('ROBOT_CHARGING', { detail: { charging: true } }))
      } else {
        window.dispatchEvent(new CustomEvent('ROBOT_CHARGING', { detail: { charging: false } }))
      }
    }
    window.addEventListener('AMR_POSITION', handler)
    return () => window.removeEventListener('AMR_POSITION', handler)
  }, [])

  // ── Battery Charging Logic via Event ──
  useEffect(() => {
    let chargingInterval = null

    const handleChargingTrigger = (e) => {
      const { charging } = e.detail
      
      // Local state for UI feedback
      setIsCharging(charging)

      if (charging) {
        if (!chargingInterval) {
          log('⚡ [CHARGING] Docked at Charging Port — replenishing battery...', '#eab308')
          chargingInterval = setInterval(() => {
            setBatteryLevel(prev => Math.min(100, prev + 1))
          }, 500)
        }
      } else {
        if (chargingInterval) {
          clearInterval(chargingInterval)
          chargingInterval = null
        }
      }
    }

    window.addEventListener('ROBOT_CHARGING', handleChargingTrigger)
    return () => {
      window.removeEventListener('ROBOT_CHARGING', handleChargingTrigger)
      if (chargingInterval) clearInterval(chargingInterval)
    }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#070d14', borderRadius: isFullscreen ? 0 : 12, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 10, color: '#00d4ff', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        {isFullscreen && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'blink 1s infinite' }} />
            <span style={{ color: '#ef4444', fontSize: '0.6rem', letterSpacing: '0.15em' }}>LIVE</span>
            <span style={{ color: '#4b5563', marginLeft: 4 }}>|</span>
          </span>
        )}
        🤖 {isFullscreen ? 'FULLSCREEN DIGITAL TWIN — AMR COBOT v2' : 'ROS2 DIGITAL TWIN — TVS 6-AXIS'}
      </div>

      {isFullscreen && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none', textAlign: 'left',
          width: 300, background: 'rgba(4,8,20,0.85)', backdropFilter: 'blur(10px)',
          borderLeft: '1px solid rgba(0,212,255,0.25)', boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
          padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 5, color: '#ff9900', fontSize: '0.62rem'
        }}>
          <div style={{fontWeight: 900, marginBottom: 8, letterSpacing:'0.1em', color:'#ff9900', fontSize: '0.8rem'}}>
            🚀 WAREHOUSE COMMAND
          </div>

          {/* Alpha */}
          <div style={{display:'flex', justifyContent:'space-between', gap:12, alignItems:'center'}}>
            <span style={{color:'#00d4ff', fontWeight:700}}>🤖 ALPHA</span>
            <span style={{color: alphaStatus.includes('DRIVING') ? '#a855f7' : '#22c55e', fontSize:'0.58rem'}}>{alphaStatus}</span>
          </div>
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: 4, borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ 
              width: alphaStatus.includes('DRIVING') ? '75%' : '100%', 
              background: '#00d4ff', height: '100%', transition: 'width 0.4s ease' 
            }} />
          </div>
          <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
            <span style={{color:'#4b5563'}}>Battery:</span>
            <span style={{color: isCharging ? '#fbbf24' : batteryLevel > 30 ? '#22c55e' : '#ef4444'}}>
              {isCharging ? '⚡' : ''}{batteryLevel}%
            </span>
          </div>

          <div style={{borderTop:'1px solid rgba(255,153,0,0.15)', marginTop:4, paddingTop:4}} />
          <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
            <span style={{color:'#4b5563'}}>Speed:</span>
            <span style={{color:'#22c55e'}}>2.4 m/s</span>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ position: [6, 4, 6], fov: isFullscreen ? 55 : 40 }} gl={{ antialias: true }}>
        <ResizeWatcher />
        <Environment preset="city" />
        <ambientLight intensity={0.2} color="#0f172a" />
        <pointLight position={[6, 10, 6]} intensity={300} castShadow shadow-mapSize={[2048,2048]} />
        <pointLight position={[-5, 5, -5]} intensity={100} color="#00d4ff" />
        <pointLight position={[3, 3, 6]} intensity={80} color="#f97316" />

        {/* Reflective Cyber Floor (Polished Concrete) & Dual-Layer Grid */}
        <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#020617" metalness={0.9} roughness={0.0} />
        </mesh>
        
        {/* Dual-layer Amazon Fulfillment Grid */}
        <Grid position={[0, 0.01, 0]} args={[50, 50]} cellSize={1} cellThickness={0.5} cellColor="#ff9900" sectionSize={5} sectionThickness={1.5} sectionColor="#ff9900" fadeDistance={25} fadeStrength={1} />
        <Grid position={[0, 0.015, 0]} args={[50, 50]} cellSize={0.2} cellThickness={0.2} cellColor="#a855f7" sectionSize={1} sectionThickness={0} fadeDistance={15} fadeStrength={2} />
        
        <ContactShadows position={[0, 0.02, 0]} opacity={0.8} scale={30} blur={2} far={4} />

        {/* Semi-Transparent Storage Racks (WMS Scene) */}
        {[
          [6, 5], [-6, 5], [6, -5], [-6, -5]
        ].map((pos, i) => (
          <mesh key={i} position={[pos[0], 2, pos[1]]} castShadow receiveShadow>
            <boxGeometry args={[3, 4, 2]} />
            <meshStandardMaterial color="#1e293b" transparent opacity={0.8} roughness={0.2} metalness={0.6} />
            <lineSegments>
              <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(3, 4, 2)]} />
              <lineBasicMaterial attach="material" color="#00d4ff" opacity={0.3} transparent />
            </lineSegments>
          </mesh>
        ))}

        {/* Dynamic Safety Bounds / Work Zones */}
        <mesh position={[3, 0.02, 2]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshBasicMaterial color="#ef4444" opacity={0.1} transparent />
        </mesh>
        <mesh position={[-3, 0.02, 4]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshBasicMaterial color="#eab308" opacity={0.1} transparent />
        </mesh>
        <mesh position={[4, 0.02, -2]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshBasicMaterial color="#00d4ff" opacity={0.1} transparent />
        </mesh>

        {/* Coordinate Stickers — Stop 1, Stop 2, Charging Port */}
        <FloorSticker position={[4, 0.01, 4]}  color="#00d4ff" label="▶ STOP 1"      isActive={activeSticker === 'stop1'} />
        <FloorSticker position={[-4, 0.01, 2]} color="#a855f7" label="▶ STOP 2"      isActive={activeSticker === 'stop2'} />
        <FloorSticker position={[0, 0.01, -5]} color="#fbbf24" label="⚡ CHARGE PORT" isActive={activeSticker === 'charge'} />

        {/* Inductive Charging Glow */}
        {isCharging && (
          <group position={[0, 0.05, -5]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
               <cylinderGeometry args={[1.5, 1.5, 0.1, 32]} />
               <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={0.6} transparent opacity={0.4} />
            </mesh>
            <pointLight color="#eab308" intensity={80} distance={6} position={[0, 1, 0]} />
          </group>
        )}

        {/* Bot Alpha path (cyan) */}
        <PathVisualizer targetPos={navTarget} color="#00d4ff" startPos={[0, 0]} />

        {/* Bot Alpha (Cyan) */}
        <AMRBase targetPos={navTarget} color="#00d4ff" botId="ALPHA" startX={0} sequenceActiveRef={sequenceActiveRef}>
          <SixAxisArm target={target} boxState={boxState} setBoxState={setBoxState} sequenceActiveRef={sequenceActiveRef} />
        </AMRBase>

        <OrbitControls enableDamping dampingFactor={0.06} minDistance={3} maxDistance={22} target={[0, 1.2, 0]} />
      </Canvas>

      {!hideLog && <ExecLog logs={logs} />}

      {/* Fleet Mode Toggle + Execute */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, display: 'flex', gap: 10, alignItems: 'center'
      }}>
        {/* Main action */}
        {isFullscreen ? (
          <button
            onClick={() => window.dispatchEvent(new Event('START_GLOBAL_RUN'))}
            style={{
              background: 'linear-gradient(135deg, rgba(255,153,0,0.2), rgba(168,85,247,0.2))',
              backdropFilter: 'blur(12px)', border: '1px solid #ff9900', borderRadius: 10,
              padding: '10px 24px', color: '#ff9900', fontWeight: 900, fontSize: '0.9rem',
              cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
              boxShadow: '0 0 24px rgba(255,153,0,0.3)', transition: 'all 0.3s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 40px rgba(255,153,0,0.6)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 24px rgba(255,153,0,0.3)'; e.currentTarget.style.transform = 'none' }}
          >
            ⚡ EXECUTE WAREHOUSE RUN
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new Event('EXECUTE_FROM_SIM'))}
            style={{
              background: 'rgba(0,212,255,0.15)', backdropFilter: 'blur(8px)',
              border: '1px solid #00d4ff', borderRadius: 8, padding: '10px 20px',
              color: '#00d4ff', fontWeight: 800, fontSize: '0.85rem',
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,212,255,0.3)',
            }}
          >
            Run Workflow
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes blink{0%,100%{opacity:1;box-shadow:0 0 6px #ef4444}50%{opacity:0.3;box-shadow:none}}
      `}</style>
    </div>
  )
}
