import React, { useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";

// Using a reliable public 3D model from Sketchfab
const MODEL_URL =
  "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/headphones/model.gltf";

const HeadsetModel: React.FC = () => {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(MODEL_URL);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Rotate continuously but slower
      groupRef.current.rotation.y += delta * 0.3;

      // Add a subtle floating effect with reduced amplitude
      const time = state.clock.getElapsedTime();
      groupRef.current.position.y = Math.sin(time) * 0.05;
    }
  });

  // Clone the scene to avoid issues with multiple renderers
  const model = scene.clone();

  return (
    <group
      ref={groupRef}
      dispose={null}
      position={[0, -8, 0]}
      scale={3.4} // Further reduced scale and adjusted position
      rotation={[0.1, 0, 0]} // Reset rotation to let OrbitControls handle it
    >
      <primitive object={model} />
      {/* Softer, more balanced lighting setup */}
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <directionalLight position={[-5, -5, -5]} intensity={0.4} />
      <hemisphereLight intensity={0.5} groundColor="#000000" />
      {/* Reduced ambient light intensity */}
      <ambientLight intensity={0.4} />
    </group>
  );
};

useGLTF.preload(MODEL_URL);

export default HeadsetModel;
