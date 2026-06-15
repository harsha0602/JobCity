import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import ApplicantBuildings from "./ApplicantBuildings";
import ApplicantRoads from "./ApplicantRoads";
import { api } from "@/lib/api";

const SPACING = 2.4;

/**
 * Smoothly flies the camera + orbit-controls target to a (x, z) point
 * when `flyTarget` changes. Used by "Navigate to my building".
 */
function CameraFly({ flyTarget, focusedWorldPos, controlsRef }) {
  const { camera } = useThree();
  const tweenRef = useRef(null);

  useEffect(() => {
    if (!flyTarget) return;
    const [tx, tz, zoom] = flyTarget;
    const startPos = camera.position.clone();
    const startTarget = controlsRef.current?.target?.clone() || new THREE.Vector3(0, 0, 0);
    const offsets = zoom === "close"
      ? { dx: 4, dy: 8, dz: 6, ty: 3 }
      : { dx: 8, dy: 14, dz: 12, ty: 2 };
    const endTarget = new THREE.Vector3(tx, offsets.ty, tz);
    const endPos = new THREE.Vector3(tx + offsets.dx, offsets.dy, tz + offsets.dz);
    tweenRef.current = { t: 0, startPos, endPos, startTarget, endTarget };
    // Pause auto-rotate while tweening
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, [flyTarget, camera, controlsRef]);

  // Keep orbit target locked to the focused building so the autoRotate
  // happens AROUND that tower (the user can also drag freely).
  useEffect(() => {
    if (!controlsRef.current) return;
    if (focusedWorldPos) {
      controlsRef.current.autoRotate = true;
      controlsRef.current.autoRotateSpeed = 0.6;
    } else {
      controlsRef.current.autoRotate = false;
    }
  }, [focusedWorldPos, controlsRef]);

  useFrame((_, dt) => {
    const w = tweenRef.current;
    if (!w) return;
    w.t = Math.min(1, w.t + dt * 0.8);
    const e = 1 - Math.pow(1 - w.t, 3);
    camera.position.lerpVectors(w.startPos, w.endPos, e);
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(w.startTarget, w.endTarget, e);
      controlsRef.current.update();
    }
    if (w.t >= 1) {
      tweenRef.current = null;
      // Resume auto-rotate around the focused tower
      if (controlsRef.current && focusedWorldPos) {
        controlsRef.current.autoRotate = true;
      }
    }
  });
  return null;
}

export default function ApplicantsCityScene({
  onApplicantClick,
  selectedIds = [],
  highlightId,
  focusId,
  flyTarget,
  query = "",
  onApplicantsLoaded,
}) {
  const [applicants, setApplicants] = useState(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    api
      .get("/applicants-city/buildings")
      .then((r) => {
        setApplicants(r.data.applicants);
        onApplicantsLoaded?.(r.data.applicants);
      })
      .catch(() => setApplicants([]));
  }, [onApplicantsLoaded]);

  const focusedWorldPos = useMemo(() => {
    if (!focusId || !applicants) return null;
    const f = applicants.find((a) => a.id === focusId);
    if (!f) return null;
    return [f.grid_x * SPACING, 0, f.grid_z * SPACING];
  }, [focusId, applicants]);

  const initialCamera = useMemo(() => [25, 35, 40], []);

  return (
    <Canvas
      className="three-canvas"
      shadows
      camera={{ position: initialCamera, fov: 45, near: 0.1, far: 500 }}
      gl={{ antialias: true }}
    >
      {/* Deep forest-green night sky */}
      <color attach="background" args={["#091a12"]} />
      <fog attach="fog" args={["#091a12", 55, 170]} />

      <hemisphereLight args={["#1f5a3a", "#020806", 0.55]} />
      <directionalLight
        position={[30, 60, 20]}
        intensity={0.9}
        color={"#7bff9c"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <ambientLight intensity={0.35} color="#5BE3A3" />
      <pointLight position={[-20, 8, -20]} intensity={0.6} color="#FFD23F" />
      <pointLight position={[20, 8, 20]} intensity={0.6} color="#5BE3A3" />

      {/* Dark ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color={"#06120b"} roughness={0.92} metalness={0.05} />
      </mesh>

      <Grid
        position={[0, 0, 0]}
        args={[140, 140]}
        cellSize={2.4}
        cellThickness={0.5}
        cellColor={"#1b4a30"}
        sectionSize={24}
        sectionThickness={1}
        sectionColor={"#5BE3A3"}
        fadeDistance={120}
        fadeStrength={1.4}
        infiniteGrid={false}
        followCamera={false}
      />

      {/* Asphalt + neon grid streets between applicant buildings */}
      <ApplicantRoads
        cells={24}
        spacing={SPACING}
        roadWidth={0.6}
        roadColor="#10261a"
        stripeColor="#5BE3A3"
      />

      <Suspense fallback={null}>
        {applicants && (
          <ApplicantBuildings
            applicants={applicants}
            onClick={onApplicantClick}
            selectedIds={selectedIds}
            highlightId={highlightId}
            focusId={focusId}
            query={query}
          />
        )}
      </Suspense>

      <CameraFly flyTarget={flyTarget} focusedWorldPos={focusedWorldPos} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enablePan
        minDistance={10}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
