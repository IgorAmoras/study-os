import { NODES } from './nodes.js';
import './styles.css';
import { createNotebook } from './notebook.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const REPO='https://github.com/IgorAmoras/data-driven-dynamics-and-control';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repoFile=p=>REPO+'/blob/main/'+p.split('/').map(encodeURIComponent).join('/');
const LABELS={home:'Central de Projetos',universe:'Universo',workspace:'Bancada',notebook:'Super Caderno'};
const FILES={
  duffing:'systems/duffing_oscillator/classic_koopman.py',
  koopman:'systems/duffing_oscillator/classic_koopman.py',
  sindy:'systems/duffing_oscillator/SINDy.py',
  hamiltonian:'systems/duffing_oscillator/port_hamiltonian_duffing_hidden_state.py',
  experiment:'systems/duffing_oscillator/port_hamiltonian_noise_analysis.md',
  gaussian:'meeting_notes/2026-10-19_reuniao_luciano.md',
  identification:'research_memorandum.ipynb',
  control:'research_memorandum.ipynb',
};
const current={view:'home',state:null,project:null,notebook:null,cosmos:null,hero:null,z:5};
const defaultCamera={yaw:-.42,pitch:.16,distance:25,target:[5,0,0]};
const token=()=>sessionStorage.getItem('studyos-token')||'';
function flash(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(flash.timer);flash.timer=setTimeout(()=>t.classList.remove('show'),3200);}
function setConnection(label,online){$('#connection-label').textContent=label;$('#health-dot').className='health-dot '+(online?'online':'offline');}
async function api(url,opts={}){const headers={'X-StudyOS-Token':token(),...opts.headers};if(opts.body && !headers['Content-Type'])headers['Content-Type']='application/json';const r=await fetch(url,{...opts,headers});if(r.status===401){$('#pair-dialog').classList.remove('hidden');throw new Error('Token necessário');}if(!r.ok){const message=await r.json().catch(()=>({error:r.statusText}));throw Error(message.error||r.statusText);}return r;}
async function patch(patch){const prev=structuredClone(current.state);current.state={...current.state,...patch};try{const r=await api('/api/state',{method:'PATCH',body:JSON.stringify(patch)});current.state=(await r.json()).state;return true;}catch(err){current.state=prev;flash('Não foi possível salvar: '+err.message);return false;}}
function setView(view){if(!LABELS[view])return;current.view=view;$$('.view').forEach(el=>el.classList.toggle('visible',el.id==='view-'+view));$$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));$('#breadcrumb-current').textContent=LABELS[view];
  const u=view==='universe',h=view==='home';if(u)current.cosmos?.start();else current.cosmos?.stop();if(h)current.hero?.start();else current.hero?.stop();
  if(view==='workspace')renderPanels();if(view==='notebook')current.notebook?.center && updateInkStatus();
  if(view==='universe')refreshDetails();
  if(view==='home')renderHome();
  location.hash=view==='home'?'':view;
}
function renderHome(){const s=current.state;if(!s)return;const focus=s.tasks.find(t=>t.id===s.focus)||s.tasks[0];$('#focus-title').textContent=focus.title;$('#focus-note').textContent=focus.note;$('#focus-stage').textContent=focus.stage.toUpperCase();$('#checkpoint-description').textContent=s.checkpoint.text||'Sua bancada e as referências permanecem no lugar.';$('#checkpoint-time').textContent=s.checkpoint.updatedAt?'SALVO '+new Date(s.checkpoint.updatedAt).toLocaleDateString('pt-BR'):'SALVAMENTO AUTOMÁTICO';$('#repo-status').textContent=current.project.connected?'REPOSITÓRIO LOCAL CONECTADO':'GITHUB · VINCULAÇÃO LOCAL PENDENTE';}
function setupNav(){$$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));$('#project-nav').onclick=$('#project-open').onclick=$('#projects-show').onclick=$('#hero-explore').onclick=()=>setView('universe');$('#hero-resume').onclick=$('#resume-card').onclick=()=>setView('workspace');$('#open-focus').onclick=()=>{const focus=current.state.tasks.find(t=>t.id===current.state.focus);if(focus){openFilePanel(focus.path);setView('workspace');}};
  $('#change-focus').onclick=()=>{$('#focus-dialog').classList.remove('hidden');$('#focus-choices').innerHTML=current.state.tasks.map(t=>`<button class="focus-choice" data-focus="${esc(t.id)}"><strong>${esc(t.title)}</strong><span>${esc(t.stage.toUpperCase())} · ${esc(t.note)}</span></button>`).join('');$$('[data-focus]').forEach(b=>b.onclick=async()=>{if(await patch({focus:b.dataset.focus})){renderHome();$('#focus-dialog').classList.add('hidden');flash('Foco atualizado');}});};$('#focus-cancel').onclick=()=>$('#focus-dialog').classList.add('hidden');
  $('#pair-apply').onclick=()=>{const k=$('#pair-token').value.trim();if(k){sessionStorage.setItem('studyos-token',k);location.reload();}};
  $('#mode-control').onclick=async()=>{const m=current.state.mode,next=m==='explore'?'study':m==='study'?'focus':'explore';await patch({mode:next});renderMode();setView(next==='explore'?'universe':'workspace');};
  window.addEventListener('keydown',e=>{const input=['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);if(input||e.ctrlKey||e.metaKey)return;if(['1','2','3','4'].includes(e.key)){setView(['home','universe','workspace','notebook'][Number(e.key)-1]);}});
}
function renderMode(){const labels={explore:'✧ EXPLORAR',study:'▦ ESTUDAR',focus:'◎ FOCO'};$('#mode-control').innerHTML=labels[current.state.mode]+' <span>⌄</span>';document.body.classList.toggle('focus-mode',current.state.mode==='focus');}
async function setupCosmos(){const {createCosmos}=await import('./cosmos-react.tsx');const camera=()=>current.state.workspace.camera||defaultCamera;
  const onCamera=(cam,save)=>{current.state.workspace.camera=cam;if(save)saveWorkspace();$('#cosmos-coords').textContent='YAW '+cam.yaw.toFixed(2)+' · PITCH '+cam.pitch.toFixed(2)+' · Z '+cam.distance.toFixed(1);};
  current.cosmos=createCosmos($('#universe-canvas'),{getCamera:camera,onCamera,onSelect:selectNode,onOpen:openNode});
  current.hero=createCosmos($('#hero-canvas'),{hero:true,getCamera:()=>({yaw:-.5,pitch:.16,distance:21,target:[7,0,0]})});
  $('#reset-camera').onclick=()=>{onCamera(structuredClone(defaultCamera),true);current.cosmos?.resetCamera();};$('#universe-to-workspace').onclick=()=>setView('workspace');$('#node-open').onclick=()=>openNode(current.state.workspace.selected);
  selectNode(current.state.workspace.selected||'duffing',false);
}
function selectNode(id,persist=true){const node=NODES.find(n=>n.id===id)||NODES[2];current.state.workspace.selected=node.id;current.cosmos?.select(node.id);refreshDetails();if(persist)saveWorkspace();}
function refreshDetails(){const node=NODES.find(n=>n.id===current.state?.workspace?.selected)||NODES[2];$('#node-overline').textContent=node.kind.toUpperCase()+' · OBJETO ESPACIAL';$('#node-title').textContent=node.title;$('#node-description').textContent=node.description;$('#node-domain').textContent=node.domain;$('#node-links').textContent=String(node.links.length).padStart(2,'0')+' CONEXÕES';$('#detail-emblem').textContent=node.symbol;}
function openNode(id){selectNode(id);openFilePanel(FILES[id]||FILES.duffing);setView('workspace');flash('Projeção aberta · arquivo canônico preservado');}
let saveTimer=null;function saveWorkspace(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>patch({workspace:current.state.workspace}),270);}
function panelTitle(path){return path.split('/').at(-1);}
function openFilePanel(path,kind){let panels=current.state.workspace.panels;let match=panels.find(p=>p.path===path);if(!match){const index=panels.length;const panel={id:'panel-'+crypto.randomUUID().slice(0,8),kind:kind|| (path.endsWith('.md')?'notes':'code'),title:panelTitle(path),path,x:clamp(8+((index*9)%50),1,70),y:clamp(9+((index*6)%35),1,65),w:48,h:65};panels.push(panel);saveWorkspace();}else{panels=panels.filter(p=>p.id!==match.id);panels.push(match);current.state.workspace.panels=panels;saveWorkspace();}renderPanels();}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function setupWorkspace(){const defaultCode=FILES.duffing,defaultNotes='meeting_notes/2026-10-19_reuniao_luciano.md';
  $('#add-pdf').onclick=()=>$('#pdf-file-input').click();
  $('#pdf-file-input').onchange=async ev=>{
    const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
    if(file.size>15*1024*1024){flash('PDF muito grande (máximo 15 MB)');return;}
    try{const response=await api('/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf','X-StudyOS-Filename':encodeURIComponent(file.name)},body:await file.arrayBuffer()});
      const {document:doc}=await response.json();current.state.documents ||= [];current.state.documents.push(doc);
      const panels=current.state.workspace.panels;
      panels.push({id:'pdf-'+doc.id.slice(0,8),kind:'pdf',documentId:doc.id,title:doc.name,path:'pdf/'+doc.id,x:25,y:5,w:54,h:84});
      saveWorkspace();renderPanels();flash('PDF importado · fonte preservada');
    }catch(error){flash('Falha ao importar PDF: '+error.message);}
  };$('#add-code').onclick=()=>{openFilePanel(defaultCode,'code');flash('Painel de código projetado');};$('#add-notes').onclick=()=>{openFilePanel(defaultNotes,'notes');flash('Notas do repositório projetadas');};$('#add-notebook').onclick=()=>setView('notebook');$('#checkpoint-input').value=current.state.checkpoint.text||'';$('#checkpoint-save').onclick=async()=>{const note=$('#checkpoint-input').value.trim();if(await patch({checkpoint:{text:note,updatedAt:new Date().toISOString()}})){$('#checkpoint-saved').textContent='CHECKPOINT SALVO';flash('Checkpoint guardado na máquina');}};}
