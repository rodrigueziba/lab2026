"use client";

const POSITIONS_X = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
const LEGS: [number, number][] = [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]];

function Chair({ x }: { x: number }) {
  return (
    <group position={[x, 0, -2]}>
      {/* seat */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.48, 0.05, 0.46]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      {/* back rest */}
      <mesh position={[0, 0.82, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.72, 0.04]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      {/* top rail */}
      <mesh position={[0, 1.16, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.05, 0.05]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      {/* mid rail */}
      <mesh position={[0, 0.67, -0.21]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.03, 0.04]} />
        <meshStandardMaterial color="#1a0f07" roughness={0.95} />
      </mesh>
      {/* legs */}
      {LEGS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.22, lz]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.44, 8]} />
          <meshStandardMaterial color="#1a0f07" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

export default function Chairs() {
  return (
    <group>
      {POSITIONS_X.map((x) => (
        <Chair key={x} x={x} />
      ))}
    </group>
  );
}
