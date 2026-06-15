import { useMemo, useRef, useState } from "react";
import { Html, Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Skyscraper from "./Skyscraper";
import { APPLICANT_CITY_COLORS } from "@/lib/colors";
import { getGreenWindowTexture, floorsToHeight } from "@/lib/buildingTex";

const SPACING = 2.4;
const SKYSCRAPER_FLOOR_THRESHOLD = 8;
const BEAM_COLOR = "#FFD23F";

export default function ApplicantBuildings({
  applicants,
  selectedIds = [],
  onClick,
  highlightId,
  focusId,
  query = "",
}) {
  const [hoverId, setHoverId] = useState(null);
  const tex = useMemo(() => getGreenWindowTexture(), []);

  const buildings = useMemo(
    () =>
      applicants.map((a) => {
        const base = APPLICANT_CITY_COLORS[a.experience_level] || APPLICANT_CITY_COLORS.entry;
        return {
          ...a,
          x: a.grid_x * SPACING,
          z: a.grid_z * SPACING,
          height: floorsToHeight(a.floors, { unit: 1.3, base: 1.0 }),
          color: base,
        };
      }),
    [applicants]
  );

  const q = (query || "").trim().toLowerCase();
  const matchesQuery = (a) => {
    if (!q) return true;
    const fields = [
      a.display_name,
      a.title,
      a.experience_level,
      a.has_github ? "github" : "",
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    return fields.some((f) => f.includes(q));
  };

  // When a building is focused, all others read as "dimmed" (solo spotlight effect)
  const soloMode = !!focusId;
  const isDim = (a) =>
    (q && !matchesQuery(a)) || (soloMode && a.id !== focusId);

  const tall = buildings.filter((a) => a.floors >= SKYSCRAPER_FLOOR_THRESHOLD);
  const regular = buildings.filter((a) => a.floors < SKYSCRAPER_FLOOR_THRESHOLD);
  const hovered = buildings.find((a) => a.id === hoverId);
  const focused = buildings.find((a) => a.id === focusId);

  return (
    <group>
      {/* Regular towers — InstancedMesh with pixel windows */}
      <Instances
        limit={Math.max(regular.length, 8)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.3, 1, 1.3]} />
        <meshStandardMaterial
          emissiveMap={tex}
          emissive="#0a1a10"
          emissiveIntensity={0.95}
          roughness={0.55}
          metalness={0.15}
          transparent={soloMode}
          opacity={soloMode ? 0.55 : 1.0}
        />
        {regular.map((a) => (
          <ApplicantInstance
            key={a.id}
            a={a}
            hovered={hoverId === a.id || focusId === a.id}
            selected={selectedIds.includes(a.id)}
            highlighted={highlightId === a.id}
            dimmed={isDim(a)}
            onPointerOver={() => setHoverId(a.id)}
            onPointerOut={() => setHoverId((cur) => (cur === a.id ? null : cur))}
            onClick={() => onClick?.(a)}
          />
        ))}
      </Instances>

      {/* Bright glow over hovered/focused regular tower */}
      {hovered && hovered.floors < SKYSCRAPER_FLOOR_THRESHOLD && (
        <pointLight
          color={hovered.color}
          intensity={4.5}
          distance={16}
          position={[hovered.x, hovered.height + 1, hovered.z]}
        />
      )}
      {focused && focused.floors < SKYSCRAPER_FLOOR_THRESHOLD && (
        <pointLight
          color={BEAM_COLOR}
          intensity={7}
          distance={24}
          position={[focused.x, focused.height + 1, focused.z]}
        />
      )}

      {/* Skyscrapers */}
      {tall.map((a) => (
        <Skyscraper
          key={a.id}
          position={[a.x, 0, a.z]}
          height={a.height}
          baseWidth={1.5}
          variant="green"
          color={
            highlightId === a.id
              ? "#FF007F"
              : focusId === a.id
              ? BEAM_COLOR
              : selectedIds.includes(a.id)
              ? "#5BE3A3"
              : a.color
          }
          highlight={
            hoverId === a.id ||
            selectedIds.includes(a.id) ||
            highlightId === a.id ||
            focusId === a.id
          }
          dim={isDim(a)}
          onClick={() => onClick?.(a)}
          onPointerOver={() => setHoverId(a.id)}
          onPointerOut={() => setHoverId((cur) => (cur === a.id ? null : cur))}
        />
      ))}

      {/* Golden focus beam — a tall vertical light marker on the selected building */}
      {focused && (
        <FocusBeam x={focused.x} z={focused.z} baseHeight={focused.height} />
      )}

      {hovered && hovered.id !== focusId && (
        <Html
          position={[hovered.x, hovered.height + 1.5, hovered.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="glass rounded-md px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-mono text-[10px] tracking-widest text-white/50">
              {hovered.experience_level.toUpperCase()}
              {hovered.title && ` · ${hovered.title.toUpperCase()}`}
            </div>
            <div className="font-semibold">{hovered.display_name}</div>
            <div className="font-mono text-[11px] text-[#5BE3A3]">
              {hovered.floors} {hovered.floors === 1 ? "APPLICATION" : "APPLICATIONS"}
              {hovered.floors >= SKYSCRAPER_FLOOR_THRESHOLD && " · POWER USER"}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Tall vertical light beam + diamond marker on top of the focused building.
 * Inspired by thegitcity.com's "selection lighthouse" look.
 */
function FocusBeam({ x, z, baseHeight }) {
  const beamRef = useRef();
  const diamondRef = useRef();
  const beamH = 28;
  const beamY = baseHeight + beamH / 2 + 0.5;
  const diamondY = baseHeight + 2.2;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.12;
    }
    if (diamondRef.current) {
      diamondRef.current.rotation.y = t * 0.9;
      const s = 1 + Math.sin(t * 2) * 0.06;
      diamondRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Beam */}
      <mesh ref={beamRef} position={[0, beamY, 0]} renderOrder={5}>
        <cylinderGeometry args={[0.18, 0.05, beamH, 8, 1, true]} />
        <meshBasicMaterial
          color={BEAM_COLOR}
          transparent
          opacity={0.6}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner brighter core */}
      <mesh position={[0, beamY, 0]} renderOrder={6}>
        <cylinderGeometry args={[0.06, 0.02, beamH, 6, 1, true]} />
        <meshBasicMaterial color="#FFF1AC" transparent opacity={0.95} depthWrite={false} />
      </mesh>
      {/* Diamond marker */}
      <mesh ref={diamondRef} position={[0, diamondY, 0]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={BEAM_COLOR}
          emissive={BEAM_COLOR}
          emissiveIntensity={1.6}
          metalness={0.4}
          roughness={0.2}
        />
      </mesh>
      {/* Ground halo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.4, 2.2, 32]} />
        <meshBasicMaterial color={BEAM_COLOR} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function ApplicantInstance({
  a,
  hovered,
  selected,
  highlighted,
  dimmed,
  onPointerOver,
  onPointerOut,
  onClick,
}) {
  const ref = useRef();
  const baseColor = useMemo(() => new THREE.Color(a.color), [a.color]);
  const dimmedColor = useMemo(() => baseColor.clone().multiplyScalar(0.4), [baseColor]);
  const selectedColor = useMemo(() => new THREE.Color("#5BE3A3"), []);
  const focusColor = useMemo(() => new THREE.Color(BEAM_COLOR), []);
  const highlightColor = useMemo(() => new THREE.Color("#FF007F"), []);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const t = highlighted ? 1.15 : hovered ? 1.08 : selected ? 1.04 : 1.0;
    targetScale.set(t, a.height, t);
    ref.current.scale.lerp(targetScale, Math.min(1, dt * 8));
    let target;
    if (highlighted) target = highlightColor;
    else if (hovered) target = focusColor;
    else if (selected) target = selectedColor;
    else if (dimmed) target = dimmedColor;
    else target = baseColor;
    ref.current.color.lerp(target, Math.min(1, dt * 6));
  });

  return (
    <Instance
      ref={ref}
      position={[a.x, a.height / 2, a.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver?.();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut?.();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    />
  );
}
