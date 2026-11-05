/**
 * Study OS / Cosmic Atlas — dependency-free 3D projection fallback.
 * This renderer keeps persistent world coordinates, 3D camera orbit/zoom,
 * icosahedral facets, volumetric halos and 3D orbit curves. The production
 * frontend uses React Three Fiber; this is the light fallback (also testable
 * when a dependency registry is unavailable).
 */
export const NODES = [
 {id:'control',title:'Engenharia de Controle',kind:'disciplina',description:'A região-mãe das ideias, métodos e experimentos de controle.',domain:'ENGENHARIA',p:[-4,0,0],r:1.22,symbol:'◈',color:'#8ecafc',links:['identification']},
 {id:'identification',title:'Identificação de Sistemas',kind:'região',description:'Modelagem e identificação de sistemas dinâmicos a partir de dados.',domain:'CONTROLE',p:[1,0,0],r:1.02,symbol:'◇',color:'#68c5ef',links:['control','duffing','koopman','sindy','gaussian']},
 {id:'duffing',title:'Oscilador de Duffing',kind:'sistema',description:'Sistema não linear usado como referência em seus experimentos de identificação.',domain:'SISTEMAS DINÂMICOS',p:[6,0,0],r:1.40,symbol:'✧',color:'#f5cd89',links:['identification','koopman','sindy','hamiltonian','experiment']},
 {id:'koopman',title:'Operador de Koopman',kind:'método',description:'Representação linear em espaço aumentado para investigar dinâmicas não lineares.',domain:'MÉTODOS ORIENTADOS A DADOS',p:[10,3.2,1],r:.84,symbol:'◉',color:'#78baff',links:['duffing','experiment']},
 {id:'sindy',title:'SINDy',kind:'método',description:'Identificação esparsa de equações governantes e comparação com lifting.',domain:'MÉTODOS ORIENTADOS A DADOS',p:[10,-3,-2],r:.78,symbol:'✣',color:'#ab9dff',links:['duffing','experiment']},
 {id:'hamiltonian',title:'Port-Hamiltonian',kind:'método',description:'Estruturas energéticas e modelos com estados ocultos e perturbações.',domain:'MODELOS FÍSICOS',p:[7,4.6,-5],r:.82,symbol:'⬡',color:'#74dfc3',links:['duffing']},
 {id:'experiment',title:'Experimentos e Artefatos',kind:'bancada',description:'Código, parâmetros, figuras e notas vinculados à investigação do Duffing.',domain:'PESQUISA',p:[13,0,2],r:.78,symbol:'▤',color:'#dca6f8',links:['duffing','koopman','sindy']},
 {id:'gaussian',title:'Processos Gaussianos',kind:'conceito',description:'Estudos de incerteza, modelagem e referências para a pesquisa.',domain:'MATEMÁTICA APLICADA',p:[2,-4.5,-5],r:.73,symbol:'◌',color:'#87ebaf',links:['identification']},
];
const EDGES=[...new Set(NODES.flatMap(n=>n.links.map(t=>[n.id,t].sort().join('|'))))].map(s=>s.split('|'));
const lookup=new Map(NODES.map(n=>[n.id,n]));
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]), mul=(v,n)=>v.map(x=>x*n);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const golden=(1+Math.sqrt(5))/2;
const verts=[[-1,golden,0],[1,golden,0],[-1,-golden,0],[1,-golden,0],[0,-1,golden],[0,1,golden],[0,-1,-golden],[0,1,-golden],[golden,0,-1],[golden,0,1],[-golden,0,-1],[-golden,0,1]].map(norm);
const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function makeGalaxy(seed=31,count=1450){const r=rng(seed);return Array.from({length:count},(_,i)=>({p:[(r()-.5)*185,(r()-.5)*110,(r()-.5)*160],s:.3+r()*1.4,a:.16+r()*.66,v:r()*8,type:i%13===0}));}
const stars=makeGalaxy();
const dust=(()=>{const r=rng(62);return Array.from({length:850},(_,i)=>{const phi=r()*Math.PI*2;const rad=Math.pow(r(),.7)*15+2;return {p:[5+Math.cos(phi)*rad, (r()-.5)*8 + Math.cos(phi*3)*1.6, Math.sin(phi)*rad*.74], a:.08+r()*.23, s:.3+r()*1.2};});})();
function rgb(hex){const n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
function tint(hex,k,a=1){const c=rgb(hex).map(x=>clamp(Math.round(x*k),0,255));return `rgba(${c.join(',')},${a})`;}
function ellipse(ctx,x,y,rx,ry,color,stroke=1){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=stroke;ctx.stroke();}
function line(ctx,a,b,color,width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function shade(ctx,x,y,r,color,alpha=1){if(r<1)return;const g=ctx.createRadialGradient(x-r*.15,y-r*.22,0,x,y,r);g.addColorStop(0,tint(color,1.4,alpha*.24));g.addColorStop(.18,tint(color,1.1,alpha*.16));g.addColorStop(.6,tint(color,.7,alpha*.05));g.addColorStop(1,tint(color,1,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();}
export function createCosmos(canvas,{getCamera,onCamera,onSelect,onOpen,hero=false}={}){
 const ctx=canvas.getContext('2d',{alpha:false});
 const system={active:false,selected:'duffing',width:1,height:1,dpr:1,hit:[],time:0};
 let dragging=false,moved=false,last=null,suppressClick=false,wheelTimer=0;
 function size(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(devicePixelRatio||1,2);if(rect.width!==system.width||rect.height!==system.height||dpr!==system.dpr){system.width=rect.width;system.height=rect.height;system.dpr=dpr;canvas.width=Math.ceil(rect.width*dpr);canvas.height=Math.ceil(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}}
 function basis(cam){const ca=Math.cos(cam.pitch),sa=Math.sin(cam.pitch),sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);
  const pos=[cam.target[0]+cam.distance*sy*ca,cam.target[1]+cam.distance*sa,cam.target[2]+cam.distance*cy*ca];const forward=norm(sub(cam.target,pos)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
  return {pos,forward,right,up};}
 function project(p,cam,b){const v=sub(p,b.pos),depth=dot(v,b.forward);if(depth<.55)return null;const f=Math.min(system.width,system.height)*(hero?1.05:1.37);return {x:system.width*(hero?.535:.445)+dot(v,b.right)*f/depth,y:system.height*(hero?.51:.525)-dot(v,b.up)*f/depth,depth,scale:f/depth};}
 function worldCurve(points,c,b,color,width=1){ctx.beginPath();let count=0;for(const p of points){const q=project(p,c,b);if(!q)continue;if(!count++)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);}if(count<2)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 function arc3d(center,r,rotation,c,b,col,width=1,dash=false){const points=[];const sin=Math.sin(rotation),cos=Math.cos(rotation);
  for(let i=0;i<=140;i++){const a=i/140*Math.PI*2;points.push([center[0]+r*Math.cos(a)*cos,center[1]+r*Math.sin(a)*.82,center[2]+r*Math.cos(a)*sin]);}
  ctx.save();if(dash)ctx.setLineDash([3,9]);worldCurve(points,c,b,col,width);ctx.restore();}
 function poly(center,r,color,cam,b,time,selected=false){const trans=verts.map(v=>{const ay=time*.00012+center[0]*.19,ax=.15+Math.sin(time*.00015+center[2])*.24;
   const [x,y,z]=v;const rx=x*Math.cos(ay)-z*Math.sin(ay),rz=x*Math.sin(ay)+z*Math.cos(ay);const ry=y*Math.cos(ax)-rz*Math.sin(ax),rzz=y*Math.sin(ax)+rz*Math.cos(ax);return add(center,[rx*r,ry*r,rzz*r]);});
   const projected=trans.map(p=>project(p,cam,b));if(projected.some(v=>!v))return;
   const ordered=faces.map((f,index)=>{const p=f.map(i=>trans[i]);const normal=norm(cross(sub(p[1],p[0]),sub(p[2],p[0])));const centroid=mul(add(add(p[0],p[1]),p[2]),1/3);
     return {f,index,depth:dot(sub(centroid,b.pos),b.forward),brightness:Math.max(0,dot(normal,norm([-1,.9,1.8]))),front:dot(normal,sub(b.pos,centroid))>0};}).sort((a,b)=>b.depth-a.depth);
   for(const {f,index,brightness,front} of ordered){if(!front)continue;const a=projected[f[0]],bb=projected[f[1]],cc=projected[f[2]];
     ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(bb.x,bb.y);ctx.lineTo(cc.x,cc.y);ctx.closePath();ctx.fillStyle=tint(color,.21+brightness*.83,.92);ctx.fill();ctx.strokeStyle=tint(color,1.05,selected?.78:.5);ctx.lineWidth=.85;ctx.stroke();
     if(index%4===0){ctx.beginPath();ctx.moveTo((a.x+bb.x)/2,(a.y+bb.y)/2);ctx.lineTo(cc.x,cc.y);ctx.strokeStyle=tint(color,1.4,.22);ctx.stroke();}}
   const q=project(center,cam,b);if(q){const er=r*q.scale;shade(ctx,q.x,q.y,er*.67,color,.8);ctx.fillStyle=tint(color,2,.82);ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1,er*.05),0,7);ctx.fill();}
 }
 function background(w,h,c,b,t){ctx.fillStyle='#030a16';ctx.fillRect(0,0,w,h);
   let grad=ctx.createRadialGradient(w*.49,h*.43,0,w*.47,h*.53,Math.max(w,h)*.9);
   grad.addColorStop(0,'#11284c');grad.addColorStop(.36,'#071730');grad.addColorStop(.66,'#061122');grad.addColorStop(1,'#010612');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
   shade(ctx,w*.47,h*.38,w*.42,'#345bca',.4);shade(ctx,w*.72,h*.67,w*.38,'#17c9f9',.25);
   // Nebula particulate dust in world space gives orbital parallax.
   for(const d of dust){const p=project(d.p,c,b);if(!p||p.x<0||p.x>w||p.y<0||p.y>h)continue;ctx.fillStyle=`rgba(109,155,236,${d.a})`;ctx.fillRect(p.x,p.y,d.s,d.s);}
   for(const s of stars){const p=project(s.p,c,b);if(!p||p.x<0||p.x>w||p.y<0||p.y>h)continue;let tw=.78+.22*Math.sin(t*.001+s.v);const sz=Math.min(2.6,s.s*(100/Math.max(p.depth,27)));
     ctx.globalAlpha=s.a*tw;ctx.fillStyle=s.type?'#9fe9ff':'#b0c4f8';ctx.fillRect(p.x,p.y,sz,sz);}
   ctx.globalAlpha=1;
   // An illuminated orbital reference plane, defined in XYZ (not a screen-space grid).
   for(let i=-18;i<=23;i+=2){worldCurve([[i,-6,-19],[i,-6,19]],c,b,'rgba(69,142,213,.065)',.7);}
   for(let i=-20;i<=20;i+=2){worldCurve([[-19,-6,i],[26,-6,i]],c,b,'rgba(69,142,213,.065)',.7);}
 }
 function connection(a,b,c,cam,time){const p1=project(a.p,cam,c),p2=project(b.p,cam,c);if(!p1||!p2)return;
  const highlight=a.id===system.selected||b.id===system.selected;const mid=[(a.p[0]+b.p[0])/2,(a.p[1]+b.p[1])/2+1.1,(a.p[2]+b.p[2])/2];const pm=project(mid,cam,c);
  if(!pm)return;
  ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.quadraticCurveTo(pm.x,pm.y,p2.x,p2.y);ctx.strokeStyle=highlight?'rgba(112,196,255,.15)':'rgba(74,141,206,.08)';ctx.lineWidth=highlight?8:3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.quadraticCurveTo(pm.x,pm.y,p2.x,p2.y);ctx.strokeStyle=highlight?'rgba(133,221,255,.56)':'rgba(87,148,220,.19)';ctx.lineWidth=highlight?1.35:.85;ctx.stroke();
  if(highlight){const u=((time*.000125+a.p[0])%1+1)%1;const x=(1-u)*(1-u)*p1.x+2*(1-u)*u*pm.x+u*u*p2.x;const y=(1-u)*(1-u)*p1.y+2*(1-u)*u*pm.y+u*u*p2.y;shade(ctx,x,y,15,'#92e0ff',1.5);ctx.fillStyle='#dff9ff';ctx.beginPath();ctx.arc(x,y,2.1,0,7);ctx.fill();}
 }
 function node(n,c,b,t,heroNode=false){const p=project(n.p,c,b);if(!p)return;const selected=n.id===system.selected;const r=clamp(n.r*p.scale*(hero?.81:.88),hero?12:13,hero?75:92);
  // Atmospheric volume, photonic corona and volumetric nested shells.
  shade(ctx,p.x,p.y,r*4.4,n.color,hero?.76:1.1);
  shade(ctx,p.x,p.y,r*2.2,n.color,.9);
  for(let i=3;i>=1;i--)ellipse(ctx,p.x,p.y,r*(1+i*.43),r*(1+i*.43)*.79,tint(n.color,1.1,(selected?.25:.09)/i),.7);
  arc3d(n.p,n.r*(selected?2.16:1.82),.64,c,b,tint(n.color,1,selected?.76:.35),selected?1.8:1.15);
  arc3d(n.p,n.r*(selected?2.15:1.8),-1.15,c,b,tint(n.color,1.1,selected?.45:.21),.9,true);
  arc3d(n.p,n.r*(selected?1.55:1.34),1.35,c,b,tint(n.color,1.2,.36),.8);
  poly(n.p,n.r*(hero?1.3:1.25),n.color,c,b,t,selected);
  if(selected&&!hero){const tick=r*2.45;ctx.strokeStyle='rgba(241,212,148,.88)';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(p.x,p.y,tick,-.48,.33);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,tick,2.65,3.6);ctx.stroke();}
  if(!hero){const labelY=p.y+r*1.85+14;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`${selected?'700 12':'600 10'}px Inter,Segoe UI,sans-serif`;
    const w=clamp(ctx.measureText(n.title).width+26,54,255);const x=p.x-w/2;
    ctx.fillStyle=selected?'rgba(12,27,48,.90)':'rgba(9,22,39,.73)';ctx.strokeStyle=tint(n.color,1,selected?.48:.17);
    ctx.beginPath();ctx.roundRect(x,labelY-13,w,26,6);ctx.fill();ctx.stroke();ctx.fillStyle=selected?'#f5f7ff':'#b8cee5';ctx.fillText(n.title,p.x,labelY+.4);
    if(selected){ctx.font='9px Consolas,monospace';ctx.fillStyle='rgba(239,207,144,.85)';ctx.fillText('ATIVO / CLICK TO OPEN',p.x,labelY+29);}
    system.hit.push({id:n.id,x:p.x,y:p.y,r:Math.max(23,r*1.18)});
  }
 }
 function heroDisplay(c,b,t){const center=[7.7,.2,0];const core={p:center,r:2.5,color:'#9ccfff',id:'holo'};
  // A scientific observatory apparatus: three 3D great-circle rings and a rotating polyhedron.
  shade(ctx,system.width*.59,system.height*.46,system.width*.35,'#4f7cf8',.68);
  for(const [scale,rotation,color] of [[5.20,.28,'#7aaaff'],[4.67,1.3,'#77e8f5'],[3.95,-.92,'#f2cd95']])arc3d(center,scale,rotation,c,b,tint(color,1,.56),1.55);
  const outer=project(center,c,b);if(outer){for(let i=0;i<8;i++){const a=i*Math.PI/4+t*.00012;const point=[center[0]+Math.cos(a)*5.6,center[1]+Math.sin(a)*2.4,center[2]+Math.sin(a)*4.9];const q=project(point,c,b);if(!q)continue;shade(ctx,q.x,q.y,13,'#90d6ff',.7);ctx.fillStyle='#c7efff';ctx.beginPath();ctx.arc(q.x,q.y,i%3===0?2.1:1.2,0,7);ctx.fill();}}
  poly(center,3.90,'#90d3ff',c,b,t,true);
  if(outer){const r=86;shade(ctx,outer.x,outer.y,r*3,'#6abfff',.6);
    ctx.textAlign='left';ctx.fillStyle='rgba(154,214,255,.60)';ctx.font='10px Consolas,monospace';ctx.fillText('CORE / KNOWLEDGE ENGINE',outer.x+106,outer.y+102);
    ctx.strokeStyle='rgba(118,180,241,.35)';ctx.beginPath();ctx.moveTo(outer.x+60,outer.y+61);ctx.lineTo(outer.x+94,outer.y+100);ctx.lineTo(outer.x+245,outer.y+100);ctx.stroke();}
 }
 function render(time=0){if(!system.active)return;size();const w=system.width,h=system.height;
  const cam=hero?{yaw:-.53+Math.sin(time*.00005)*.12,pitch:.23,distance:12.8,target:[7.5,.2,0]}:(getCamera?.()||{yaw:-.42,pitch:.16,distance:18,target:[5,0,0]});
  const b=basis(cam);background(w,h,cam,b,time);
  if(hero){heroDisplay(cam,b,time);const veil=ctx.createLinearGradient(0,0,w,0);veil.addColorStop(0,'rgba(3,10,23,.98)');veil.addColorStop(.31,'rgba(3,10,23,.91)');veil.addColorStop(.48,'rgba(3,10,23,.28)');veil.addColorStop(.90,'rgba(3,10,23,0)');veil.addColorStop(1,'rgba(3,10,23,.25)');ctx.fillStyle=veil;ctx.fillRect(0,0,w,h);return;}
  // A gentle elevation plane anchors scientific regions spatially.
  for(let radius of [4,8,13,18])arc3d([5,-6,0],radius,0,cam,b,'rgba(73,169,233,.055)',.85,true);
  for(const [a,bb] of EDGES){const from=lookup.get(a),to=lookup.get(bb);if(from&&to)connection(from,to,b,cam,time);}
  system.hit=[];
  const ordered=NODES.map(n=>({n,pt:project(n.p,cam,b)})).filter(x=>x.pt).sort((a,bb)=>bb.pt.depth-a.pt.depth);
  for(const {n} of ordered)node(n,cam,b,time);
  // Cinematic scope reticle: shows position without competing with the content.
  ctx.strokeStyle='rgba(124,195,246,.18)';ctx.lineWidth=.9;let x=w*.444,y=h*.52;
  ctx.beginPath();ctx.arc(x,y,Math.min(w,h)*.28,-2.1,-.55);ctx.stroke();ctx.beginPath();ctx.arc(x,y,Math.min(w,h)*.28,.85,1.85);ctx.stroke();
  ctx.fillStyle='rgba(139,184,224,.57)';ctx.font='10px Consolas,monospace';ctx.fillText('3D CARTOGRAPHY  •  WORLDSPACE PERSISTENT',24,h-20);
 }
 function loop(t){if(!system.active)return;render(t);requestAnimationFrame(loop);}
 function down(e){if(hero)return;dragging=true;moved=false;last=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);}
 function move(e){if(hero||!dragging)return;const dx=e.clientX-last[0],dy=e.clientY-last[1];if(Math.abs(dx)+Math.abs(dy)>1)moved=true;last=[e.clientX,e.clientY];const c=structuredClone(getCamera());c.yaw-=dx*.006;c.pitch=clamp(c.pitch+dy*.006,-1.25,1.25);onCamera?.(c,false);}
 function up(){if(hero)return;dragging=false;onCamera?.(getCamera(),true);if(moved){suppressClick=true;setTimeout(()=>suppressClick=false,100);}}
 function click(e){if(hero||suppressClick)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const chosen=[...system.hit].reverse().find(n=>Math.hypot(n.x-x,n.y-y)<n.r);if(chosen){system.selected=chosen.id;onSelect?.(chosen.id);}}
 function dblclick(e){if(hero)return;click(e);onOpen?.(system.selected);}
 function wheel(e){if(hero)return;e.preventDefault();const c=structuredClone(getCamera());c.distance=clamp(c.distance*Math.exp(e.deltaY*.001),7,70);onCamera?.(c,false);clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>onCamera?.(getCamera(),true),350);}
 if(!hero){canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('click',click);canvas.addEventListener('dblclick',dblclick);canvas.addEventListener('wheel',wheel,{passive:false});}
 return {start(){if(system.active)return;system.active=true;requestAnimationFrame(loop);},stop(){system.active=false;},select(id){system.selected=id;},render,reset(){system.selected='duffing';}};
}
