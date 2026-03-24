"use client";

import { useRef, useMemo, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Text, Environment, Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

const BOOT_SEQUENCE = [
  { text: "OpenClaw v2.1.0", color: "#D42B2B", delay: 0 },
  { text: "─────────────────────", color: "#333", delay: 300 },
  { text: "Booting agent kernel...", color: "#888", delay: 600 },
  { text: "[OK] Runtime loaded", color: "#FF4444", delay: 1200 },
  { text: "[OK] 47 skills mounted", color: "#FF4444", delay: 1700 },
  { text: "[OK] MCP: 4 servers", color: "#FF4444", delay: 2200 },
  { text: "[OK] CRM connected", color: "#FF4444", delay: 2700 },
  { text: "[OK] SMS pipeline ready", color: "#FF4444", delay: 3200 },
  { text: "[OK] Content engine up", color: "#FF4444", delay: 3700 },
  { text: "─────────────────────", color: "#333", delay: 4200 },
  { text: "$ Ready. Awaiting orders._", color: "#D42B2B", delay: 4700 },
];

function BootScreen({ position }: { position: [number, number, number] }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers = BOOT_SEQUENCE.map((line, i) =>
      setTimeout(() => setVisibleCount(i + 1), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const startY = 0.7;
  const lineHeight = 0.145;

  return (
    <group position={position}>
      {/* Screen bg - deep black */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[1.65, 2.9]} />
        <meshBasicMaterial color="#050508" />
      </mesh>

      {/* Boot lines */}
      {BOOT_SEQUENCE.slice(0, visibleCount).map((line, i) => (
        <Text
          key={i}
          position={[0, startY - i * lineHeight, 0.002]}
          fontSize={0.072}
          color={line.color}
          anchorX="center"
          anchorY="middle"
          maxWidth={1.5}
        >
          {line.text}
        </Text>
      ))}

      {/* Subtle CRT scanline effect */}
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[1.65, 2.9]} />
        <meshBasicMaterial color="#D42B2B" transparent opacity={0.015} />
      </mesh>
    </group>
  );
}

function PhoneBody() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.12 + 0.1;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.03 - 0.05;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.2}>
      <group ref={groupRef} position={[0, 0.2, 0]}>
        {/* Phone body - dark metallic */}
        <RoundedBox args={[1.85, 3.5, 0.1]} radius={0.14} smoothness={8}>
          <meshPhysicalMaterial
            color="#0f0f14"
            metalness={0.95}
            roughness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.05}
            reflectivity={1}
          />
        </RoundedBox>

        {/* Screen glass */}
        <RoundedBox args={[1.72, 3.2, 0.01]} radius={0.1} smoothness={8} position={[0, 0, 0.055]}>
          <meshPhysicalMaterial
            color="#020205"
            metalness={0.1}
            roughness={0}
            clearcoat={0.5}
            transmission={0}
          />
        </RoundedBox>

        {/* Terminal boot sequence */}
        <Suspense fallback={null}>
          <BootScreen position={[0, 0, 0.065]} />
        </Suspense>

        {/* Red accent edge glow */}
        <RoundedBox args={[1.88, 3.54, 0.11]} radius={0.15} smoothness={4}>
          <meshBasicMaterial color="#D42B2B" transparent opacity={0.06} wireframe />
        </RoundedBox>

        {/* Camera module */}
        <group position={[-0.45, 1.3, -0.06]}>
          {/* Camera housing */}
          <RoundedBox args={[0.5, 1.0, 0.04]} radius={0.08} smoothness={4}>
            <meshPhysicalMaterial color="#0a0a0e" metalness={0.9} roughness={0.2} />
          </RoundedBox>
          {/* Main camera */}
          <mesh position={[0, 0.3, -0.01]}>
            <cylinderGeometry args={[0.11, 0.11, 0.05, 32]} />
            <meshPhysicalMaterial color="#111118" metalness={1} roughness={0.1} clearcoat={1} />
          </mesh>
          {/* Lens glass */}
          <mesh position={[0, 0.3, -0.04]}>
            <circleGeometry args={[0.07, 32]} />
            <meshPhysicalMaterial color="#1a1a40" metalness={0.5} roughness={0} clearcoat={1} />
          </mesh>
          {/* Ultra-wide */}
          <mesh position={[0, -0.05, -0.01]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 32]} />
            <meshPhysicalMaterial color="#111118" metalness={1} roughness={0.1} clearcoat={1} />
          </mesh>
          {/* Macro */}
          <mesh position={[0, -0.35, -0.01]}>
            <cylinderGeometry args={[0.07, 0.07, 0.04, 32]} />
            <meshPhysicalMaterial color="#111118" metalness={1} roughness={0.1} clearcoat={1} />
          </mesh>
          {/* Flash */}
          <mesh position={[0.18, 0.3, -0.01]}>
            <circleGeometry args={[0.03, 16]} />
            <meshBasicMaterial color="#FFE0B2" />
          </mesh>
        </group>

        {/* Side buttons */}
        <mesh position={[0.935, 0.3, 0]}>
          <boxGeometry args={[0.025, 0.35, 0.05]} />
          <meshPhysicalMaterial color="#15151a" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0.935, -0.15, 0]}>
          <boxGeometry args={[0.025, 0.2, 0.05]} />
          <meshPhysicalMaterial color="#15151a" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* USB-C port */}
        <mesh position={[0, -1.77, 0]}>
          <boxGeometry args={[0.2, 0.02, 0.05]} />
          <meshBasicMaterial color="#0a0a0e" />
        </mesh>
      </group>
    </Float>
  );
}

function Particles() {
  const count = 150;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return pos;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.015;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#D42B2B" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

export default function PhoneScene() {
  return (
    <div className="w-full h-[70vh] md:h-[85vh]">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <img src="/samsung-a16-samsung.jpg" alt="Samsung Galaxy A16 5G" className="h-80 phone-glow" />
          </div>
        }
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
        <directionalLight position={[-3, 3, -2]} intensity={0.4} color="#D42B2B" />
        <pointLight position={[0, 0, 4]} intensity={0.6} color="#D42B2B" distance={10} />
        <pointLight position={[-2, -2, 3]} intensity={0.3} color="#FF4444" distance={8} />
        <spotLight position={[2, 4, 3]} intensity={0.5} color="#ffffff" angle={0.4} penumbra={0.5} />
        <Suspense fallback={null}>
          <PhoneBody />
          <Particles />
          <ContactShadows position={[0, -2.2, 0]} opacity={0.3} scale={8} blur={2} color="#D42B2B" />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}
