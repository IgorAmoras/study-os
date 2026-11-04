// Study OS spatial renderer. Actual 3D coordinates and an orbital perspective camera;
// Canvas 2D is used only as a lightweight projection backend (no GPU package required).
export const NODES = [
  { id:'control',title:'Engenharia de Controle',kind:'disciplina',description:'A região-mãe das ideias, métodos e experimentos de controle.',domain:'ENGENHARIA',p:[-4,0,0],r:1.25,symbol:'◈',color:'#b3dfff',links:['identification'] },
  { id:'identification',title:'Identificação de Sistemas',kind:'região',description:'Modelagem e identificação de sistemas dinâmicos a partir de dados.',domain:'CONTROLE',p:[1,0,0],r:1.0,symbol:'◇',color:'#a9d4ff',links:['control','duffing','koopman','sindy'] },
  { id:'duffing',title:'Oscilador de Duffing',kind:'sistema',description:'Sistema não linear usado como referência em seus experimentos de identificação.',domain:'SISTEMAS DINÂMICOS',p:[6,0,0],r:1.12,symbol:'✧',color:'#e9cb8d',links:['identification','koopman','sindy','hamiltonian','experiment'] },
  { id:'koopman',title:'Operador de Koopman',kind:'método',description:'Representação linear em espaço aumentado para investigar dinâmicas não lineares.',domain:'MÉTODOS ORIENTADOS A DADOS',p:[10,3.2,1],r:.7,symbol:'◉',color:'#84c8ff',links:['duffing','experiment'] },
  { id:'sindy',title:'SINDy',kind:'método',description:'Identificação esparsa de equações governantes e comparação com lifting.',domain:'MÉTODOS ORIENTADOS A DADOS',p:[10,-3,-2],r:.66,symbol:'✣',color:'#a7b1ff',links:['duffing','experiment'] },
  { id:'hamiltonian',title:'Port-Hamiltonian',kind:'método',description:'Estruturas energéticas e modelos com estados ocultos e perturbações.',domain:'MODELOS FÍSICOS',p:[7,4.6,-5],r:.64,symbol:'⬡',color:'#a0e1ca',links:['duffing'] },
  { id:'experiment',title:'Experimentos e Artefatos',kind:'bancada',description:'Código, parâmetros, figuras e notas vinculados à investigação do Duffing.',domain:'PESQUISA',p:[13,0,2],r:.72,symbol:'▤',color:'#d9abf5',links:['duffing','koopman','sindy'] },
  { id:'gaussian',title:'Processos Gaussianos',kind:'conceito',description:'Estudos de incerteza, modelagem e referências para a pesquisa.',domain:'MATEMÁTICA APLICADA',p:[2,-4.5,-5],r:.65,symbol:'◌',color:'#b5efc0',links:['identification'] },
];
const EDGES = [...new Set(NODES.flatMap(n=>n.links.map(t=>[n.id,t].sort().join('|'))))].map(s=>s.split('|'));
const norm = v => {const l=Math.hypot(...v)||1;return v.map(a=>a/l)};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}};
export function makeGalaxy(seed=13,count=440) {const rand=rng(seed);return Array.from({length:count},()=>({p:[(rand()-.5)*160,(rand()-.5)*110,(rand()-.5)*170],r:rand()*1.2+.15,a:.2+rand()*.7,t:rand()*7}));}
const stars=makeGalaxy();

