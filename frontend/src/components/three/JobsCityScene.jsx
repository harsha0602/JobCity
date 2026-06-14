import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import USAMap from "./USAMap";
import CompanyBuildings from "./CompanyBuildings";
import { api } from "@/lib/api";

export default function JobsCityScene({ onCompanyClick, selected, query = "" }) {
  const [cities, setCities] = useState(null);

  useEffect(() => {
    api.get("/jobs-city/buildings").then((r) => setCities(r.data.cities)).catch(() => setCities([]));
  }, []);

  return (
    <Canvas
      className="three-canvas"
      shadows
      camera={{ position: [0, 50, 70], fov: 45, near: 0.1, far: 500 }}
      gl={{ antialias: true }}
    >
      {/* Solid dusk sky */}
      <color attach="background" args={["#190B1C"]} />
      <fog attach="fog" args={["#190B1C", 70, 230]} />

      <hemisphereLight args={["#FFC371", "#3a1f30", 0.7]} />
      <directionalLight
        position={[30, 50, 25]}
        intensity={1.4}
        color={"#FF7B54"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <pointLight position={[-40, 25, 30]} intensity={0.7} color="#FF5F6D" />
      <ambientLight intensity={0.22} color={"#FFB24C"} />

      <Stars
        radius={250}
        depth={50}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      <Suspense fallback={null}>
        <USAMap accent="#FFB24C" />
        {cities && <CompanyBuildings cities={cities} onCompanyClick={onCompanyClick} selected={selected} query={query} />}
      </Suspense>

      <OrbitControls
        enablePan
        minDistance={15}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
