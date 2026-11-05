import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {normalizeDesk,activatePanel,saveCapture,updateLayout} from '../src/workspace-model.js';
import {createStore,validElement} from '../server/store.mjs';

test('desk: migrates old floating panels into tabbed reader without losing identifiers',()=>{
 const ws={panels:[{id:'p1',kind:'code',path:'systems/test.py'},{id:'p2',kind:'notes',path:'meeting_notes/a.md'}]};
 normalizeDesk(ws);
 assert.equal(ws.activePanelId,'p1');assert.equal(ws.layout.readerPct,34);
 assert.deepEqual(ws.captures,[]);assert.equal(ws.panels[1].path,'meeting_notes/a.md');
 assert.equal(activatePanel(ws,'p2'),true);assert.equal(ws.activePanelId,'p2');
 assert.equal(activatePanel(ws,'missing'),false);assert.equal(ws.activePanelId,'p2');
});

test('desk: reader/write presets keep the notebook visible and honor manual resize',()=>{
 const ws={panels:[]};normalizeDesk(ws);
 assert.equal(updateLayout(ws,'reading').readerPct,49);
 assert.equal(updateLayout(ws,'writing').readerPct,25);
 assert.equal(updateLayout(ws,'balanced').readerPct,34);
 assert.throws(()=>updateLayout(ws,'unknown'));
});

test('desk: captured PDF excerpt retains source and can be promoted without duplicate',()=>{
 const ws={panels:[],captures:[]};
 const source={kind:'pdf',name:'fixture.pdf',documentId:'b9d134a2-66d9-47e3-860c-288ea1800e5d',page:7,rect:{x:0.2,y:0.3,w:0.25,h:0.1}};
 const capture=saveCapture(ws,{id:'capture-test-0001',text:' z(k+1) = A z(k) + B u(k) ',source});
 assert.equal(capture.text,'z(k+1) = A z(k) + B u(k)');assert.equal(capture.status,'saved');
 const promoted=saveCapture(ws,capture,'inserted');
 assert.equal(ws.captures.length,1);assert.equal(promoted.source.page,7);assert.equal(promoted.status,'inserted');
 assert.equal(validElement({id:'textcapt0001',type:'text',text:promoted.text,x:0,y:0,source:promoted.source}),true);
});

test('desk: capture tray, source and layout persist after reload',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'studyos-desk-'));
 try{
  const file=path.join(dir,'state.json');const store=createStore(file);await store.init();
  const workspace=normalizeDesk(store.getState().workspace);
  workspace.layout.readerPct=41;workspace.layout.preset='custom';workspace.activePanelId='notes';
  saveCapture(workspace,{text:'selected statement',source:{kind:'file',name:'classic_koopman.py',path:'systems/duffing_oscillator/classic_koopman.py'}});
  await store.applyPatch({workspace});
  const reloaded=createStore(file);await reloaded.init();const saved=reloaded.getState().workspace;
  assert.equal(saved.layout.readerPct,41);assert.equal(saved.activePanelId,'notes');
  assert.equal(saved.captures.length,1);assert.equal(saved.captures[0].source.kind,'file');
  await assert.rejects(store.applyPatch({workspace:{...workspace,layout:{readerPct:150,contextOpen:true}}}));
  await assert.rejects(store.applyPatch({workspace:{...workspace,captures:Array(61).fill(saved.captures[0])}}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
