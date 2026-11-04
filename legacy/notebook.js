// One-document infinite canvas, vector ink & local-first LAN replication.
// Input never waits for a network or storage roundtrip.
const DB_NAME='studyos-local-ink-v1';
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('pending',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function tx(db,mode,method,arg){return new Promise((resolve,reject)=>{const t=db.transaction('pending',mode),s=t.objectStore('pending'),r=method==='all'?s.getAll():s[method](arg);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uid=()=>crypto.randomUUID().replaceAll('-','');

export function createNotebook({ canvas,container,onStatus,getToken,serverElements=[] }) {
  const ctx=canvas.getContext('2d');let db=null,ws=null,connected=false,closed=false,attempt=0;
  const elements=new Map(serverElements.map(e=>[e.id,e]));
  const pending=new Map(),previews=new Map(),pointerPositions=new Map();
  const viewport=JSON.parse(localStorage.getItem('studyos-viewport')||'{"x":0,"y":0,"scale":1}');
  let width=800,height=600,dpr=1,tool='pen',color='#d9e9ff',pen=false,stroke=null,panPointer=null,last=null,pinchDistance=0,dirty=true,livePoints=[],toastAt=0;
  let flushTimer=null;
  const persistViewport=()=>{localStorage.setItem('studyos-viewport',JSON.stringify(viewport));document.querySelector('#ink-zoom').textContent=Math.round(viewport.scale*100)+'%';};
  function resize(){const r=container.getBoundingClientRect();if(r.width<10||r.height<10)return;const ratio=Math.min(devicePixelRatio||1,2);if(r.width!==width||r.height!==height||ratio!==dpr){width=r.width;height=r.height;dpr=ratio;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);dirty=true;}}
  const toWorld=(x,y)=>[(x-width/2)/viewport.scale+viewport.x,(y-height/2)/viewport.scale+viewport.y];
  const toScreen=(x,y)=>[(x-viewport.x)*viewport.scale+width/2,(y-viewport.y)*viewport.scale+height/2];
  function eventLocal(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
  function drawPath(s,transient=false){const pts=s.points;if(pts?.length<2)return;ctx.strokeStyle=s.color||color;ctx.lineCap='round';ctx.lineJoin='round';for(let j=1;j<pts.length;j++){
      const a=pts[j-1],b=pts[j];const p=toScreen(a[0],a[1]),q=toScreen(b[0],b[1]);
      if(Math.max(p[0],q[0])<-20||Math.min(p[0],q[0])>width+20||Math.max(p[1],q[1])<-20||Math.min(p[1],q[1])>height+20)continue;
      ctx.lineWidth=Math.max(.7,(s.width||2.2)*viewport.scale*(.45+(.5*((a[2]??.7)+(b[2]??.7))/2)));
      ctx.globalAlpha=transient?.65:1;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.globalAlpha=1;
    }}
  function render(){resize();if(!dirty)return;dirty=false;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#091321';ctx.fillRect(0,0,width,height);
    const gridStep=80,sm=gridStep*viewport.scale;
    if(sm>12){let left=toWorld(0,0)[0],right=toWorld(width,0)[0],top=toWorld(0,0)[1],bottom=toWorld(0,height)[1];ctx.lineWidth=1;
      for(let gx=Math.floor(left/gridStep);gx<=Math.ceil(right/gridStep);gx++){let x=toScreen(gx*gridStep,0)[0];ctx.strokeStyle=gx%5===0?'#42607b3b':'#3e587524';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
      for(let gy=Math.floor(top/gridStep);gy<=Math.ceil(bottom/gridStep);gy++){let y=toScreen(0,gy*gridStep)[1];ctx.strokeStyle=gy%5===0?'#42607b3b':'#3e587524';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}}
    ctx.save();ctx.strokeStyle='#86d7ff44';ctx.lineWidth=1;const origin=toScreen(0,0);ctx.beginPath();ctx.moveTo(origin[0]-8,origin[1]);ctx.lineTo(origin[0]+8,origin[1]);ctx.moveTo(origin[0],origin[1]-8);ctx.lineTo(origin[0],origin[1]+8);ctx.stroke();ctx.restore();
    for(const e of elements.values()){if(e.type==='stroke')drawPath(e);else if(e.type==='text'){const p=toScreen(e.x,e.y);ctx.font=`${Math.max(8,16*viewport.scale)}px "Segoe UI",sans-serif`;ctx.fillStyle='#dbefff';e.text.split('\n').slice(0,30).forEach((line,i)=>ctx.fillText(line,p[0],p[1]+i*22*viewport.scale));}}
    for(const e of previews.values())drawPath(e,true);
    if(stroke)drawPath(stroke);
    document.querySelector('#ink-location').textContent=`${Math.round(viewport.x)} · ${Math.round(viewport.y)}`;
  }
  function loop(){if(closed)return;render();requestAnimationFrame(loop);}requestAnimationFrame(loop);
  function redraw(){dirty=true;}
  async function remember(e){pending.set(e.id,e);try{if(db)await tx(db,'readwrite','put',e);else localStorage.setItem('studyos-fallback-pending',JSON.stringify([...pending.values()]));}catch{onStatus?.('Problema ao salvar no dispositivo · mantenha esta aba aberta',false);}sendPending();}
  async function forget(id){pending.delete(id);try{if(db)await tx(db,'readwrite','delete',id);else localStorage.setItem('studyos-fallback-pending',JSON.stringify([...pending.values()]));}catch{}}
  function sendPending(){if(!connected||ws?.readyState!==WebSocket.OPEN)return;for(const e of pending.values())ws.send(JSON.stringify({type:'element.add',element:e}));}
  async function initialPending(){try{db=await openDB();const items=await tx(db,'readonly','all');for(const e of items){pending.set(e.id,e);elements.set(e.id,e);}}catch{for(const e of JSON.parse(localStorage.getItem('studyos-fallback-pending')||'[]')){pending.set(e.id,e);elements.set(e.id,e);}onStatus?.('Salvamento temporário reduzido neste navegador',false);}redraw();connect();}
  function connect(){if(closed)return;const protocol=location.protocol==='https:'?'wss:':'ws:';const token=getToken();const url=protocol+'//'+location.host+'/ws'+(token?'?token='+encodeURIComponent(token):'');
    try{ws=new WebSocket(url);}catch{onStatus?.('Sem rede · escrita local ativa',false);retry();return;}
    ws.onopen=()=>{connected=true;attempt=0;onStatus?.('Caderno sincronizado',true);};
    ws.onmessage=async ev=>{let m;try{m=JSON.parse(ev.data);}catch{return;}
      if(m.type==='hello')sendPending();
      if(m.type==='element.ack')await forget(m.id);
      if(m.type==='element.add'&&m.element?.id){elements.set(m.element.id,m.element);previews.delete(m.element.id);redraw();}
      if(m.type==='stroke.preview'&&m.id){if(!previews.has(m.id)||m.phase==='begin')previews.set(m.id,{id:m.id,type:'stroke',points:[],color:m.color,width:m.width});const p=previews.get(m.id);if(m.color)p.color=m.color;if(m.width)p.width=m.width;if(Array.isArray(m.points))p.points.push(...m.points.slice(0,128));if(p.points.length>30000)previews.delete(m.id);redraw();}
      if(m.type==='error')onStatus?.(m.message,false);
    };
    ws.onclose=()=>{connected=false;previews.clear();onStatus?.('Sem conexão · escrita continua localmente',false);retry();};
    ws.onerror=()=>{};
  }
  function retry(){if(closed)return;const delay=Math.min(10000,700*2**Math.min(attempt++,5));setTimeout(connect,delay);}
  function preview(phase='points'){if(!connected||!stroke||ws.readyState!==WebSocket.OPEN)return;const points=livePoints.splice(0,120);if(points.length||phase==='begin')ws.send(JSON.stringify({type:'stroke.preview',id:stroke.id,color:stroke.color,width:stroke.width,points,phase}));}
  async function finishStroke(){if(!stroke)return;const item=stroke;stroke=null;pen=false;livePoints=[];if(item.points.length<2){item.points.push([...item.points[0]]);}elements.set(item.id,item);redraw();await remember(item);}
  function appendPoint(e){if(!stroke)return;const [sx,sy]=eventLocal(e),point=[...toWorld(sx,sy),e.pressure>0?clamp(e.pressure,.05,1):.7];const arr=stroke.points;const prev=arr.at(-1);if(!prev||Math.hypot(point[0]-prev[0],point[1]-prev[1])>.35){arr.push(point);livePoints.push(point);redraw();if(livePoints.length>8)preview();}}
  function panMove(x,y){if(!last)return;viewport.x-=(x-last[0])/viewport.scale;viewport.y-=(y-last[1])/viewport.scale;last=[x,y];persistViewport();redraw();}
  function setZoom(next,sx=width/2,sy=height/2){const old=toWorld(sx,sy);viewport.scale=clamp(next,.15,4);viewport.x=old[0]-(sx-width/2)/viewport.scale;viewport.y=old[1]-(sy-height/2)/viewport.scale;persistViewport();redraw();}
  let pointers=new Map();
  function down(e){if(e.pointerType==='touch'&&pen)return;canvas.setPointerCapture(e.pointerId);const [x,y]=eventLocal(e);pointers.set(e.pointerId,[x,y]);
    if(e.pointerType==='touch'){if(pointers.size===2)pinchDistance=0;panPointer=e.pointerId;last=[x,y];return;}
    if(tool==='text'){addTextAt(x,y);return;}
    if(tool==='pan'||e.button===1||e.buttons===4||e.shiftKey){panPointer=e.pointerId;last=[x,y];return;}
    if(e.button!==0)return;pen=true;stroke={id:uid(),type:'stroke',color,width:2.8,points:[]};appendPoint(e);preview('begin');
  }
  function move(e){if(!pointers.has(e.pointerId))return;const [x,y]=eventLocal(e);pointers.set(e.pointerId,[x,y]);
    if(e.pointerType==='touch'&&pointers.size>=2){const pp=[...pointers.values()];const dist=Math.hypot(pp[0][0]-pp[1][0],pp[0][1]-pp[1][1]);if(pinchDistance>1)setZoom(viewport.scale*(dist/pinchDistance),(pp[0][0]+pp[1][0])/2,(pp[0][1]+pp[1][1])/2);pinchDistance=dist;last=[x,y];return;}
    if(panPointer===e.pointerId){panMove(x,y);return;}
    if(stroke){for(const part of (e.getCoalescedEvents?.() || [e]))appendPoint(part);preview();}
  }
  function up(e){pointers.delete(e.pointerId);if(e.pointerId===panPointer){panPointer=null;last=null;pinchDistance=0;}if(stroke&&e.pointerType!=='touch'){appendPoint(e);preview();finishStroke();}}
  function addTextAt(x,y){const pos=toWorld(x,y),ta=document.createElement('textarea');ta.className='ink-text-editor';ta.placeholder='Escreva aqui · Ctrl+Enter para salvar';Object.assign(ta.style,{position:'absolute',left:x+'px',top:y+'px',width:'260px',height:'95px',zIndex:4,background:'#14253a',border:'1px solid #74bce5',borderRadius:'7px',padding:'10px',color:'#e8f5ff',resize:'both'});container.appendChild(ta);ta.focus();let saved=false;async function save(){if(saved)return;saved=true;const text=ta.value.trim();ta.remove();if(text){const e={id:uid(),type:'text',text,x:pos[0],y:pos[1]};elements.set(e.id,e);redraw();await remember(e);}}ta.addEventListener('keydown',e=>{if(e.key==='Escape'){saved=true;ta.remove();}if(e.key==='Enter'&&e.ctrlKey)save();});ta.addEventListener('blur',save);}
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',e=>{e.preventDefault();const p=eventLocal(e);if(e.ctrlKey||e.metaKey)setZoom(viewport.scale*Math.exp(-e.deltaY*.008),...p);else setZoom(viewport.scale*Math.exp(-e.deltaY*.0015),...p);},{passive:false});
  const observer=new ResizeObserver(()=>redraw());observer.observe(container);
  initialPending();persistViewport();
  return {
    setTool(t){tool=t;canvas.style.cursor=t==='pan'?'grab':t==='text'?'text':'crosshair';},
    setColor(c){color=c;},
    center(){viewport.x=0;viewport.y=0;viewport.scale=1;persistViewport();redraw();},
    zoom(f){setZoom(viewport.scale*f);},
    ingest(e){if(!elements.has(e.id)){elements.set(e.id,e);redraw();}},
    stop(){closed=true;ws?.close();observer.disconnect();},
    stats(){return{saved:elements.size,pending:pending.size,connected};}
  };
}
