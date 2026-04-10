import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

// --- 1. THE REVOLVING PLANET SYSTEM ---
function PlanetSystem() {
  const planetRef = useRef();
  const moonRef = useRef();
  const atmosphereRef = useRef();

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Rotate core planet slowly
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.05;
      planetRef.current.rotation.z += delta * 0.02;
    }

    // Gentle pulsing atmosphere
    if (atmosphereRef.current) {
      const scale = 1.05 + Math.sin(time * 2) * 0.01;
      atmosphereRef.current.scale.set(scale, scale, scale);
    }

    // Satellite / Moon Orbital Calculations (Cos/Sin path pathing)
    if (moonRef.current) {
      const distance = 4.5;
      const speed = 0.5;
      moonRef.current.position.x = Math.cos(time * speed) * distance;
      moonRef.current.position.z = Math.sin(time * speed) * distance;
      moonRef.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <group position={[0, 0, -5]}>
      {/* Target Planet */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <meshStandardMaterial 
          color="#0a192f"
          emissive="#3b82f6"
          emissiveIntensity={0.2}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Atmospheric Fresnel Glow (Simulated with Additive Layer) */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[2.6, 64, 64]} />
        <meshBasicMaterial 
          color="#00d4ff" 
          transparent 
          opacity={0.15} 
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Orbiting Satellite / Moon */}
      <mesh ref={moonRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial 
          color="#94a3b8" 
          emissive="#64748b" 
          emissiveIntensity={0.5} 
          roughness={0.6}
        />
        {/* Orbital glow trail off the moon */}
        <pointLight color="#00d4ff" intensity={5} distance={10} />
      </mesh>
    </group>
  );
}

// --- 2. CAMERA RIG (Interactive Mouse Drift) ---
function CameraRig() {
  useFrame((state) => {
    // Parallax tracking: Drifts camera slightly based on normalized cursor position
    const targetX = state.pointer.x * 2;
    const targetY = state.pointer.y * 2;
    state.camera.position.lerp(new THREE.Vector3(targetX, targetY, 5), 0.02);
    state.camera.lookAt(0, 0, -5);
  });
  return null;
}

// --- MAIN EXPORT ---
export default function LoginBackground() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, background: '#020617' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <ambientLight intensity={0.1} />
        <directionalLight position={[5, 3, 5]} intensity={2} color="#f8fafc" />
        <pointLight position={[-5, -3, -5]} intensity={5} color="#3b82f6" />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <PlanetSystem />
        <CameraRig />
      </Canvas>
    </div>
  );
}
