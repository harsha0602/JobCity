import { useMemo, useRef, useState } from "react";
import { Html, Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Skyscraper from "./Skyscraper";
import { EXP_COLORS } from "@/lib/colors";
import { getWindowTexture, floorsToHeight } from "@/lib/buildingTex";

const SPACING = 2.4;
const SKYSCRAPER_FLOOR_THRESHOLD = 8;

export default function ApplicantBuildings({
  applicants,
  selectedIds = [],
  onClick,
  highlightId,
  query = "",
}) {
  const [hoverId, setHoverId] = useState(null);
  const tex = useMemo(() => getWindowTexture(), []);

  const buildings = useMemo(
    () =>
      applicants.map((a) => {
        const base = EXP_COLORS[a.experience_level] || EXP_COLORS.entry;
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
      a.experience_level,
      a.has_github ? "github" : "",
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    return fields.some((f) => f.includes(q));
  };

  const tall = buildings.filter((a) => a.floors >= SKYSCRAPER_FLOOR_THRESHOLD);
  const regular = buildings.filter((a) => a.floors < SKYSCRAPER_FLOOR_THRESHOLD);
  const hovered = buildings.find((a) => a.id === hoverId);
  const focusedSelected = buildings.find((a) =>
    selectedIds.includes(a.id) && a.floors < SKYSCRAPER_FLOOR_THRESHOLD
  );

  return (
    <group>
      {/* Regular towers — InstancedMesh with windows */}
      <Instances limit={Math.max(regular.length, 8)} castShadow receiveShadow>
        <boxGeometry args={[1.3, 1, 1.3]} />
        <meshStandardMaterial
          emissiveMap={tex}
          emissive="#222222"
          emissiveIntensity={0.85}
          roughness={0.3}
          metalness={0.5}
          emissiveMap-repeat-x={2}
          emissiveMap-repeat-y={3}
        />
        {regular.map((a) => (
          <ApplicantInstance
            key={a.id}
            a={a}
            hovered={hoverId === a.id}
            selected={selectedIds.includes(a.id)}
            highlighted={highlightId === a.id}
            dimmed={q ? !matchesQuery(a) : false}
            onPointerOver={() => setHoverId(a.id)}
            onPointerOut={() => setHoverId((cur) => (cur === a.id ? null : cur))}
            onClick={() => onClick?.(a)}
          />
        ))}
      </Instances>

      {/* Glow lights for hovered/selected regular applicants */}
      {hovered && hovered.floors < SKYSCRAPER_FLOOR_THRESHOLD && (
        <pointLight
          color={hovered.color}
          intensity={3.5}
          distance={14}
          position={[hovered.x, hovered.height + 1, hovered.z]}
        />
      )}
      {focusedSelected && (
        <pointLight
          color={"#00FFCC"}
          intensity={5}
          distance={18}
          position={[focusedSelected.x, focusedSelected.height + 1, focusedSelected.z]}
        />
      )}

      {/* Skyscrapers — power applicants */}
      {tall.map((a) => (
        <group key={a.id}>
          <Skyscraper
            position={[a.x, 0, a.z]}
            height={a.height}
            baseWidth={1.5}
            color={
              highlightId === a.id
                ? "#FF007F"
                : selectedIds.includes(a.id)
                ? "#00FFCC"
                : a.color
            }
            highlight={
              hoverId === a.id ||
              selectedIds.includes(a.id) ||
              highlightId === a.id
            }
            dim={q ? !matchesQuery(a) : false}
            onClick={() => onClick?.(a)}
            onPointerOver={() => setHoverId(a.id)}
            onPointerOut={() => setHoverId((cur) => (cur === a.id ? null : cur))}
          />
          {a.has_github && (
            <mesh position={[a.x, a.height + 1.8, a.z]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 1.2, 6]} />
              <meshStandardMaterial color="#00FFCC" emissive="#00FFCC" emissiveIntensity={0.9} />
            </mesh>
          )}
        </group>
      ))}

      {/* GitHub antennas on regular towers */}
      {regular
        .filter((a) => a.has_github)
        .map((a) => (
          <mesh
            key={`ant-${a.id}`}
            position={[a.x, a.height + 0.55, a.z]}
            castShadow
          >
            <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
            <meshStandardMaterial color="#00FFCC" emissive="#00FFCC" emissiveIntensity={0.8} />
          </mesh>
        ))}

      {hovered && (
        <Html
          position={[hovered.x, hovered.height + 1.5, hovered.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="glass rounded-md px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-mono text-[10px] tracking-widest text-white/50">
              {hovered.experience_level.toUpperCase()}
            </div>
            <div className="font-semibold">{hovered.display_name}</div>
            <div className="font-mono text-[11px] text-[#00FFCC]">
              {hovered.floors} {hovered.floors === 1 ? "APPLICATION" : "APPLICATIONS"}
              {hovered.floors >= SKYSCRAPER_FLOOR_THRESHOLD && " · POWER USER"}
            </div>
            {hovered.has_github && (
              <div className="font-mono text-[10px] text-white/50 mt-0.5">
                ⌁ {hovered.github_commits_30d} commits / 30d
              </div>
            )}
          </div>
        </Html>
      )}
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
  const dimmedColor = useMemo(() => baseColor.clone().multiplyScalar(0.45), [baseColor]);
  const selectedColor = useMemo(() => new THREE.Color("#00FFCC"), []);
  const highlightColor = useMemo(() => new THREE.Color("#FF007F"), []);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const t = highlighted ? 1.15 : selected ? 1.08 : hovered ? 1.04 : 1.0;
    targetScale.set(t, a.height, t);
    ref.current.scale.lerp(targetScale, Math.min(1, dt * 8));
    let target;
    if (highlighted) target = highlightColor;
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
