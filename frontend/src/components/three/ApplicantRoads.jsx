import { useMemo } from "react";
import * as THREE from "three";

/**
 * Asphalt roads forming a horizontal + vertical grid between applicant buildings.
 * Buildings live at integer grid positions multiplied by `spacing`; roads run
 * down the half-integer offsets between them so towers sit on city blocks.
 */
export default function ApplicantRoads({
  cells = 24,
  spacing = 2.4,
  roadWidth = 0.7,
  roadColor = "#2a2e38",
  stripeColor = "#00FFCC",
}) {
  const { offsets, extent } = useMemo(() => {
    const half = cells / 2;
    const off = [];
    for (let i = -half; i < half; i++) off.push((i + 0.5) * spacing);
    return { offsets: off, extent: cells * spacing };
  }, [cells, spacing]);

  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: roadColor,
        roughness: 0.92,
        metalness: 0.08,
      }),
    [roadColor]
  );

  const stripeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: stripeColor,
        emissive: stripeColor,
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.55,
        roughness: 0.4,
        metalness: 0,
      }),
    [stripeColor]
  );

  const roadHGeom = useMemo(() => new THREE.PlaneGeometry(extent, roadWidth), [extent, roadWidth]);
  const roadVGeom = useMemo(() => new THREE.PlaneGeometry(roadWidth, extent), [extent, roadWidth]);
  const stripeHGeom = useMemo(() => new THREE.PlaneGeometry(extent, 0.05), [extent]);
  const stripeVGeom = useMemo(() => new THREE.PlaneGeometry(0.05, extent), [extent]);

  return (
    <group>
      {/* Horizontal asphalt strips (along X, positioned along Z) */}
      {offsets.map((z, idx) => (
        <mesh
          key={`h-${idx}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.015, z]}
          geometry={roadHGeom}
          material={baseMat}
          receiveShadow
        />
      ))}
      {/* Vertical asphalt strips (along Z, positioned along X) */}
      {offsets.map((x, idx) => (
        <mesh
          key={`v-${idx}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, 0.015, 0]}
          geometry={roadVGeom}
          material={baseMat}
          receiveShadow
        />
      ))}
      {/* Neon center stripes for that cyberpunk-night vibe */}
      {offsets.map((z, idx) => (
        <mesh
          key={`hs-${idx}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.03, z]}
          geometry={stripeHGeom}
          material={stripeMat}
        />
      ))}
      {offsets.map((x, idx) => (
        <mesh
          key={`vs-${idx}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, 0.03, 0]}
          geometry={stripeVGeom}
          material={stripeMat}
        />
      ))}
    </group>
  );
}
