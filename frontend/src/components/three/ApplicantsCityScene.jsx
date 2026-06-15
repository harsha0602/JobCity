import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ApplicantBuildings from "./ApplicantBuildings";
import { api } from "@/lib/api";
import { getRoadTexture } from "@/lib/roadTex";

const GROUND_SIZE = 140;

function CityGround() {
  const tex = useMemo(() => {
    const t = getRoadTexture();
    // Match repeat to ground size so each "tile" covers a 4x4 grid of slots (~10 units per tile)
    t.repeat.set(GROUND_SIZE / 10, GROUND_SIZE / 10);
    return t;
  }, []);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#00FFCC"
        emissiveIntensity={0.18}
        roughness={0.85}
        metalness={0.1}
      />
    </mesh>
  );
}

export default function ApplicantsCityScene({ onApplicantClick, selectedIds = [], highlightId, query = "" }) {
  const [applicants, setApplicants] = useState(null);

  useEffect(() => {
    api
      .get("/applicants-city/buildings")
      .then((r) => setApplicants(r.data.applicants))
      .catch(() => setApplicants([]));
  }, []);

  const initialCamera = useMemo(() => [25, 35, 40], []);

  return (
    <Canvas
      className="three-canvas"
      shadows
      camera={{ position: initialCamera, fov: 45, near: 0.1, far: 500 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#050510"]} />
      <fog attach="fog" args={["#050510", 60, 180]} />

      <hemisphereLight args={["#0B0C10", "#000000", 0.6]} />
      <directionalLight
        position={[30, 60, 20]}
        intensity={1.1}
        color={"#00FFCC"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <pointLight position={[-20, 8, -20]} intensity={0.7} color="#FF007F" />
      <pointLight position={[20, 8, 20]} intensity={0.7} color="#00FFCC" />
      <ambientLight intensity={0.28} color={"#1a3a3a"} />

      <CityGround />

      <Suspense fallback={null}>
        {applicants && (
          <ApplicantBuildings
            applicants={applicants}
            onClick={onApplicantClick}
            selectedIds={selectedIds}
            highlightId={highlightId}
            query={query}
          />
        )}
      </Suspense>

      <OrbitControls
        enablePan
        minDistance={10}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
