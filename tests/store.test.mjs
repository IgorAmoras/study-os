import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore, validElement } from '../server/store.mjs';

test('storage: initializes, patches and reloads without losing state',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'studyos-test-'));
 try{const file=path.join(dir,'state.json'),s=createStore(file);await s.init();assert.equal(s.getState().focus,'task-observers');
 await s.applyPatch({mode:'focus',checkpoint:{text:'Revisar paper X',updatedAt:'2026-11-04T12:00:00.000Z'}});
 assert.equal(s.getState().mode,'focus');const s2=createStore(file);await s2.init();assert.equal(s2.getState().checkpoint.text,'Revisar paper X');
 const disk=JSON.parse(await readFile(file));assert.equal(disk.mode,'focus');}
 finally{await rm(dir,{recursive:true,force:true});}
});

test('storage: idempotent element insertion and persistence',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'studyos-test-'));
 try{const file=path.join(dir,'state.json'),s=createStore(file);await s.init();const pen={id:'abc123456789',type:'stroke',color:'#d9e9ff',width:2.2,points:[[0,0,.5],[3,4,.5]]};
 assert.equal(await s.upsertElement(pen),true);assert.equal(await s.upsertElement(pen),false);
 const reloaded=createStore(file);await reloaded.init();assert.equal(reloaded.getState().elements.length,1);}
 finally{await rm(dir,{recursive:true,force:true});}
});

test('storage: reject malicious/invalid elements and field patches',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'studyos-test-'));
 try{const file=path.join(dir,'state.json'),s=createStore(file);await s.init();assert.equal(validElement({id:'AAAA123456',type:'stroke',color:'#FFFFFF',width:1,points:[[0,0],[1,1]]}),true);
 assert.equal(validElement({id:'AAAA123456',type:'stroke',color:'javascript:alert(1)',width:1,points:[[0,0],[1,1]]}),false);
 await assert.rejects(s.applyPatch({elements:[]}));await assert.rejects(s.applyPatch({mode:'runPython'}));await assert.rejects(s.upsertElement({id:'../../../../../evil'}));}
 finally{await rm(dir,{recursive:true,force:true});}
});
