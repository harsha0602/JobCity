import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import ApplicantBuildings from "./ApplicantBuildings";
import ApplicantRoads from "./ApplicantRoads";
import { api } from "@/lib/api";

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

      <hemisphereLight args={["#0B0C10", "#000000", 0.4]} />
      <directionalLight
        position={[30, 60, 20]}
        intensity={0.8}
        color={"#00FFCC"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <pointLight position={[-20, 8, -20]} intensity={0.5} color="#FF007F" />
      <pointLight position={[20, 8, 20]} intensity={0.5} color="#00FFCC" />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color={"#0A0A0A"} roughness={0.95} metalness={0.05} />
      </mesh>

      <Grid
        position={[0, 0, 0]}
        args={[140, 140]}
        cellSize={2.4}
        cellThickness={0.6}
        cellColor={"#0a3f3a"}
        sectionSize={24}
        sectionThickness={1}
        sectionColor={"#00FFCC"}
        fadeDistance={120}
        fadeStrength={1.4}
        infiniteGrid={false}
        followCamera={false}
      />

      {/* Asphalt + neon grid streets between applicant buildings */}
      <ApplicantRoads cells={24} spacing={2.4} roadWidth={0.6} />

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
