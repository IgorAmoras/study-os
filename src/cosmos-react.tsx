/**
 * Study OS / Cosmic Laboratory — the WebGL science atlas.
 * R3F drives real 3D geometry, orbit controls, faceted objects, particle fields,
 * orbital instrumentation, neon links and a self-contained observatory hero.
 * All scientific entities keep durable XYZ positions across sessions and views.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
type Node = (typeof NODES)[number];
const DEFAULT_CAMERA: CameraState = { yaw: -.42, pitch: .16, distance: 25, target: [5, 0, 0] };
const byId = new Map(NODES.map(n => [n.id, n]));
const edges = Array.from(new Set(NODES.flatMap(n => n.links.map(id => [id, n.id].sort().join('|')))))
  .map(key => key.split('|')).filter(ids => ids.every(id => byId.has(id)));

function cameraPosition(c: CameraState): [number, number, number] {
  const { yaw, pitch, distance: d, target: t } = c;
  return [t[0] + d * Math.sin(yaw) * Math.cos(pitch),
    t[1] + d * Math.sin(pitch), t[2] + d * Math.cos(yaw) * Math.cos(pitch)];
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.96)');
  g.addColorStop(.12, 'rgba(205,229,255,0.66)');
  g.addColorStop(.36, 'rgba(126,193,255,0.23)');
  g.addColorStop(1, 'rgba(80,150,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function OrbitalRings({ radius, color, selected = false }: {radius: number; color: string; selected?: boolean}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * (selected ? .10 : .045); });
  return <group ref={group}>
    <mesh rotation={[.60, .26, .17]}>
      <torusGeometry args={[radius * 1.76, selected ? .014 : .009, 5, 150]} />
      <meshBasicMaterial color={color} transparent opacity={selected ? .76 : .39} depthWrite={false}/>
    </mesh>
    <mesh rotation={[1.18, -.35, .84]}>
      <torusGeometry args={[radius * 1.9, .008, 4, 145]} />
      <meshBasicMaterial color={color} transparent opacity={selected ? .38 : .20} depthWrite={false}/>
    </mesh>
    <mesh rotation={[.21, .88, 1.29]}>
      <torusGeometry args={[radius * 1.36, .008, 4, 130]} />
      <meshBasicMaterial color={color} transparent opacity={selected ? .48 : .25} depthWrite={false}/>
    </mesh>
  </group>;
}

function CelestialNode({ node, selected, onSelect, onOpen }: {
  node: Node; selected: boolean; onSelect: (id: string) => void; onOpen: (id: string) => void;
}) {
  const crystal = useRef<THREE.Group>(null);
  const glow = useMemo(glowTexture, []);
  const color = useMemo(() => new THREE.Color(node.color), [node.color]);
  useEffect(() => () => glow.dispose(), [glow]);
  useFrame((_, dt) => { if (crystal.current) { crystal.current.rotation.y += dt*.095; crystal.current.rotation.x += dt*.018; } });
  const r = node.r;
  return <group position={node.p as [number, number, number]}>
    <sprite scale={[r*8.6, r*8.6, 1]}>
      <spriteMaterial map={glow} color={color} transparent opacity={selected ? .77 : .40}
        depthWrite={false} blending={THREE.AdditiveBlending}/>
    </sprite>
    {selected && <pointLight color={color} intensity={18} distance={r*8} decay={2}/>}
    <OrbitalRings radius={r} color={node.color} selected={selected}/>
    <group ref={crystal}>
      <mesh scale={r * 1.25} onClick={e => {e.stopPropagation();onSelect(node.id);}}
        onDoubleClick={e => {e.stopPropagation();onOpen(node.id);}}>
        <icosahedronGeometry args={[1, 0]}/>
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={selected ? .28 : .12}
          metalness={.52} roughness={.24} flatShading clearcoat={.84} clearcoatRoughness={.16}/>
      </mesh>
      <mesh scale={r*1.259}>
        <icosahedronGeometry args={[1,0]}/>
        <meshBasicMaterial color={color} wireframe transparent opacity={selected ? .44 : .20}
          depthWrite={false}/>
      </mesh>
    </group>
    <Html position={[0, -(r*2.05 + .35), 0]} center distanceFactor={14}
      style={{pointerEvents:'none'}}>
      <div style={{whiteSpace:'nowrap',font:'600 11px Inter,system-ui,sans-serif',
        color:selected?'#ffffff':'#b9d4e9',letterSpacing:'.01em',
        background:selected?'rgba(14,29,49,.92)':'rgba(6,17,32,.70)',
        padding:'7px 12px',borderRadius:6,border:`1px solid ${selected?'#bb9b63':'#375979'}`,
        boxShadow:'0 7px 26px #0006',textShadow:'0 1px 4px #000a'}}>{node.title}</div>
    </Html>
  </group>;
}

function SignalPulse({ points, selected }: {points: [number,number,number][]; selected: boolean}) {
  const mesh = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), [points]);
  useFrame(({clock}) => {
    if (mesh.current && selected) mesh.current.position.copy(curve.getPoint((clock.getElapsedTime()*.12)%1));
  });
  if(!selected) return null;
  return <mesh ref={mesh}><sphereGeometry args={[.052, 8, 8]}/>
    <meshBasicMaterial color="#d5f8ff" toneMapped={false}/></mesh>;
}

function StarDust() {
  const points = useMemo(() => {
    let seed = 52; const rand = () => {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const buffer = new Float32Array(950*3);
    for(let i=0;i<950;i++){const a=rand()*Math.PI*2,rad=3+Math.pow(rand(),.70)*16;
      buffer[i*3]=5+Math.cos(a)*rad;
      buffer[i*3+1]=(rand()-.5)*8;
      buffer[i*3+2]=Math.sin(a)*rad*.84;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(buffer,3));return geo;
  },[]);
  useEffect(()=>()=>points.dispose(),[points]);
  return <points geometry={points}><pointsMaterial size={.06} color="#678ac7" sizeAttenuation
    transparent opacity={.43} depthWrite={false} blending={THREE.AdditiveBlending}/></points>;
}

function HeroObservatory() {
  const core = useRef<THREE.Group>(null);
  const glow = useMemo(glowTexture, []);
  useEffect(()=>()=>glow.dispose(),[glow]);
  useFrame((_,dt)=>{if(core.current)core.current.rotation.y+=dt*.10;});
  return <group position={[7.7,.2,0]}>
    <sprite scale={[19,19,1]}><spriteMaterial map={glow} transparent color="#76bbff" opacity={.72}
      blending={THREE.AdditiveBlending} depthWrite={false}/></sprite>
    <pointLight color="#8bc8ff" intensity={65} distance={18}/>
    <mesh rotation={[.36,.3,.15]}>
      <torusGeometry args={[5.2,.018,6,160]}/><meshBasicMaterial color="#89c5ff" transparent opacity={.58}/>
    </mesh>
    <mesh rotation={[1.16,.2,-.35]}>
      <torusGeometry args={[4.7,.015,6,160]}/><meshBasicMaterial color="#8de6ff" transparent opacity={.50}/>
    </mesh>
    <mesh rotation={[.7,1.1,.5]}>
      <torusGeometry args={[3.95,.012,5,160]}/><meshBasicMaterial color="#ffdfaa" transparent opacity={.38}/>
    </mesh>
    <group ref={core}>
      <mesh><icosahedronGeometry args={[3.90,0]}/>
        <meshPhysicalMaterial color="#a6dcff" emissive="#659bff" emissiveIntensity={.18}
          roughness={.19} metalness={.66} clearcoat={1} flatShading/>
      </mesh>
      <mesh><icosahedronGeometry args={[3.92,0]}/>
        <meshBasicMaterial color="#d6f0ff" transparent opacity={.35} wireframe/>
      </mesh>
    </group>
  </group>;
}

function OrbitalCamera({ options, reset }: {options: ControlsOptions; reset: React.MutableRefObject<()=>void>}) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);
  const {camera,invalidate} = useThree();
  useEffect(()=>{reset.current=()=>{
    const s=options.getCamera?.()??DEFAULT_CAMERA;
    camera.position.set(...cameraPosition(s));
    controls.current?.target.set(s.target[0],s.target[1],s.target[2]);
    controls.current?.update();invalidate();
  };reset.current();},[camera,options,reset,invalidate]);
  const end=()=>{const c=controls.current;if(!c)return;
    options.onCamera?.({yaw:c.getAzimuthalAngle(),pitch:Math.PI/2-c.getPolarAngle(),
      distance:c.getDistance(),target:c.target.toArray()},true);
  };
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.075}
    minDistance={7} maxDistance={70} maxPolarAngle={Math.PI-.15} minPolarAngle={.15}
    enablePan enableZoom onEnd={end}/>;
}

function Scene({options,selected,onSelect,onOpen,reset}: {
  options:ControlsOptions; selected:string; onSelect:(id:string)=>void; onOpen:(id:string)=>void;
  reset:React.MutableRefObject<()=>void>;
}) {
  return <>
    <color attach="background" args={['#061126']}/>
    <fog attach="fog" args={['#061126',75,180]}/>
    <ambientLight intensity={.8}/>
    <directionalLight intensity={3.8} position={[-7,12,16]} color="#c2eaff"/>
    <pointLight intensity={65} position={[6,6,14]} color="#67a8ff" distance={38}/>
    <pointLight intensity={32} position={[8,-5,-10]} color="#b89bff" distance={34}/>
    <Stars radius={85} depth={90} count={options.hero?1700:2300} factor={3.5} saturation={0} fade speed={.15}/>
    <StarDust/>
    {options.hero ? <>
      <HeroObservatory/>
      <OrbitControls makeDefault enablePan={false} enableZoom={false} enableRotate={false}
        autoRotate autoRotateSpeed={.25}/>
    </> : <>
      <gridHelper args={[60,32,'#23486d','#14283c']} position={[5,-5.8,0]}/>
      {edges.map(([a,b])=>{const n1=byId.get(a)!,n2=byId.get(b)!;
        const p1=n1.p as [number,number,number],p2=n2.p as [number,number,number];
        const middle:[number,number,number]=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2+1.1,(p1[2]+p2[2])/2];
        const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(...p1),new THREE.Vector3(...middle),new THREE.Vector3(...p2));
        const linePoints=curve.getPoints(35).map(p=>p.toArray() as [number,number,number]);
        const active=(a===selected||b===selected);
        return <group key={a+'-'+b}>
          <Line points={linePoints} color={active?'#80dbff':'#476c99'} lineWidth={active?1.8:.8}
            transparent opacity={active?.72:.25}/>
          <SignalPulse points={linePoints} selected={active}/>
        </group>;
      })}
      {NODES.map(node=><CelestialNode key={node.id} node={node} selected={node.id===selected}
        onSelect={onSelect} onOpen={onOpen}/>)}
      <OrbitalCamera options={options} reset={reset}/>
    </>}
  </>;
}

function Cosmos({options,bridge}:{options:ControlsOptions;bridge:Bridge}) {
  const [selected,setSelected]=useState(bridge.pendingSelection);
  const [active,setActive]=useState(bridge.active);
  const reset=useRef<()=>void>(()=>{});
  useEffect(()=>{
    bridge.select=setSelected;bridge.setActive=setActive;bridge.resetCamera=()=>reset.current();
    setActive(bridge.active);setSelected(bridge.pendingSelection);
  },[bridge]);
  const camera = options.hero
    ? {yaw:-.52,pitch:.23,distance:12.8,target:[7.5,.2,0]}
    : options.getCamera?.()??DEFAULT_CAMERA;
  return <Canvas frameloop={active?'always':'never'} dpr={[1,1.7]}
    camera={{position:cameraPosition(camera),fov:52,near:.1,far:250}}
    gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}
    style={{width:'100%',height:'100%',touchAction:'none'}}>
    <Scene options={options} selected={selected}
      onSelect={id=>{setSelected(id);options.onSelect?.(id);}}
      onOpen={id=>options.onOpen?.(id)} reset={reset}/>
  </Canvas>;
}

export function createCosmos(element:HTMLElement,options:ControlsOptions={}) {
  const root:Root=createRoot(element);
  const bridge:Bridge={select:()=>{},resetCamera:()=>{},setActive:()=>{},active:false,pendingSelection:'duffing'};
  root.render(<Cosmos options={options} bridge={bridge}/>);
  return {
    start(){bridge.active=true;bridge.setActive(true);requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));},
    stop(){bridge.active=false;bridge.setActive(false);},
    select(id:string){bridge.pendingSelection=id;bridge.select(id);},
    resetCamera(){bridge.resetCamera();},
    render(){},reset(){bridge.select('duffing');bridge.resetCamera();},
    destroy(){root.unmount();},
  };
}
