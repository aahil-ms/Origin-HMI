import { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, Text } from '@react-three/drei'
import * as THREE from 'three'

// ── Pose definitions for each TVS node type ──────────────────────────
const POSES = {
  idle:      { base: 0,    shoulder: 0,     elbow: 0,    wrist: 0,    gripper: 0.04 },
  home:      { base: 0,    shoulder: 0.1,   elbow: -0.1, wrist: 0,    gripper: 0.04 },
  scan:      { base: 0.4,  shoulder: -0.7,  elbow: 0.5,  wrist: -0.3, gripper: 0.06 },
  thermal:   { base: -0.4, shoulder: -0.5,  elbow: 0.4,  wrist: 0.2,  gripper: 0.06 },
  proximity: { base: 0,    shoulder: -0.3,  elbow: 0.6,  wrist: 0.1,  gripper: 0.06 },
  pick:      { base: 0,    shoulder: -1.1,  elbow: 1.0,  wrist: 0.5,  gripper: 0.01 },
  place:     { base: 0.8,  shoulder: -0.9,  elbow: 0.8,  wrist: 0.3,  gripper: 0.04 },
  weld:      { base: 0.5,  shoulder: -0.8,  elbow: 1.1,  wrist: -0.4, gripper: 0.02 },
  conveyor:  { base: 1.3,  shoulder: -0.4,  elbow: 0.3,  wrist: 0,    gripper: 0.03 },
  vision:    { base: 0,    shoulder: -0.6,  elbow: 0.2,  wrist: -0.5, gripper: 0.06 },
  safety:    { base: -0.9, shoulder: -0.3,  elbow: 0.1,  wrist: 0,    gripper: 0.06 },
  fork:      { base: 0.2,  shoulder: -0.5,  elbow: 0.5,  wrist: 0.2,  gripper: 0.04 },
  condition: { base: -0.2, shoulder: -0.4,  elbow: 0.4,  wrist: -0.2, gripper: 0.05 },
  charge:    { base: 0,    shoulder: 0.2,   elbow: -0.2, wrist: 0,    gripper: 0.01 },
}

// ── Node type → pose name ─────────────────────────────────────────────
const NODE_POSE_MAP = {
  start:                'home',
  end:                  'home',
  lidar_scanner:        'scan',
  lidar_scan:           'scan',
  thermal_threshold:    'thermal',
  proximity_sensor:     'proximity',
  pneumatic_gripper:    'pick',
  pick:                 'pick',
  place:                'place',
  arc_weld_path:        'weld',
  conveyor_sync:        'conveyor',
  ml_defect_check:      'vision',
  camera_vision:        'vision',
  safety_zone_monitor:  'safety',
  parallel_fork:        'fork',
  if_else:              'condition',
  conditional:          'condition',
  navigate:             'proximity',
  wait:                 'idle',
  wait_for_state:       'idle',
  sensor_wait:          'idle',
  charge:               'charge',
  dock:                 'home',
}

export function getPoseForNodeType(nodeType) {
  return POSES[NODE_POSE_MAP[nodeType] || 'idle']
}

// ── Lerp helper ───────────────────────────────────────────────────────
function lerpAngle(current, target, speed) {
  return current + (target - current) * speed
}

// ── Single arm segment geometry ───────────────────────────────────────
function ArmSegment({ length = 1, width = 0.12, color = '#00d4ff', children }) {
  return (
    <group>
      <mesh position={[0, length / 2, 0]} castShadow>
        <boxGeometry args={[width, length, width]} />
        <meshStandardMaterial
          color={color}
          metalness={0.8}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={0.05}
        />
      </mesh>
      {children}
    </group>
  )
}

// ── Gripper fingers ───────────────────────────────────────────────────
function Gripper({ openAmount = 0.04 }) {
  return (
    <group position={[0, 0.18, 0]}>
      {/* Palm */}
      <mesh castShadow>
        <boxGeometry args={[0.14, 0.06, 0.1]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Left finger */}
      <mesh position={[-openAmount - 0.03, -0.07, 0]} castShadow>
        <boxGeometry args={[0.03, 0.12, 0.08]} />
        <meshStandardMaterial color="#f97316" metalness={0.7} roughness={0.2} emissive="#f97316" emissiveIntensity={0.1} />
      </mesh>
      {/* Right finger */}
      <mesh position={[openAmount + 0.03, -0.07, 0]} castShadow>
        <boxGeometry args={[0.03, 0.12, 0.08]} />
        <meshStandardMaterial color="#f97316" metalness={0.7} roughness={0.2} emissive="#f97316" emissiveIntensity={0.1} />
      </mesh>
    </group>
  )
}

