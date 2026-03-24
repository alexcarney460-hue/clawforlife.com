"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Text, Environment, Float } from "@react-three/drei";
import * as THREE from "three";

function TerminalScreen({ position }: { position: [number, number, number] }) {
  const lines = useMemo(
    () => [
      { text: "$ openclaw init", color: "#D42B2B", y: 0.55 },
      { text: "[✓] Agent swarm initialized", color: "#FF4444", y: 0.38 },
      { text: "[✓] 47 skills loaded", color: "#FF4444", y: 0.21 },
      { text: "[✓] MCP servers connected", color: "#FF4444", y: 0.04 },
      { text: "[✓] CRM pipeline active", color: "#FF4444", y: -0.13 },
      { text: "[✓] Content engine ready", color: "#FF4444", y: -0.3 },
      { text: "", color: "#D42B2B", y: -0.47 },
      { text: "  Ready. Your AI army awaits._", color: "#D42B2B", y: -0.64 },
    ],
    []
  );

  return (
    <group position={position}>
      {/* Screen background */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[1.65, 2.9]} />
        <meshBasicMaterial color="#080808" />
      </mesh>

      {/* Terminal lines */}
      {lines.map((line, i) => (
        <Text
          key={i}
          position={[0, line.y, 0.002]}
          fontSize={0.085}
          color={line.color}
          anchorX="center"
          anchorY="middle"
          maxWidth={1.5}
        >
          {line.text}
        </Text>
      ))}

      {/* Scanline overlay */}
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[1.65, 2.9]} />
        <meshBasicMaterial color="#D42B2B" transparent opacity={0.02} />
      </mesh>
    </group>
  );
}

function PhoneBody() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
      <group ref={groupRef}>
        {/* Phone frame */}
        <RoundedBox args={[1.85, 3.4, 0.12]} radius={0.12} smoothness={4}>
          <meshPhysicalMaterial
            color="#1a1a1f"
            metalness={0.9}
            roughness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </RoundedBox>

        {/* Screen bezel */}
        <RoundedBox args={[1.72, 3.1, 0.02]} radius={0.08} smoothness={4} position={[0, 0, 0.06]}>
          <meshBasicMaterial color="#000005" />
        </RoundedBox>

        {/* Terminal content on screen */}
        <Suspense fallback={null}>
          <TerminalScreen position={[0, 0, 0.075]} />
        </Suspense>

        {/* Red edge glow */}
        <RoundedBox args={[1.88, 3.44, 0.13]} radius={0.13} smoothness={4}>
          <meshBasicMaterial color="#D42B2B" transparent opacity={0.08} wireframe />
        </RoundedBox>

        {/* Camera bump */}
        <mesh position={[-0.45, 1.35, -0.08]}>
          <cylinderGeometry args={[0.12, 0.12, 0.04, 32]} />
          <meshPhysicalMaterial color="#111" metalness={1} roughness={0.3} />
        </mesh>
        <mesh position={[-0.45, 0.95, -0.08]}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 32]} />
          <meshPhysicalMaterial color="#111" metalness={1} roughness={0.3} />
        </mesh>

        {/* Side buttons */}
        <mesh position={[0.94, 0.3, 0]}>
          <boxGeometry args={[0.03, 0.3, 0.06]} />
          <meshPhysicalMaterial color="#1a1a1f" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </Float>
  );
}

function Particles() {
  const count = 200;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#D42B2B" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export default function PhoneScene() {
  return (
    <div className="w-full h-[80vh] md:h-screen">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <img src="/logo.png" alt="OpenClaw Phones" className="h-32 w-auto" />
          </div>
        }
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
        <directionalLight position={[-3, 2, -3]} intensity={0.5} color="#D42B2B" />
        <pointLight position={[0, 0, 3]} intensity={0.8} color="#D42B2B" distance={8} />
        <spotLight position={[0, 5, 0]} intensity={0.4} color="#FF4444" angle={0.5} />
        <Suspense fallback={null}>
          <PhoneBody />
          <Particles />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}
