import { useMemo, useRef, useState } from "react";
import { Html, Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { project } from "@/lib/projection";

/**
 * Render company buildings as a single InstancedMesh per the design guidelines.
 * One draw call for hundreds of buildings, with per-instance hover/click.
 */
export default function CompanyBuildings({ cities, onCompanyClick, selected, query = "" }) {
  const [hoverIdx, setHoverIdx] = useState(-1);

  const buildings = useMemo(() => {
    const out = [];
    for (const c of cities) {
      const [cx, cz] = project(c.lat, c.lng);
      const sorted = [...c.companies].sort((a, b) => b.floors - a.floors);
      sorted.forEach((co, i) => {
        const angle = i * 2.39996;
        const r = i === 0 ? 0 : Math.sqrt(i) * 2.2;
        out.push({
          ...co,
          city: c.city,
          state: c.state,
          x: cx + r * Math.cos(angle),
          z: cz + r * Math.sin(angle),
          height: Math.max(co.floors * 1.6, 1.6),
        });
      });
    }
    return out;
  }, [cities]);

  const q = (query || "").trim().toLowerCase();
  const matchesQuery = (b) => {
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      b.state.toLowerCase().includes(q)
    );
  };

  const hovered = hoverIdx >= 0 ? buildings[hoverIdx] : null;

  return (
    <group>
      <Instances limit={Math.max(buildings.length, 8)} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1, 1.6]} />
        <meshStandardMaterial
          vertexColors={false}
          roughness={0.45}
          metalness={0.15}
        />
        {buildings.map((b, i) => (
          <BuildingInstance
            key={`${b.city}-${b.id}-${i}`}
            b={b}
            idx={i}
            hovered={hoverIdx === i}
            selected={selected && selected.id === b.id && selected.city === b.city}
            dimmed={q ? !matchesQuery(b) : false}
            onPointerOver={() => {
              setHoverIdx(i);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHoverIdx((cur) => (cur === i ? -1 : cur));
              document.body.style.cursor = "";
            }}
            onClick={() => onCompanyClick?.(b)}
          />
        ))}
      </Instances>

      {hovered && (
        <Html
          position={[hovered.x, hovered.height + 0.8, hovered.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="glass rounded-md px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-mono text-[10px] tracking-widest text-white/50">
              {hovered.city.toUpperCase()}, {hovered.state}
            </div>
            <div className="font-semibold mt-0.5">{hovered.name}</div>
            <div className="font-mono text-[11px]" style={{ color: hovered.color }}>
              {hovered.floors} {hovered.floors === 1 ? "JOB" : "JOBS"}
            </div>
          </div>
        </Html>
      )}

      {cities.map((c) => {
        const [x, z] = project(c.lat, c.lng);
        return (
          <group key={`label-${c.city}`} position={[x, 0.02, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[2.4, 2.7, 32]} />
              <meshBasicMaterial color="#FFB24C" transparent opacity={0.45} />
            </mesh>
            <Html
              position={[0, 0.05, 3.0]}
              center
              distanceFactor={20}
              style={{ pointerEvents: "none" }}
            >
              <div className="label-mono whitespace-nowrap">
                {c.city.toUpperCase()} · {c.total_jobs}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function BuildingInstance({ b, idx, hovered, selected, dimmed, onPointerOver, onPointerOut, onClick }) {
  const ref = useRef();
  // Color (animated to white-emissive when hovered/selected)
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const color = useMemo(() => new THREE.Color(b.color || "#FFB24C"), [b.color]);
  const dimmedColor = useMemo(() => color.clone().multiplyScalar(0.2), [color]);
  const highlightColor = useMemo(() => new THREE.Color("#ffffff"), []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const t = selected ? 1.12 : hovered ? 1.06 : 1.0;
    targetScale.set(t, b.height, t);
    ref.current.scale.lerp(targetScale, Math.min(1, dt * 8));
    if (hovered || selected) ref.current.color.lerp(highlightColor, Math.min(1, dt * 6));
    else if (dimmed) ref.current.color.lerp(dimmedColor, Math.min(1, dt * 4));
    else ref.current.color.lerp(color, Math.min(1, dt * 6));
  });

  return (
    <Instance
      ref={ref}
      position={[b.x, b.height / 2, b.z]}
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