function formatSource(source, extension){
  const keywords=new Set(['def','return','for','in','if','else','elif','try','except','with','as','from','import','class','and','or','not','None','True','False','lambda','while','yield','continue','break','pass']);
  const py=extension==='py';
  const lines=source.split('\n');
  const renderLine=lines.map((line,i)=>{
    const tokens=py?line.match(/#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w]*\b|./g)||[]:[line];
    const decorated=tokens.map(t=>{
      const safe=esc(t);
      if(py&&t.startsWith('#'))return `<span class="code-comment">${safe}</span>`;
      if(py&&/^['"]/.test(t))return `<span class="code-string">${safe}</span>`;
      if(py&&keywords.has(t))return `<span class="code-keyword">${safe}</span>`;
      if(py&&/^\d/.test(t))return `<span class="code-number">${safe}</span>`;
      return safe;
    }).join('');
    return `<div class="source-line"><span class="source-line-no">${i+1}</span><span class="source-line-code">${decorated||' '}</span></div>`;
  }).join('');
  return `<div class="source-editor"><div class="source-editor-caption">${py?'PYTHON / READ ONLY':'RESEARCH SOURCE / READ ONLY'} <span>${lines.length} LINES</span></div><div class="source-lines">${renderLine}</div></div>`;
}

async function loadPanelContent(panel){const container=document.querySelector(`[data-panel-id="${panel.id}"] .panel-body`);if(!container)return;if(panel.kind==='pdf'){
    const doc=current.state.documents?.find(d=>d.id===panel.documentId);
    if(!doc){container.textContent='PDF importado não encontrado';return;}
    try{const {showPdf}=await import('./pdf.js');await showPdf({container,document:doc,api,onCapture:async capture=>{
      await current.notebook.addText(capture);
      setView('notebook');flash('Texto capturado com proveniência: '+doc.name+' · página '+capture.source.page);
    }});}catch(error){container.textContent='Falha ao ler PDF: '+error.message;}
    return;
  }
  const gh=repoFile(panel.path),ext=panel.path.split('.').at(-1);const header=`<div class="panel-source">FONTE: <a href="${esc(gh)}" target="_blank" rel="noopener noreferrer">${esc(panel.path)} ↗</a></div>`;
  if(!current.project.connected){container.innerHTML=header+`<div class="panel-placeholder"><p><strong>Arquivo preservado no Git.</strong></p><p>Para ler o conteúdo aqui, configure <code>STUDYOS_RESEARCH_DIR</code> com a pasta local do repositório e reinicie o servidor.</p><p>O link acima abre o arquivo original no GitHub.</p></div>`;return;}
  try{const resp=await api('/api/project/file?path='+encodeURIComponent(panel.path));if(['png','jpg','jpeg','webp','svg'].includes(ext)){container.innerHTML=header+`<img alt="Figura do repositório" style="max-width:100%" src="/api/project/file?path=${encodeURIComponent(panel.path)}${token()?'&token='+encodeURIComponent(token()):''}"/>`;return;}
    let content=await resp.text();if(ext==='ipynb'){const book=JSON.parse(content);content=(book.cells||[]).map(c=>(c.cell_type==='markdown'?'# Markdown\n':'# Código\n')+(Array.isArray(c.source)?c.source.join(''):c.source)).join('\n\n···\n\n');}
    container.innerHTML=header+formatSource(content.slice(0,170000),ext);
  }catch(e){container.innerHTML=header+`<p>Não foi possível ler o arquivo local: ${esc(e.message)}</p>`;}}
function renderPanels(){const holder=$('#panels');if(!current.state||current.view!=='workspace')return;const old=holder.querySelectorAll('.panel');old.forEach(p=>p.remove());
  for(const [i,p] of current.state.workspace.panels.entries()){const el=document.createElement('div');el.className='panel';el.dataset.panelId=p.id;Object.assign(el.style,{left:p.x+'%',top:p.y+'%',width:p.w+'%',height:p.h+'%',zIndex:i+1});el.innerHTML=`<div class="panel-head"><span class="panel-icon">${p.kind==='code'?'⌘':p.kind==='pdf'?'▣':'▤'}</span><span class="panel-name">${esc(p.title)}</span><button class="panel-close" title="Fechar projeção">×</button></div><div class="panel-body"><p>Carregando referência...</p></div><div class="panel-footer"><span>${p.kind==='pdf'?'PDF IMPORTADO · STUDY OS':'FONTE CANÔNICA · GIT'}</span></div>`;
    holder.appendChild(el);
    el.querySelector('.panel-close').onclick=()=>{current.state.workspace.panels=current.state.workspace.panels.filter(v=>v.id!==p.id);saveWorkspace();renderPanels();};
    el.querySelector('.panel-head').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();const head=e.currentTarget;head.setPointerCapture(e.pointerId);const area=$('#workspace-surface').getBoundingClientRect(),sx=e.clientX,sy=e.clientY,ix=p.x,iy=p.y;el.style.zIndex=100;
      const move=ev=>{const nx=clamp(ix+(ev.clientX-sx)/area.width*100,0,100-p.w),ny=clamp(iy+(ev.clientY-sy)/area.height*100,0,100-p.h);el.style.left=nx+'%';el.style.top=ny+'%';};
      const finish=()=>{head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',finish);p.x=parseFloat(el.style.left);p.y=parseFloat(el.style.top);saveWorkspace();};head.addEventListener('pointermove',move);head.addEventListener('pointerup',finish,{once:true});});
    el.addEventListener('pointerup',()=>{const a=$('#workspace-surface').getBoundingClientRect();const rect=el.getBoundingClientRect();const w=clamp(rect.width/a.width*100,19,99),h=clamp(rect.height/a.height*100,20,99);if(Math.abs(w-p.w)>.5||Math.abs(h-p.h)>.5){p.w=w;p.h=h;saveWorkspace();}});
    loadPanelContent(p);
  }
}
function updateInkStatus(){}
function setupInk(){const set=(label,ok)=>{$('#ink-dot').className='health-dot '+(ok?'online':'offline');$('#ink-sync').textContent=label;};current.notebook=createNotebook({canvas:$('#ink-canvas'),container:$('#notebook-area'),onStatus:set,getToken:token,serverElements:current.state.elements});
  $$('[data-tool]').forEach(b=>b.onclick=()=>{const t=b.dataset.tool;current.notebook.setTool(t);$$('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));});$$('[data-color]').forEach(b=>b.onclick=()=>{current.notebook.setColor(b.dataset.color);$$('[data-color]').forEach(x=>x.classList.toggle('active',x===b));});$('#ink-recenter').onclick=()=>current.notebook.center();$('#ink-zoomout').onclick=()=>current.notebook.zoom(.8);$('#ink-zoomin').onclick=()=>current.notebook.zoom(1.25);
}
async function bootstrap(){setupNav();try{const res=await api('/api/bootstrap');const data=await res.json();current.state=data.state;current.project=data.project;setConnection('Servidor local ativo',true);
    const tablet=new URLSearchParams(location.search).has('tablet') || (innerWidth<=650 && /Android|iPad/i.test(navigator.userAgent));
    if(tablet)document.body.classList.add('tablet-only');
    if(!tablet)await setupCosmos();
    setupWorkspace();setupInk();renderHome();renderMode();
    setView(tablet?'notebook':(['home','universe','workspace','notebook'].includes(location.hash.slice(1))?location.hash.slice(1):'home'));
  }catch(e){setConnection('Conexão não autorizada',false);if(e.message!=='Token necessário')flash(e.message);}}
bootstrap();
