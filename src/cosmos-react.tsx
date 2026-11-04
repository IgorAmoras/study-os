/**
 * Study OS scientific cosmos. React Three Fiber owns the WebGL scene while the
 * surrounding research UI remains a small, progressively-migrated shell.
 * Positions are explicit and stable: no force simulation or random layout.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { NODES } from './nodes.js';

type CameraState = { yaw: number; pitch: number; distance: number; target: number[] };
type ControlsOptions = {
  getCamera?: () => CameraState;
  onCamera?: (value: CameraState, save: boolean) => void;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  hero?: boolean;
};
type Bridge = { select: (id: string) => void; resetCamera: () => void; setActive: (value: boolean) => void; active: boolean; pendingSelection: string };

const edges = Array.from(new Set(NODES.flatMap(n => n.links.map((id: string) => [id, n.id].sort().join('|')))))
  .map(id => id.split('|')).filter(parts => parts.every(part => NODES.some(n => n.id === part)));
const byId = new Map(NODES.map(n => [n.id, n]));
const initial = { yaw: -.42, pitch: .16, distance: 18, target: [5, 0, 0] };

function positionFrom(camera: CameraState): [number, number, number] {
  const { yaw, pitch, distance: d, target: t } = camera;
  return [t[0] + d * Math.sin(yaw) * Math.cos(pitch),
    t[1] + d * Math.sin(pitch), t[2] + d * Math.cos(yaw) * Math.cos(pitch)];
}

function Orbit({ options, reset }: { options: ControlsOptions; reset: React.MutableRefObject<() => void> }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    reset.current = () => {
      const state = options.getCamera?.() ?? initial;
      camera.position.set(...positionFrom(state));
      controls.current?.target.set(state.target[0], state.target[1], state.target[2]);
      controls.current?.update();
      invalidate();
    };
    reset.current();
  }, [camera, options, reset, invalidate]);
  const ended = () => {
    const c = controls.current;
    if (!c) return;
    options.onCamera?.({
      yaw: c.getAzimuthalAngle(), pitch: Math.PI / 2 - c.getPolarAngle(),
      distance: c.getDistance(), target: c.target.toArray(),
    }, true);
  };
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.075}
    minDistance={3.5} maxDistance={80} maxPolarAngle={Math.PI - .15}
    minPolarAngle={.15} enablePan enableZoom onEnd={ended} />;
}

function CelestialNode({ node, selected, hero, onSelect, onOpen }: {
  node: (typeof NODES)[number]; selected: boolean; hero: boolean;
  onSelect: (id: string) => void; onOpen: (id: string) => void;
}) {
  const materialColor = useMemo(() => new THREE.Color(node.color), [node.color]);
  return <group position={node.p as [number, number, number]}>
    <mesh scale={node.r * (selected ? 2.3 : 1.8)}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={materialColor} transparent opacity={selected ? .07 : .035}
        depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
    <mesh rotation={[.36, .24, .15]} scale={node.r * (selected ? 1.7 : 1.35)}>
      <torusGeometry args={[1, .012, 4, 80]} />
      <meshBasicMaterial color={materialColor} transparent opacity={selected ? .8 : .42} />
    </mesh>
    <mesh onClick={e => { if (hero) return; e.stopPropagation(); onSelect(node.id); }}
      onDoubleClick={e => { if (hero) return; e.stopPropagation(); onOpen(node.id); }}
      scale={node.r}>
      <icosahedronGeometry args={[1, 2]} />
      <meshPhysicalMaterial color={materialColor} emissive={materialColor}
        emissiveIntensity={selected ? .72 : .38} roughness={.3} metalness={.3}
        clearcoat={.8} clearcoatRoughness={.25} />
    </mesh>
    {!hero && <Html position={[0, -(node.r + .52), 0]} center distanceFactor={15}
      style={{ pointerEvents: 'none', color: selected ? '#eef7ff' : '#a6c3df',
        font: '600 12px system-ui,sans-serif', letterSpacing: '.03em',
        whiteSpace: 'nowrap', textShadow: '0 2px 7px #010717' }}>
      {node.title}
    </Html>}
  </group>;
}

function Scene({ options, selected, onSelect, onOpen, reset }: {
  options: ControlsOptions; selected: string; onSelect: (id: string) => void;
  onOpen: (id: string) => void; reset: React.MutableRefObject<() => void>;
}) {
  return <>
    <color attach="background" args={['#06101e']} />
    <fog attach="fog" args={['#06101e', 65, 150]} />
    <ambientLight intensity={.7} />
    <pointLight position={[4, 12, 14]} intensity={65} color="#77b9ff" distance={50} />
    <pointLight position={[12, -4, -8]} intensity={45} color="#b68bff" distance={45} />
    <Stars radius={85} depth={100} count={options.hero ? 1200 : 2100} factor={3}
      saturation={0} fade speed={.3} />
    {edges.map(([from, to]) => {
      const a = byId.get(from)!, b = byId.get(to)!;
      return <Line key={`${from}-${to}`} points={[a.p as [number, number, number], b.p as [number, number, number]]}
        color={from === selected || to === selected ? '#a5d8ff' : '#39628c'}
        transparent opacity={from === selected || to === selected ? .8 : .3}
        lineWidth={from === selected || to === selected ? 1.6 : .75} />;
    })}
    {NODES.map(n => <CelestialNode key={n.id} node={n} selected={n.id === selected}
      hero={!!options.hero} onSelect={onSelect} onOpen={onOpen} />)}
    {options.hero ? <OrbitControls makeDefault enableZoom={false} enablePan={false}
        enableRotate={false} autoRotate autoRotateSpeed={.23} /> :
      <Orbit options={options} reset={reset} />}
  </>;
}

function Cosmos({ options, bridge }: { options: ControlsOptions; bridge: Bridge }) {
  const [selected, setSelected] = useState(bridge.pendingSelection);
  const [active, setActive] = useState(bridge.active);
  const reset = useRef<() => void>(() => {});
  useEffect(() => { bridge.select = setSelected; bridge.setActive = setActive; bridge.resetCamera = () => reset.current(); setActive(bridge.active); setSelected(bridge.pendingSelection); }, [bridge]);
  const state = options.hero
    ? { yaw: -.5, pitch: .16, distance: 21, target: [7, 0, 0] }
    : (options.getCamera?.() ?? initial);
  return <Canvas frameloop={active ? 'always' : 'never'} dpr={[1, 1.75]} camera={{ position: positionFrom(state), fov: 55, near: .1, far: 260 }}
    gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    style={{ width: '100%', height: '100%', touchAction: 'none' }}>
    <Scene options={options} selected={selected} onSelect={setSelectedAndNotify}
      onOpen={id => options.onOpen?.(id)} reset={reset} />
  </Canvas>;
  function setSelectedAndNotify(id: string) { setSelected(id); options.onSelect?.(id); }
}

/** Bridge for the existing shell; only the WebGL island depends on React. */
export function createCosmos(element: HTMLElement, options: ControlsOptions = {}) {
  const root: Root = createRoot(element);
  const bridge: Bridge = { select: () => {}, resetCamera: () => {}, setActive: () => {}, active: false, pendingSelection: 'duffing' };
  root.render(<Cosmos options={options} bridge={bridge} />);
  return {
    start() { bridge.active = true; bridge.setActive(true); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); },
    stop() { bridge.active = false; bridge.setActive(false); },
    select(id: string) { bridge.pendingSelection = id; bridge.select(id); },
    resetCamera() { bridge.resetCamera(); },
    render() {},
    reset() { bridge.select('duffing'); bridge.resetCamera(); },
    destroy() { root.unmount(); },
  };
}
