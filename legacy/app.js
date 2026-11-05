import { NODES, createCosmos } from './cosmos.js';
import { createNotebook } from './notebook.js';
import {normalizeDesk,activatePanel,saveCapture,updateLayout,limit} from './workspace-model.js';

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
  if(view==='workspace'||view==='notebook'){moveSharedNotebook(view);if(view==='workspace')renderPanels();}
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
function setupCosmos(){const camera=()=>current.state.workspace.camera||defaultCamera;
  const onCamera=(cam,save)=>{current.state.workspace.camera=cam;if(save)saveWorkspace();$('#cosmos-coords').textContent='YAW '+cam.yaw.toFixed(2)+' · PITCH '+cam.pitch.toFixed(2)+' · Z '+cam.distance.toFixed(1);};
  current.cosmos=createCosmos($('#universe-canvas'),{getCamera:camera,onCamera,onSelect:selectNode,onOpen:openNode});
  current.hero=createCosmos($('#hero-canvas'),{hero:true,getCamera:()=>({yaw:-.5,pitch:.16,distance:21,target:[7,0,0]})});
  $('#reset-camera').onclick=()=>onCamera(structuredClone(defaultCamera),true);$('#universe-to-workspace').onclick=()=>setView('workspace');$('#node-open').onclick=()=>openNode(current.state.workspace.selected);
  selectNode(current.state.workspace.selected||'duffing',false);
}
function selectNode(id,persist=true){const node=NODES.find(n=>n.id===id)||NODES[2];current.state.workspace.selected=node.id;current.cosmos?.select(node.id);refreshDetails();if(persist)saveWorkspace();}
function refreshDetails(){const node=NODES.find(n=>n.id===current.state?.workspace?.selected)||NODES[2];$('#node-overline').textContent=node.kind.toUpperCase()+' · OBJETO ESPACIAL';$('#node-title').textContent=node.title;$('#node-description').textContent=node.description;$('#node-domain').textContent=node.domain;$('#node-links').textContent=String(node.links.length).padStart(2,'0')+' CONEXÕES';$('#detail-emblem').textContent=node.symbol;}
function openNode(id){selectNode(id);openFilePanel(FILES[id]||FILES.duffing);setView('workspace');flash('Projeção aberta · arquivo canônico preservado');}
let saveTimer=null;function saveWorkspace(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>patch({workspace:current.state.workspace}),270);}
function panelTitle(path){return path.split('/').at(-1);}
function openFilePanel(path,kind){
  const ws=normalizeDesk(current.state.workspace);
  let panel=ws.panels.find(p=>p.path===path);
  if(!panel){
    panel={id:'panel-'+crypto.randomUUID().slice(0,8),kind:kind||(path.endsWith('.md')?'notes':'code'),title:panelTitle(path),path,page:1};
    ws.panels.push(panel);
  }
  activatePanel(ws,panel.id);
  saveWorkspace();renderPanels();
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function moveSharedNotebook(view){
  if(document.body.classList.contains('tablet-only'))return;
  const area=$('#notebook-area'),tools=$('#ink-tools');
  if(!area||!tools)return;
  const parent=view==='workspace'?'#workbench-notebook-host':'#view-notebook';
  const toolParent=view==='workspace'?'#workbench-tools':'#view-notebook';
  if(area.parentElement!==$(parent))$(parent).appendChild(area);
  if(tools.parentElement!==$(toolParent)){
    if(view==='notebook')$('#view-notebook').insertBefore(tools,area);
    else $(toolParent).appendChild(tools);
  }
}
function renderWorkbenchState(){
  if(!current.state)return;
  const ws=normalizeDesk(current.state.workspace);
  const shell=$('#workspace-surface');
  shell.style.setProperty('--reader-width',`${ws.layout.readerPct}%`);
  shell.classList.toggle('context-collapsed',!ws.layout.contextOpen);
  $('#desk-context-toggle').setAttribute('aria-pressed',String(ws.layout.contextOpen));
  $$('[data-desk-preset]').forEach(b=>b.classList.toggle('active',b.dataset.deskPreset===ws.layout.preset));
  renderCaptureTray();
}
function setupWorkspace(){
  const defaultCode=FILES.duffing,defaultNotes='meeting_notes/2026-10-19_reuniao_luciano.md';
  normalizeDesk(current.state.workspace);
  $('#add-pdf').onclick=()=>$('#pdf-file-input').click();
  $('#pdf-file-input').onchange=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>15*1024*1024){flash('O limite de PDF nesta versão é 15 MB.');return;}
    try{
      const response=await api('/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf','X-StudyOS-Filename':encodeURIComponent(file.name)},body:await file.arrayBuffer()});
      const {document:doc}=await response.json();current.state.documents||=[];current.state.documents.push(doc);
      const ws=normalizeDesk(current.state.workspace);
      const panel={id:'pdf-'+doc.id.slice(0,8),kind:'pdf',documentId:doc.id,title:doc.name,path:'pdf/'+doc.id,page:1};
      ws.panels.push(panel);ws.activePanelId=panel.id;
      saveWorkspace();renderPanels();flash('PDF adicionado à bancada.');
    }catch(error){flash('Não foi possível importar PDF: '+error.message);}
  };
  $('#add-code').onclick=()=>openFilePanel(defaultCode,'code');
  $('#add-notes').onclick=()=>openFilePanel(defaultNotes,'notes');
  $('#add-notebook').onclick=$('#wb-expand').onclick=()=>setView('notebook');
  $$('[data-desk-preset]').forEach(button=>button.onclick=()=>{
    updateLayout(current.state.workspace,button.dataset.deskPreset);renderWorkbenchState();saveWorkspace();
  });
  $('#desk-context-toggle').onclick=()=>{
    const ws=normalizeDesk(current.state.workspace);ws.layout.contextOpen=!ws.layout.contextOpen;
    renderWorkbenchState();saveWorkspace();
  };
  const divider=$('#desk-resize-handle');
  divider.addEventListener('pointerdown',event=>{
    if(window.matchMedia('(max-width:940px)').matches)return;
    event.preventDefault();divider.setPointerCapture(event.pointerId);
    const shell=$('#workspace-surface');
    const move=e=>{
      const rect=shell.getBoundingClientRect();
      const pct=limit(100*(e.clientX-rect.left)/rect.width,24,60);
      const ws=normalizeDesk(current.state.workspace);ws.layout.readerPct=Math.round(pct*10)/10;ws.layout.preset='custom';
      renderWorkbenchState();
    };
    const done=()=>{divider.removeEventListener('pointermove',move);divider.removeEventListener('pointerup',done);divider.removeEventListener('pointercancel',done);saveWorkspace();};
    divider.addEventListener('pointermove',move);divider.addEventListener('pointerup',done);divider.addEventListener('pointercancel',done);
  });
  divider.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const ws=normalizeDesk(current.state.workspace);
    ws.layout.readerPct=limit(ws.layout.readerPct+(event.key==='ArrowRight'?2:-2),24,60);ws.layout.preset='custom';
    renderWorkbenchState();saveWorkspace();
  });
  $('#checkpoint-input').value=current.state.checkpoint.text||'';
  $('#checkpoint-save').onclick=async()=>{
    const note=$('#checkpoint-input').value.trim();
    if(await patch({checkpoint:{text:note,updatedAt:new Date().toISOString()}})){
      $('#checkpoint-saved').textContent='CHECKPOINT SALVO';flash('Seu ponto de retomada foi registrado.');
    }
  };
  renderWorkbenchState();
}
function sourceLabel(source){
  if(source?.kind==='pdf')return `${source.name||'PDF'} · página ${source.page||1}`;
  if(source?.kind==='file')return `${source.name||'Arquivo do Git'}`;
  return 'Trecho registrado';
}
function renderCaptureTray(){
  const holder=$('#capture-tray');if(!holder||!current.state)return;
  const entries=normalizeDesk(current.state.workspace).captures;
  $('#capture-count').textContent=String(entries.length).padStart(2,'0');
  if(!entries.length){holder.innerHTML='<div class="capture-empty"><span>⌁</span><strong>Sua bandeja está pronta</strong><p>Capture uma passagem do PDF e ela ficará aqui, com a fonte guardada.</p></div>';return;}
  holder.replaceChildren();
  for(const item of entries){
    const card=document.createElement('article');card.className='capture-card';
    card.innerHTML=`<div class="capture-tag"><span>✦ ${item.status==='inserted'?'NO CADERNO':'NA BANDEJA'}</span><span>↗</span></div><p>${esc(item.text.slice(0,180))}${item.text.length>180?'…':''}</p><div class="capture-origin">${esc(sourceLabel(item.source))}</div><div class="capture-actions"><button type="button" data-action="insert">${item.status==='inserted'?'↗ Novo cartão':'＋ Caderno'}</button><button type="button" data-action="source">Fonte</button><button type="button" data-action="remove" aria-label="Remover fragmento">×</button></div>`;
    card.querySelector('[data-action="insert"]').onclick=()=>insertCapture(item);
    card.querySelector('[data-action="source"]').onclick=()=>openCaptureSource(item);
    card.querySelector('[data-action="remove"]').onclick=()=>{
      const ws=normalizeDesk(current.state.workspace);ws.captures=ws.captures.filter(c=>c.id!==item.id);renderCaptureTray();saveWorkspace();
    };
    holder.appendChild(card);
  }
}
function openCaptureSource(item){
  const ws=normalizeDesk(current.state.workspace);const source=item.source;
  if(source?.kind==='pdf'&&source.documentId){
    const panel=ws.panels.find(p=>p.documentId===source.documentId);
    if(panel){panel.page=source.page||1;ws.activePanelId=panel.id;saveWorkspace();renderPanels();return;}
  }
  if(source?.kind==='file'&&source.path){openFilePanel(source.path);return;}
  flash('A fonte original não está disponível nesta bancada.');
}
async function insertCapture(capture){
  try{
    await current.notebook.addText({text:capture.text,source:capture.source||undefined});
    saveCapture(current.state.workspace,capture,'inserted');renderCaptureTray();saveWorkspace();
    flash('Trecho inserido no Super Caderno · continue na bancada.');
  }catch(error){flash('Não foi possível inserir: '+error.message);}
}
function queueCapture(capture){
  try{saveCapture(current.state.workspace,capture,'saved');renderCaptureTray();saveWorkspace();flash('Trecho guardado com sua referência de origem.');}
  catch(error){flash(error.message);}
}
function selectedTextInside(element){
  const selection=window.getSelection();if(!selection||selection.isCollapsed)return '';
  if(!element.contains(selection.anchorNode)||!element.contains(selection.focusNode))return '';
  return selection.toString().trim().slice(0,4500);
}
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

