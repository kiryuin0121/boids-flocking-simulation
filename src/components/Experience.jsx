import {
  Center,
  Environment,
  Float,
  MeshTransmissionMaterial,
  OrbitControls,
  SoftShadows,
  Stars,
  Stats,
  Text3D,
} from "@react-three/drei";

import { useAtom } from "jotai";
import { Boids } from "./Boids";
import { themeAtom, THEMES } from "./UI";
import { useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import { DoubleSide } from "three";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  GodRays,
} from "@react-three/postprocessing";
import { degToRad } from "three/src/math/MathUtils.js";

export const Experience = () => {
  const [theme] = useAtom(themeAtom);

  const boundaries = useControls(
    "Boundaries",
    {
      debug: false,
      x: { value: 12, min: 0, max: 40 },
      y: { value: 8, min: 0, max: 40 },
      z: { value: 20, min: 0, max: 40 },
    },
    { collapsed: true },
  );
  const [size, setSize] = useState([window.innerWidth, window.innerHeight]);
  const scaleX = Math.max(0.5, size[0] / 1920);
  const scaleY = Math.max(0.5, size[1] / 1080);
  const responsiveBoundaries = {
    x: boundaries.x * scaleX,
    y: boundaries.y * scaleY,
    z: boundaries.z,
  };
  useEffect(() => {
    let timeout;
    function updateSize() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setSize([window.innerWidth, window.innerHeight]);
      }, 50);
    }
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const sunRef = useRef();

  const { focusRange, focusDistance, focalLength, bokehScale } = useControls(
    "Depth of field",
    {
      focusRange: { value: 3.5, min: 0, max: 20, step: 0.01 },
      focusDistance: { value: 0.25, min: 0, max: 1, step: 0.01 },
      focalLength: { value: 0.22, min: 0, max: 1, step: 0.01 },
      bokehScale: { value: 5.5, min: 0, max: 10, step: 0.1 },
    },
    {
      collapsed: true,
    },
  );

  const transmissionMaterialProps = useControls(
    "MeshTransmissionMaterial",
    {
      transmission: {
        value: 1,
        min: 0,
        max: 1,
        step: 0.01,
      },

      roughness: {
        value: 0,
        min: 0,
        max: 1,
        step: 0.01,
      },

      thickness: {
        value: 40,
        min: 0,
        max: 100,
        step: 0.1,
      },

      ior: {
        value: 1.5,
        min: 1,
        max: 3,
        step: 0.01,
      },

      chromaticAberration: {
        value: 0.25,
        min: 0,
        max: 1,
        step: 0.001,
      },

      anisotropy: {
        value: 0.4,
        min: 0,
        max: 1,
        step: 0.01,
      },

      distortion: {
        value: 0,
        min: 0,
        max: 1,
        step: 0.01,
      },

      distortionScale: {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
      },

      temporalDistortion: {
        value: 0,
        min: 0,
        max: 1,
        step: 0.01,
      },

      clearcoat: {
        value: 1,
        min: 0,
        max: 1,
        step: 0.01,
      },

      attenuationDistance: {
        value: 0.5,
        min: 0,
        max: 10,
        step: 0.01,
      },

      attenuationColor: "#ffffff",

      backside: false,

      backsideThickness: {
        value: 0,
        min: 0,
        max: 10,
        step: 0.01,
      },

      samples: {
        value: 3,
        min: 1,
        max: 32,
        step: 1,
      },

      resolution: {
        value: 256,
        min: 32,
        max: 2048,
        step: 1,
      },
    },
    {
      collapsed: true,
    },
  );
  return (
    <>
      <Stats />
      <OrbitControls />
      <Boids boundaries={responsiveBoundaries} />

      {theme === "space" && <Stars />}

      {/* GROUND */}
      <mesh
        position-y={-responsiveBoundaries.y / 2}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={THEMES[theme].groundColor} />
      </mesh>

      <mesh visible={boundaries.debug}>
        <boxGeometry
          args={[
            responsiveBoundaries.x,
            responsiveBoundaries.y,
            responsiveBoundaries.z,
          ]}
        />
        <meshStandardMaterial
          color="orange"
          transparent
          opacity={0.5}
          side={DoubleSide}
        />
      </mesh>

      {/* LIGHTS */}
      <SoftShadows size={15} focus={1.5} samples={12} />
      <Environment preset="sunset"></Environment>
      <directionalLight
        position={[15, 15, 15]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
        shadow-camera-far={300}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.1}
      />
      <hemisphereLight
        intensity={1.35}
        color={THEMES[theme].skyColor}
        groundColor={THEMES[theme].groundColor}
      />

      {/* SUN */}
      <mesh
        // ref={sunRef}
        position-y={responsiveBoundaries.y / 4}
        position-z={-10}
        rotation-x={degToRad(70)}
      >
        <circleGeometry args={[16, 64]} />
        <meshBasicMaterial
          depthWrite={false}
          color={THEMES[theme].sunColor}
          transparent
          opacity={1}
        />
      </mesh>

      {/* TEXT */}
      <group key={theme + scaleX}>
        <Float
          position-y={0.5 * scaleX}
          floatIntensity={2 * scaleX}
          rotationIntensity={2}
        >
          <Center>
            <Text3D
              castShadow
              bevelEnabled
              font="/fonts/Poppins Black_Regular.json"
              smooth={1}
              scale={0.008 * scaleX}
              size={100}
              height={4}
              curveSegments={10}
              bevelThickness={20}
              bevelSize={2}
              bevelOffset={0}
              bevelSegments={5}
            >
              {THEMES[theme].title}
              <MeshTransmissionMaterial
                clearcoat={1}
                samples={3}
                thickness={40}
                chromaticAberration={0.25}
                anisotropy={0.4}
              />
              {/* <MeshTransmissionMaterial {...transmissionMaterialProps} /> */}
            </Text3D>
          </Center>
        </Float>
        <Float position-y={-0.5 * scaleX} speed={3} floatIntensity={1 * scaleX}>
          <Center>
            <Text3D
              castShadow
              bevelEnabled
              font="/fonts/Poppins Black_Regular.json"
              smooth={1}
              scale={0.008 * scaleX}
              size={100}
              height={4}
              curveSegments={10}
              bevelThickness={20}
              bevelSize={2}
              bevelOffset={0}
              bevelSegments={5}
            >
              {THEMES[theme].subtitle}
              <MeshTransmissionMaterial
                clearcoat={1}
                samples={3}
                thickness={40}
                chromaticAberration={0.25}
                anisotropy={0.4}
              />
              {/* <MeshTransmissionMaterial {...transmissionMaterialProps} /> */}
            </Text3D>
          </Center>
        </Float>
      </group>
    </>
  );
};
