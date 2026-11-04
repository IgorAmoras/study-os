import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';

async function freePort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}
const dir=await mkdtemp(path.join(os.tmpdir(),'studyos-http-'));
const repo=path.join(dir,'research');await mkdir(repo);await writeFile(path.join(repo,'SINDy.py'),'print("research")');
const port=await freePort();
const processServer=spawn(process.execPath,['server/index.mjs'],{cwd:path.resolve(new URL('../',import.meta.url).pathname),env:{...process.env,PORT:String(port),STUDYOS_DATA_DIR:path.join(dir,'data'),STUDYOS_RESEARCH_DIR:repo},stdio:['ignore','pipe','pipe']});
let output='';processServer.stdout.on('data',d=>output+=d);processServer.stderr.on('data',d=>output+=d);
async function ready(){for(let n=0;n<100;n++){try{const r=await fetch(`http://127.0.0.1:${port}/api/bootstrap`);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Server did not start: '+output);}
await ready();
after(async()=>{processServer.kill('SIGTERM');await rm(dir,{recursive:true,force:true});});

test('http: static app, API and actual project content',async()=>{
 const base=`http://127.0.0.1:${port}`;
 const r=await fetch(base);assert.equal(r.status,200);assert.match(await r.text(),/STUDY OS/);
 const state=await (await fetch(base+'/api/bootstrap')).json();assert.equal(state.project.connected,true);assert.equal(state.state.elements.length,0);
 const code=await fetch(base+'/api/project/file?path=SINDy.py');assert.equal(code.status,200);assert.equal(await code.text(),'print("research")');
});

test('http: path traversal is rejected and original repository not mutated',async()=>{
 const base=`http://127.0.0.1:${port}`;
 const bad=await fetch(base+'/api/project/file?path='+encodeURIComponent('../data/access-token'));
 assert.equal(bad.status,400);
 const bad2=await fetch(base+'/api/project/file?path='+encodeURIComponent('/etc/passwd'));
 assert.equal(bad2.status,400);
 const method=await fetch(base+'/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(method.status,404);
});

test('http: patch and live WebSocket stroke sync',async()=>{
 const base=`http://127.0.0.1:${port}`;
 let r=await fetch(base+'/api/state',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'focus'})});assert.equal(r.status,200);
 assert.equal((await (await fetch(base+'/api/bootstrap')).json()).state.mode,'focus');
 const socket1=new WebSocket(`ws://127.0.0.1:${port}/ws`);
 const socket2=new WebSocket(`ws://127.0.0.1:${port}/ws`);
 await Promise.all([once(socket1,'open'),once(socket2,'open')]);
 const received=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('WS broadcast timeout')),1500);socket2.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.type==='element.add'){clearTimeout(timer);resolve(data);}});});
 const elem={id:'testStroke00001',type:'stroke',points:[[0,0,.5],[2,3,.5]],color:'#d9e9ff',width:2};
 socket1.send(JSON.stringify({type:'element.add',element:elem}));
 assert.deepEqual((await received).element,elem);
 const boot=await (await fetch(base+'/api/bootstrap')).json();assert.equal(boot.state.elements.length,1);
 socket1.close();socket2.close();
});

test('http: PDF upload, retrieval and provenance metadata',async()=>{
 const base=`http://127.0.0.1:${port}`;
 const payload=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
 const created=await fetch(base+'/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf','X-StudyOS-Filename':encodeURIComponent('artigo científico.pdf')},body:payload});
 assert.equal(created.status,201);
 const {document}=await created.json();
 assert.equal(document.name,'artigo científico.pdf');
 assert.equal(document.size,payload.length);
 const read=await fetch(base+'/api/documents/'+document.id);
 assert.equal(read.status,200);
 assert.equal(read.headers.get('content-type'),'application/pdf');
 assert.deepEqual(Buffer.from(await read.arrayBuffer()),payload);
 const boot=await (await fetch(base+'/api/bootstrap')).json();
 assert.ok(boot.state.documents.some(d=>d.id===document.id));
 const fragment={id:'capturedPdfText001',type:'text',text:'Equação 1: x + y = z',x:42,y:60,
  source:{kind:'pdf',name:document.name,documentId:document.id,page:2}};
 const stored=await fetch(base+'/api/elements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fragment)});
 assert.equal(stored.status,200);
 const check=await (await fetch(base+'/api/bootstrap')).json();
 assert.deepEqual(check.state.elements.find(e=>e.id===fragment.id),fragment);
});

test('http: reject non-PDF data and missing document IDs',async()=>{
 const base=`http://127.0.0.1:${port}`;
 const fake=await fetch(base+'/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf','X-StudyOS-Filename':'fake.pdf'},body:'not-a-pdf'});
 assert.equal(fake.status,400);
 const badtype=await fetch(base+'/api/documents',{method:'POST',headers:{'Content-Type':'text/plain'},body:'%PDF-1.4'});
 assert.equal(badtype.status,415);
 const notFound=await fetch(base+'/api/documents/'+crypto.randomUUID());
 assert.equal(notFound.status,404);
});

test('http: WebSocket transmits large vector strokes (>64 KiB) without data corruption',async()=>{
 const base=`ws://127.0.0.1:${port}/ws`;
 const source=new WebSocket(base), target=new WebSocket(base);
 await Promise.all([once(source,'open'),once(target,'open')]);
 const points=Array.from({length:9500},(_,i)=>[i*1.13,i*.91,.55]);
 const element={id:'largeStrokeTEST001',type:'stroke',points,color:'#aabbcc',width:2};
 assert.ok(JSON.stringify(element).length>65535);
 const incoming=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Large frame timed out')),3000);
   target.addEventListener('message',event=>{
     const m=JSON.parse(event.data);
     if(m.type==='element.add' && m.element?.id===element.id){clearTimeout(timer);resolve(m.element);}
   });
 });
 source.send(JSON.stringify({type:'element.add',element}));
 assert.deepEqual(await incoming,element);
 source.close();target.close();
});