async function loadPanelContent(panel){
  const container=document.querySelector(`[data-panel-id="${panel.id}"] .panel-body`);
  if(!container)return;
  if(panel.kind==='pdf'){
    const doc=current.state.documents?.find(d=>d.id===panel.documentId);
    if(!doc){container.textContent='O documento original não foi encontrado.';return;}

    container.innerHTML=`<div class="panel-source">PDF IMPORTADO · ${esc(doc.name)} · FONTE ORIGINAL</div><div class="native-pdf-hint">Este leitor alternativo usa o visualizador PDF do navegador. Para seleção de texto com proveniência, execute o frontend com npm install e npm run dev.</div><iframe title="PDF: ${esc(doc.name)}" class="native-pdf-frame" src="/api/documents/${encodeURIComponent(doc.id)}${token()?'?token='+encodeURIComponent(token()):''}"></iframe>`;
    return;
  }
  const gh=repoFile(panel.path),ext=panel.path.split('.').at(-1);
  const header=`<div class="panel-source"><span>GIT / FONTE CANÔNICA</span> <a href="${esc(gh)}" target="_blank" rel="noopener noreferrer">${esc(panel.path)} ↗</a></div>`;
  if(!current.project.connected){
    container.innerHTML=header+`<div class="panel-placeholder"><div class="reader-placeholder-symbol">⌘</div><p><strong>Arquivo original preservado no Git.</strong></p><p>Para ler aqui, configure <code>STUDYOS_RESEARCH_DIR</code> com o caminho local do repositório. A organização original não será alterada.</p><a href="${esc(gh)}" target="_blank" rel="noopener noreferrer" class="reader-open-source">Abrir no GitHub ↗</a></div>`;
    return;
  }
  try{
    const resp=await api('/api/project/file?path='+encodeURIComponent(panel.path));
    if(['png','jpg','jpeg','webp','svg'].includes(ext)){
      container.innerHTML=header+`<img alt="Figura do repositório" class="scientific-image" src="/api/project/file?path=${encodeURIComponent(panel.path)}${token()?'&token='+encodeURIComponent(token()):''}"/>`;return;
    }
    let content=await resp.text();
    if(ext==='ipynb'){
      const book=JSON.parse(content);
      content=(book.cells||[]).map(c=>(c.cell_type==='markdown'?'# Markdown\n':'# Python\n')+(Array.isArray(c.source)?c.source.join(''):c.source)).join('\n\n···\n\n');
    }
    container.innerHTML=header+`<div class="source-capture-bar"><span>SELECIONE UM TRECHO DO CÓDIGO PARA CAPTURAR</span><button type="button" class="source-to-notebook">↗ Caderno</button><button type="button" class="source-to-tray">＋ Guardar</button></div>`+formatSource(content.slice(0,170000),ext);
    const capture=action=>{
      const text=selectedTextInside(container);
      if(!text){flash('Selecione o texto do arquivo antes de capturar.');return;}
      const item={text,source:{kind:'file',name:panel.title,path:panel.path}};
      if(action==='tray')queueCapture(item);else insertCapture(item);
    };
    container.querySelector('.source-to-notebook').addEventListener('pointerdown',e=>e.preventDefault());
    container.querySelector('.source-to-tray').addEventListener('pointerdown',e=>e.preventDefault());
    container.querySelector('.source-to-notebook').onclick=()=>capture('insert');
    container.querySelector('.source-to-tray').onclick=()=>capture('tray');
    if(panel.scrollTop)container.scrollTop=panel.scrollTop;
    container.onscroll=()=>{panel.scrollTop=container.scrollTop;};
  }catch(e){container.innerHTML=header+`<p>Arquivo não disponível localmente: ${esc(e.message)}</p>`;}
}
function renderPanels(){
  if(!current.state||current.view!=='workspace')return;
  const ws=normalizeDesk(current.state.workspace);
  const tabs=$('#reader-tabs'),holder=$('#reader-document');
  tabs.replaceChildren();
  for(const panel of ws.panels){
    const tab=document.createElement('button');tab.type='button';tab.className='reader-tab'+(ws.activePanelId===panel.id?' active':'');
    tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(ws.activePanelId===panel.id));
    tab.title=panel.title;
    tab.innerHTML=`<span>${panel.kind==='pdf'?'▣':panel.kind==='code'?'⌘':'▤'}</span><span class="tab-name">${esc(panel.title)}</span><span class="tab-close" title="Fechar aba">×</span>`;
    tab.onclick=e=>{
      if(e.target.closest('.tab-close')){
        ws.panels=ws.panels.filter(p=>p.id!==panel.id);
        if(ws.activePanelId===panel.id)ws.activePanelId=ws.panels.at(-1)?.id||null;
      }else ws.activePanelId=panel.id;
      saveWorkspace();renderPanels();
    };
    tabs.appendChild(tab);
  }
  const active=ws.panels.find(p=>p.id===ws.activePanelId);
  if(active){
    holder.dataset.panelId=active.id;
    holder.innerHTML='<div class="panel-body reader-content">Carregando referência...</div>';
    loadPanelContent(active);
  }else{
    holder.removeAttribute('data-panel-id');
    holder.innerHTML='<div class="reader-empty"><span>◈</span><strong>Uma referência por vez. Seu contexto sempre perto.</strong><p>Importe um PDF ou abra seu código científico para começar a sessão.</p></div>';
  }
  renderWorkbenchState();
}
function updateInkStatus(){}
function setupInk(){const set=(label,ok)=>{$('#ink-dot').className='health-dot '+(ok?'online':'offline');$('#ink-sync').textContent=label;if($('#workbench-sync'))$('#workbench-sync').textContent=label;};current.notebook=createNotebook({canvas:$('#ink-canvas'),container:$('#notebook-area'),onStatus:set,getToken:token,serverElements:current.state.elements});
  $$('[data-tool]').forEach(b=>b.onclick=()=>{const t=b.dataset.tool;current.notebook.setTool(t);$$('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));});$$('[data-color]').forEach(b=>b.onclick=()=>{current.notebook.setColor(b.dataset.color);$$('[data-color]').forEach(x=>x.classList.toggle('active',x===b));});$('#ink-recenter').onclick=()=>current.notebook.center();$('#ink-zoomout').onclick=()=>current.notebook.zoom(.8);$('#ink-zoomin').onclick=()=>current.notebook.zoom(1.25);
}
async function bootstrap(){setupNav();try{const res=await api('/api/bootstrap');const data=await res.json();current.state=data.state;normalizeDesk(current.state.workspace);current.project=data.project;setConnection('Servidor local ativo',true);
    const tablet=new URLSearchParams(location.search).has('tablet') || (innerWidth<=650 && /Android|iPad/i.test(navigator.userAgent));
    if(tablet)document.body.classList.add('tablet-only');
    if(!tablet)setupCosmos();
    setupWorkspace();setupInk();renderHome();renderMode();
    setView(tablet?'notebook':(['home','universe','workspace','notebook'].includes(location.hash.slice(1))?location.hash.slice(1):'home'));
  }catch(e){setConnection('Conexão não autorizada',false);if(e.message!=='Token necessário')flash(e.message);}}
bootstrap();