export function createCosmos(canvas,{getCamera,onCamera,onSelect,onOpen,hero=false}={}) {
  const ctx=canvas.getContext('2d',{alpha:false});
  const system={active:false,selected:'duffing',width:1,height:1,dpr:1,hit:[],frame:0};
  let dragging=false,last=null,moved=false,suppressClick=false;
  function size(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(devicePixelRatio||1,2);if(rect.width!==system.width||rect.height!==system.height||dpr!==system.dpr){system.width=rect.width;system.height=rect.height;system.dpr=dpr;canvas.width=Math.ceil(rect.width*dpr);canvas.height=Math.ceil(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}}
  function camBasis(c){const co=Math.cos(c.pitch),s=Math.sin(c.yaw),y=Math.sin(c.pitch),z=Math.cos(c.yaw)*co;
    const pos=[c.target[0]+c.distance*s*co,c.target[1]+c.distance*y,c.target[2]+c.distance*z];
    const forward=norm(sub(c.target,pos)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
    return {pos,forward,right,up};}
  function project(p,c,b){const v=sub(p,b.pos),depth=dot(v,b.forward);if(depth<=.5)return null;const f=Math.min(system.width,system.height)*1.13;return {x:system.width*.5+dot(v,b.right)*f/depth,y:system.height*.5-dot(v,b.up)*f/depth,depth,scale:f/depth};}
  function render(time=0) {
    if(!system.active) return;
    size(); const w=system.width,h=system.height;
    const c=getCamera?.()||{yaw:-.42,pitch:.16,distance:18,target:[5,0,0]}; const basis=camBasis(c);
    ctx.fillStyle='#061021';ctx.fillRect(0,0,w,h);
    let neb=ctx.createRadialGradient(w*.52,h*.53,20,w*.5,h*.5,Math.max(w,h)*.8);
    neb.addColorStop(0,'#203e6155');neb.addColorStop(.45,'#10254655');neb.addColorStop(1,'#020715');ctx.fillStyle=neb;ctx.fillRect(0,0,w,h);
    const st=hero?stars.slice(0,230):stars;
    for(const s of st){const pos=project(s.p,c,basis);if(!pos||pos.x<0||pos.y<0||pos.x>w||pos.y>h)continue;
      const twinkle=hero?1:.89+.11*Math.sin(time*.001+s.t);ctx.globalAlpha=Math.min(1,s.a*twinkle);ctx.fillStyle=pos.depth<50?'#b2d6ff':'#7199cc';const r=Math.min(2,s.r*(70/Math.max(pos.depth,20)));ctx.fillRect(pos.x,pos.y,r,r);
    }
    ctx.globalAlpha=1;
    const center=project([3,0,0],c,basis);if(center){const g=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,250);g.addColorStop(0,'#38587718');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(center.x-250,center.y-250,500,500);}
    for(const [ai,bi] of EDGES){const a=NODES.find(n=>n.id===ai),b=NODES.find(n=>n.id===bi);const p1=project(a.p,c,basis),p2=project(b.p,c,basis);if(!p1||!p2)continue;
      ctx.strokeStyle=ai===system.selected||bi===system.selected?'#8dcae17a':'#5778a43a';ctx.lineWidth=ai===system.selected||bi===system.selected?1.3:.9;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
      for(let j=1;j<4;j++){const t=j/4,x=p1.x+(p2.x-p1.x)*t,y=p1.y+(p2.y-p1.y)*t;ctx.fillStyle='#85bdce77';ctx.fillRect(x-1,y-1,2,2);}
    }
    system.hit=[];
    const nodes=NODES.map(n=>({n,p:project(n.p,c,basis)})).filter(n=>n.p).sort((a,b)=>b.p.depth-a.p.depth);
    for(const {n,p} of nodes){const selected=!hero&&n.id===system.selected,r=Math.max(7,Math.min(42,n.r*p.scale*.16));
      const halo=ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,r*5.1);halo.addColorStop(0,n.color+'8a');halo.addColorStop(.22,n.color+'2a');halo.addColorStop(1,n.color+'00');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,p.y,r*5.1,0,Math.PI*2);ctx.fill();
      const orb=selected?2.6:1.95;ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,.39);ctx.rotate(-.33);ctx.strokeStyle=selected?'#f6dcaa9c':n.color+'65';ctx.lineWidth=selected?2:1;ctx.beginPath();ctx.arc(0,0,r*orb,0,Math.PI*2);ctx.stroke();ctx.restore();
      let fill=ctx.createRadialGradient(p.x-r*.35,p.y-r*.47,0,p.x,p.y,r*1.4);fill.addColorStop(0,'#fbfdff');fill.addColorStop(.26,n.color);fill.addColorStop(.77,'#183854');fill.addColorStop(1,'#081b32');ctx.fillStyle=fill;ctx.beginPath();ctx.arc(p.x,p.y,r,0,2*Math.PI);ctx.fill();ctx.strokeStyle=n.color;ctx.globalAlpha=.7;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;
      if(!hero){ctx.font=`${selected?600:500} ${selected?12:10}px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.fillStyle=selected?'#e6f7ff':'#a2b6cd';ctx.fillText(n.title,p.x,p.y+r+19);if(selected){ctx.strokeStyle='#c9e7ff9b';ctx.beginPath();ctx.arc(p.x,p.y,r*2.55,0,Math.PI*2);ctx.stroke();}}
      system.hit.push({id:n.id,x:p.x,y:p.y,r:Math.max(r*1.5,21)});
    }
    if(hero){const vig=ctx.createLinearGradient(0,0,w,0);vig.addColorStop(0,'#081526');vig.addColorStop(.3,'#081526a8');vig.addColorStop(.8,'#08152600');vig.addColorStop(1,'#08152670');ctx.fillStyle=vig;ctx.fillRect(0,0,w,h);}
    else {ctx.fillStyle='#98c9e866';ctx.font='9px Consolas,monospace';ctx.fillText('KNOWLEDGE SPACE · STABLE COORDINATES',w/2,h-19);}
  }
  function loop(t){if(!system.active)return; if(!hero || system.frame++%2===0)render(t);requestAnimationFrame(loop);}
  function onPointerDown(e){if(hero)return;dragging=true;moved=false;last=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);}
  function onPointerMove(e){if(hero||!dragging)return;const dx=e.clientX-last[0],dy=e.clientY-last[1];if(Math.abs(dx)+Math.abs(dy)>1)moved=true;last=[e.clientX,e.clientY];const c=structuredClone(getCamera());c.yaw-=dx*.006;c.pitch=Math.max(-1.25,Math.min(1.25,c.pitch+dy*.006));onCamera?.(c,false);}
  function onPointerUp(e){if(hero)return;dragging=false;const c=getCamera();onCamera?.(c,true);if(moved){suppressClick=true;setTimeout(()=>suppressClick=false,70);}}
  function onClick(e){if(hero||suppressClick)return;const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const n=[...system.hit].reverse().find(h=>Math.hypot(h.x-x,h.y-y)<h.r);if(n){system.selected=n.id;onSelect?.(n.id);}}
  function onWheel(e){if(hero)return;e.preventDefault();const c=structuredClone(getCamera());c.distance=Math.max(5,Math.min(70,c.distance*Math.exp(e.deltaY*.001)));onCamera?.(c,false);if(wheelTimer)clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>onCamera?.(getCamera(),true),300);}
  let wheelTimer=null;
  function onDblClick(e){if(hero)return;onClick(e);onOpen?.(system.selected);}
  if(!hero){canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('click',onClick);canvas.addEventListener('dblclick',onDblClick);canvas.addEventListener('wheel',onWheel,{passive:false});}
  return {start(){if(system.active)return;system.active=true;requestAnimationFrame(loop);},stop(){system.active=false;},select(id){system.selected=id;},render,reset(){system.selected='duffing';}};
}
