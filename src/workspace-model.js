// Single-user desk state, intentionally file/JSON based (no SQL, no event bus).
export const DEFAULT_LAYOUT={readerPct:34,contextOpen:true,preset:'balanced'};
export const PRESETS={balanced:34,reading:49,writing:25};
export const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
export function normalizeDesk(workspace){
  const ws=workspace||{};
  ws.panels=Array.isArray(ws.panels)?ws.panels:[];
  ws.captures=Array.isArray(ws.captures)?ws.captures:[];
  ws.layout={...DEFAULT_LAYOUT,...(ws.layout||{})};
  ws.layout.readerPct=limit(Number(ws.layout.readerPct)||34,24,60);
  if(!ws.panels.some(p=>p.id===ws.activePanelId)) ws.activePanelId=ws.panels[0]?.id??null;
  return ws;
}
export function activatePanel(workspace,id){
  const ws=normalizeDesk(workspace);
  if(ws.panels.some(p=>p.id===id)){ws.activePanelId=id;return true;}
  return false;
}
export function saveCapture(workspace,capture,status='saved'){
  const ws=normalizeDesk(workspace);
  if(!capture||typeof capture.text!=='string'||!capture.text.trim())throw Error('Empty fragment');
  const item={id:capture.id||crypto.randomUUID(),text:capture.text.trim().slice(0,4500),source:capture.source??null,
    status:status==='inserted'?'inserted':'saved',createdAt:capture.createdAt||new Date().toISOString()};
  const found=ws.captures.findIndex(x=>x.id===item.id);
  if(found>=0)ws.captures[found]={...ws.captures[found],...item};
  else ws.captures.unshift(item);
  ws.captures=ws.captures.slice(0,60);
  return item;
}
export function updateLayout(workspace,preset){
  const ws=normalizeDesk(workspace);
  if(!(preset in PRESETS))throw Error('Unknown workspace preset');
  ws.layout={...ws.layout,preset,readerPct:PRESETS[preset]};
  return ws.layout;
}