// ── The full animated robot arm ───────────────────────────────────────
function RoboticArm({ targetPose, isExecuting }) {
  const baseRef      = useRef()
  const shoulderRef  = useRef()
  const elbowRef     = useRef()
  const wristRef     = useRef()
  const gripperOpen  = useRef(0.04)
  const currentPose  = useRef({ ...POSES.home })

  useFrame((_, delta) => {
    const speed = Math.min(1, delta * 3.5) // smooth lerp ~3.5x per sec

    currentPose.current.base     = lerpAngle(currentPose.current.base,     targetPose.base,     speed)
    currentPose.current.shoulder = lerpAngle(currentPose.current.shoulder, targetPose.shoulder, speed)
    currentPose.current.elbow    = lerpAngle(currentPose.current.elbow,    targetPose.elbow,    speed)
    currentPose.current.wrist    = lerpAngle(currentPose.current.wrist,    targetPose.wrist,    speed)
    gripperOpen.current          = lerpAngle(gripperOpen.current,           targetPose.gripper,  speed)

    if (baseRef.current)     baseRef.current.rotation.y     = currentPose.current.base
    if (shoulderRef.current) shoulderRef.current.rotation.x = currentPose.current.shoulder
    if (elbowRef.current)    elbowRef.current.rotation.x    = currentPose.current.elbow
    if (wristRef.current)    wristRef.current.rotation.x    = currentPose.current.wrist
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Base platform */}
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.35, 0.4, 0.12, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Base rotation joint */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.8} roughness={0.1} emissive="#00d4ff" emissiveIntensity={isExecuting ? 0.4 : 0.1} />
      </mesh>

      {/* Base rotation group */}
      <group ref={baseRef} position={[0, 0.18, 0]}>
        {/* Upper arm */}
        <group ref={shoulderRef}>
          <ArmSegment length={0.9} width={0.13} color="#334155">
            {/* Elbow joint */}
            <group position={[0, 0.9, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.09, 16, 16]} />
                <meshStandardMaterial color="#00d4ff" metalness={0.8} roughness={0.1} emissive="#00d4ff" emissiveIntensity={isExecuting ? 0.35 : 0.08} />
              </mesh>
              {/* Forearm */}
              <group ref={elbowRef}>
                <ArmSegment length={0.75} width={0.1} color="#1e3a5f">
                  {/* Wrist joint */}
                  <group position={[0, 0.75, 0]}>
                    <mesh castShadow>
                      <sphereGeometry args={[0.065, 16, 16]} />
                      <meshStandardMaterial color="#f97316" metalness={0.7} roughness={0.2} emissive="#f97316" emissiveIntensity={isExecuting ? 0.4 : 0.1} />
                    </mesh>
                    {/* Wrist + gripper */}
                    <group ref={wristRef}>
                      <Gripper openAmount={gripperOpen.current} />
                    </group>
                  </group>
                </ArmSegment>
              </group>
            </group>
          </ArmSegment>
        </group>
      </group>
    </group>
  )
}

// ── Status overlay text in the 3D scene ──────────────────────────────
function StatusLabel({ nodeType, isExecuting }) {
  const label = isExecuting ? `Executing: ${nodeType.replace(/_/g, ' ').toUpperCase()}` : 'STANDBY'
  const color = isExecuting ? '#22c55e' : '#4b5563'
  return (
    <Text
      position={[0, 2.4, 0]}
      fontSize={0.15}
      color={color}
      anchorX="center"
      anchorY="middle"
      font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2"
    >
      {label}
    </Text>
  )
}

// ── Main SimulationView component ─────────────────────────────────────
export default function SimulationView({ currentNodeType = 'idle', isExecuting = false }) {
  const targetPose = useMemo(
    () => getPoseForNodeType(currentNodeType),
    [currentNodeType]
  )

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at center, #0d1b2a 0%, #070d14 100%)',
      position: 'relative',
    }}>
      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          🤖 Digital Twin — ROS2 Simulation
        </div>
        <div style={{ fontSize: '0.6rem', color: '#4b5563' }}>Drag to orbit · Scroll to zoom</div>
      </div>

      {/* Pose badge */}
      <div style={{
        position: 'absolute', top: 10, right: 12, zIndex: 10,
        background: isExecuting ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.4)',
        border: `1px solid ${isExecuting ? '#22c55e' : '#1f2937'}`,
        borderRadius: 8, padding: '4px 10px',
        fontSize: '0.68rem', fontWeight: 600,
        color: isExecuting ? '#22c55e' : '#4b5563',
        fontFamily: 'JetBrains Mono, monospace',
        transition: 'all 0.3s',
        pointerEvents: 'none',
      }}>
        {isExecuting ? `▶ ${currentNodeType.replace(/_/g, ' ')}` : '◼ STANDBY'}
      </div>

      <Canvas
        shadows
        camera={{ position: [2.5, 2.5, 2.5], fov: 45, near: 0.01, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} color="#1a2035" />
        <pointLight position={[3, 5, 3]} intensity={120} color="#ffffff" castShadow shadow-mapSize={[1024,1024]} />
        <pointLight position={[-3, 3, -2]} intensity={40} color="#00d4ff" />
        <pointLight position={[0, 1, 3]} intensity={20} color="#f97316" />

        {/* Floor grid */}
        <Grid
          position={[0, 0, 0]}
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#0f2233"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#00d4ff"
          fadeDistance={8}
          fadeStrength={1}
          infiniteGrid
        />

        {/* Shadow catcher floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.35} />
        </mesh>

        {/* The arm */}
        <RoboticArm targetPose={targetPose} isExecuting={isExecuting} />

        {/* Status label in scene */}
        <StatusLabel nodeType={currentNodeType} isExecuting={isExecuting} />

        {/* Interactive orbit */}
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={7}
          maxPolarAngle={Math.PI / 2 - 0.05}
          target={[0, 0.8, 0]}
        />
      </Canvas>
    </div>
  )
}
