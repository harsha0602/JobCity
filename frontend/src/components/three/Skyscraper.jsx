import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getWindowTexture } from "@/lib/buildingTex";

/**
 * Multi-tier skyscraper with windows and a glow point-light when highlighted.
 * Used for any building tall enough that a single box would look boring.
 */
export default function Skyscraper({
  position = [0, 0, 0],
  height = 10,
  baseWidth = 1.8,
  color = "#FFB24C",
  highlight = false,
  dim = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef();
  const refs = [useRef(), useRef(), useRef()];
  const lightRef = useRef();

  const h1 = height * 0.55;
  const h2 = height * 0.3;
  const h3 = height * 0.15;
  const w1 = baseWidth;
  const w2 = baseWidth * 0.78;
  const w3 = baseWidth * 0.58;

  const tex = useMemo(() => getWindowTexture(), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const dimmedColor = useMemo(() => baseColor.clone().multiplyScalar(0.15), [baseColor]);
  const highlightColor = useMemo(() => new THREE.Color("#ffffff"), []);

  useFrame((_, dt) => {
    const target = highlight ? 1.05 : 1.0;
    if (groupRef.current) {
      groupRef.current.scale.x += (target - groupRef.current.scale.x) * Math.min(1, dt * 8);
      groupRef.current.scale.z += (target - groupRef.current.scale.z) * Math.min(1, dt * 8);
    }
    refs.forEach((r) => {
      if (!r.current?.material) return;
      const mat = r.current.material;
      const targetCol = highlight ? baseColor : dim ? dimmedColor : baseColor;
      mat.color.lerp(targetCol, Math.min(1, dt * 6));
      mat.emissive.lerp(highlight ? highlightColor : targetCol, Math.min(1, dt * 6));
      mat.emissiveIntensity = highlight ? 1.2 : dim ? 0.05 : 0.35;
    });
    if (lightRef.current) {
      lightRef.current.intensity += ((highlight ? 6 : 0) - lightRef.current.intensity) * Math.min(1, dt * 6);
    }
  });

  const matProps = {
    color,
    emissive: color,
    emissiveMap: tex,
    emissiveIntensity: 0.65,
    roughness: 0.45,
    metalness: 0.25,
  };

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver?.();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut?.();
        document.body.style.cursor = "";
      }}
    >
      {/* Base */}
      <mesh ref={refs[0]} position={[0, h1 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w1, h1, w1]} />
        <meshStandardMaterial
          {...matProps}
          emissiveMap-repeat-x={Math.max(1, Math.round(w1))}
          emissiveMap-repeat-y={Math.max(2, Math.round(h1 / 1.5))}
        />
      </mesh>
      {/* Mid */}
      <mesh ref={refs[1]} position={[0, h1 + h2 / 2, 0]} castShadow>
        <boxGeometry args={[w2, h2, w2]} />
        <meshStandardMaterial
          {...matProps}
          emissiveMap-repeat-x={Math.max(1, Math.round(w2))}
          emissiveMap-repeat-y={Math.max(2, Math.round(h2 / 1.5))}
        />
      </mesh>
      {/* Top */}
      <mesh ref={refs[2]} position={[0, h1 + h2 + h3 / 2, 0]} castShadow>
        <boxGeometry args={[w3, h3, w3]} />
        <meshStandardMaterial
          {...matProps}
          emissiveMap-repeat-x={Math.max(1, Math.round(w3))}
          emissiveMap-repeat-y={Math.max(2, Math.round(h3 / 1.5))}
        />
      </mesh>
      {/* Spire */}
      <mesh position={[0, height + 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.0, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
      {/* Glow light when selected/hovered */}
      <pointLight ref={lightRef} color={color} intensity={0} distance={18} position={[0, height * 0.6, 0]} />
    </group>
  );
}
