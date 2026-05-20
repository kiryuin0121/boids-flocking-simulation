import { useAnimations, useGLTF } from "@react-three/drei";
import { useAtom } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import { themeAtom, THEMES } from "./UI";
import { useControls } from "leva";
import { randFloat, randInt } from "three/src/math/MathUtils.js";
import { useFrame } from "@react-three/fiber";

const remap = (value, fromMin, fromMax, toMin, toMax) => {
  return toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin);
};

const wander = new Vector3(); //ゆらめきを表現するための角度
const limits = new Vector3(); //移動可能な空間の境界
const alignment = new Vector3(); //近距離にいる周囲の個体の平均的な進行方向
const avoidance = new Vector3(); //衝突しそうな周囲の個体の平均的な反発方向
const cohesion = new Vector3(); // 近距離にいる周囲の個体の平均的な位置

const steering = new Vector3(); //Boidの進行ベクトル(wander,limits,alignement,avoidance,cohesionの影響を受ける)

export const Boids = ({ boundaries }) => {
  const [theme] = useAtom(themeAtom);
  const { NB_BOIDS, MIN_SCALE, MAX_SCALE, MIN_SPEED, MAX_SPEED, MAX_STEERING } =
    useControls(
      "General settings",
      {
        NB_BOIDS: { value: 60, min: 1, max: 200 },
        MIN_SCALE: { value: 0.7, min: 0.1, max: 2, step: 0.1 },
        MAX_SCALE: { value: 1.3, min: 0.1, max: 2, step: 0.1 },
        MIN_SPEED: { value: 0.9, min: 0, max: 10, step: 0.1 },
        MAX_SPEED: { value: 3.6, min: 0, max: 10, step: 0.1 },
        MAX_STEERING: { value: 0.1, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: true },
    );
  const { threeD, ALIGNEMENT, AVOIDANCE ,COHESION} = useControls(
    "Boid Rules",
    {
      threeD: { value: true },
      ALIGNEMENT: { value: true },
      AVOIDANCE: { value: true },
      COHESION: { value: true },
    },
    { collapsed: true },
  );
  const { WANDER_RADIUS, WANDER_STRENGTH, WANDER_CIRCLE } = useControls(
    "Wander",
    {
      WANDER_CIRCLE: false,
      WANDER_RADIUS: { value: 5, min: 1, max: 10, step: 1 },
      WANDER_STRENGTH: { value: 2, min: 0, max: 10, step: 1 },
    },
    { collapsed: true },
  );
  const { ALIGN_RADIUS, ALIGN_STRENGTH, ALIGN_CIRCLE } = useControls(
    "Alignment",
    {
      ALIGN_CIRCLE: false,
      ALIGN_RADIUS: { value: 1.2, min: 0, max: 10, step: 0.1 },
      ALIGN_STRENGTH: { value: 4, min: 0, max: 10, step: 1 },
    },
    { collapsed: true },
  );
  const { AVOID_RADIUS, AVOID_STRENGTH, AVOID_CIRCLE } = useControls(
    "Avoidance",
    {
      AVOID_CIRCLE: false,
      AVOID_RADIUS: { value: 0.8, min: 0, max: 2 },
      AVOID_STRENGTH: { value: 2, min: 0, max: 10, step: 1 },
    },
    { collapsed: true },
  );

  const { COHESION_RADIUS, COHESION_STRENGTH, COHESION_CIRCLE } = useControls(
    "Cohesion",
    {
      COHESION_CIRCLE: false,
      COHESION_RADIUS: { value: 1.22, min: 0, max: 2 },
      COHESION_STRENGTH: { value: 4, min: 0, max: 10, step: 1 },
    },
    { collapsed: true },
  );
  const boids = useMemo(() => {
    return new Array(NB_BOIDS).fill().map((_, i) => ({
      model: THEMES[theme].models[randInt(0, THEMES[theme].models.length - 1)],
      position: new Vector3(
        randFloat(-boundaries.x / 2, boundaries.x / 2),
        randFloat(-boundaries.y / 2, boundaries.y / 2),
        threeD ? randFloat(-boundaries.z / 2, boundaries.z / 2) : 0,
      ),
      velocity: new Vector3(0, 0, 0),
      wander: randFloat(0, Math.PI * 2),
      scale: randFloat(MIN_SCALE, MAX_SCALE),
    }));
  }, [NB_BOIDS, boundaries, theme, MIN_SCALE, MAX_SCALE, threeD]);

  useFrame((_, delta) => {
    for (let i = 0; i < boids.length; i++) {
      const boid = boids[i];
      // WANDER
      boid.wander += randFloat(-0.05, 0.05); //Boidがフラフラ動く様子を表現するためにランダムな値を加算する。
      //角度から生体方向のベクトルを生成
      wander.set(
        Math.cos(boid.wander) * WANDER_RADIUS,
        Math.sin(boid.wander) * WANDER_RADIUS,
        0,
      );
      // ベクトルの大きさを ゆらめきの強さ(WANDER_STRENGTH)にする。
      wander.normalize(); //単位ベクトルに変換する理由：方向によって力の強さが変わるため。大きさを1にそろえてから好きな強さを掛け算したほうが都合がいい。
      wander.multiplyScalar(WANDER_STRENGTH);

      // RESET FORCES
      limits.multiplyScalar(0);
      steering.multiplyScalar(0);
      alignment.multiplyScalar(0);
      avoidance.multiplyScalar(0);
      cohesion.multiplyScalar(0);
      

      // LIMITS
      if (Math.abs(boid.position.x) + 1 > boundaries.x / 2) {
        limits.x = -boid.position.x;
        boid.wander += Math.PI;
      }
      if (Math.abs(boid.position.y) + 1 > boundaries.y / 2) {
        limits.y = -boid.position.y;
        boid.wander += Math.PI;
      }
      if (Math.abs(boid.position.z) + 1 > boundaries.z / 2) {
        limits.z = -boid.position.z;
        boid.wander += Math.PI;
      }
      limits.normalize();
      limits.multiplyScalar(50);

      // BOID ALGORITHM
      let totalCohesion=0;
      for (let b = 0; b < boids.length; b++) {
        if (b === i) continue;
        // ALIGNEMENT：近くにいる個体と“同じ向き”に進もうとする。
        /* 
          1. 近くの個体を探す
          2. そのBoidたちの進行方向を集めることで最終的な進行方向を作る(距離に応じて大きさを調整)
          3. その方向へ少しだけ舵を切る
        */
        // 他のBoidとの距離を取得
        const other = boids[b];
        let d = boid.position.distanceTo(other.position);
        if (d > 0 && d < ALIGN_RADIUS) {
          const copy = other.velocity.clone(); //cloneする理由：normalize() や divideScalar() は元データを書き換えてしまうため
          // 近くの個体のベクトルの矢印を次々と足し算していくことで、大まかな進行方向がわかる。このとき距離に応じて大きさを調整するようにする。
          copy.normalize();
          copy.divideScalar(d);
          alignment.add(copy);
        }

        // AVOIDANCE
        /* 
          1. 衝突しそうな個体を探す
          2. 相手から反発する方向を集めることで最終的な反発方向を作る(距離に応じて大きさを調整)
          3. 逃げる方向へ舵を切る
        */
        if (d > 0 && d < AVOID_RADIUS) {
          const diff = boid.position.clone().sub(other.position);
          diff.normalize();
          diff.divideScalar(d);
          avoidance.add(diff);
        }

        // COHESION
        /* 
          1. 近くの個体を探す
          2. 周囲の個体の平均位置を求める(個体の位置のベクトルの総和を 個体数で割り算する)
          3. その方向へ少しだけ舵を切る
        */
        if (d > 0 && d < COHESION_RADIUS) {
          cohesion.add(other.position);
          totalCohesion++;
        }
      }

      // APPLY FORCES
      steering.add(limits);
      steering.add(wander);
      if (ALIGNEMENT) {
        alignment.normalize();
        alignment.multiplyScalar(ALIGN_STRENGTH);
        steering.add(alignment);
      }
      if (AVOIDANCE) {
        avoidance.normalize();
        avoidance.multiplyScalar(AVOID_STRENGTH);
        steering.add(avoidance);
      }
      if (COHESION && totalCohesion > 0) {
        cohesion.divideScalar(totalCohesion); //凝集位置を求める
        cohesion.sub(boid.position); //進行方向(自分→凝集位置)を求める
        cohesion.normalize();
        cohesion.multiplyScalar(COHESION_STRENGTH);
        steering.add(cohesion);
      }

      steering.clampLength(0, MAX_STEERING * delta); //deltaを掛け算する理由：アニメーションをfpsに依存させないため

      boid.velocity.add(steering);
      boid.velocity.clampLength(
        0,
        remap(boid.scale, MIN_SCALE, MAX_SCALE, MAX_SPEED, MIN_SPEED) * delta,
      );

      // APPLY VELOCITY
      boid.position.add(boid.velocity);
    }
  });
  return boids.map((boid, index) => (
    <Boid
      key={index + boid.model}
      position={boid.position}
      model={boid.model}
      scale={boid.scale}
      velocity={boid.velocity}
      animation={"Fish_Armature|Swimming_Fast"}
      wanderCircle={WANDER_CIRCLE}
      wanderRadius={WANDER_RADIUS / boid.scale}
      alignCircle={ALIGN_CIRCLE}
      alignRadius={ALIGN_RADIUS / boid.scale}
      avoidCircle={AVOID_CIRCLE}
      avoidRadius={AVOID_RADIUS / boid.scale}
      cohesionCircle={COHESION_CIRCLE}
      cohesionRadius={COHESION_RADIUS / boid.scale}
    />
  ));
};

const Boid = ({
  position,
  model,
  scale,
  velocity,
  animation,
  wanderCircle,
  wanderRadius,
  alignCircle,
  alignRadius,
  avoidCircle,
  avoidRadius,
  cohesionCircle,
  cohesionRadius,
  ...props
}) => {
  const { scene, animations } = useGLTF(`/models/${model}.glb`);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const group = useRef();
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
  }, []);

  useEffect(() => {
    actions[animation]?.play();
    return () => {
      actions[animation]?.stop();
    };
  }, [animation]);

  useFrame(() => {
    // clone:純粋に値だけほしいとき(参照は断ち切りたい)
    // copy:オブジェクトの中身だけ書き換えたいとき(参照は保ちたい)
    const target = group.current.clone(false);
    target.lookAt(group.current.position.clone().add(velocity));
    group.current.quaternion.slerp(target.quaternion, 0.1);
    group.current.position.copy(position);
  });

  return (
    <group {...props} ref={group} position={position}>
      <primitive object={clone} rotation-y={Math.PI / 2} />
      <mesh visible={wanderCircle}>
        <sphereGeometry args={[wanderRadius, 32]} />
        <meshBasicMaterial color={"red"} wireframe />
      </mesh>
      <mesh visible={alignCircle}>
        <sphereGeometry args={[alignRadius, 32]} />
        <meshBasicMaterial color={"green"} wireframe />
      </mesh>
      <mesh visible={avoidCircle}>
        <sphereGeometry args={[avoidRadius, 32]} />
        <meshBasicMaterial color={"blue"} wireframe />
      </mesh>
       <mesh visible={cohesionCircle}>
        <sphereGeometry args={[cohesionRadius, 32]} />
        <meshBasicMaterial color={"yellow"} wireframe />
      </mesh>
    </group>
  );
};
