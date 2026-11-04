import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpath, readdir, readFile, stat, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createStore, PROJECT } from './store.mjs';
import { acceptSocket } from './websocket.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '../dist');
const PUBLIC = existsSync(path.join(DIST, 'index.html')) ? DIST : path.resolve(HERE, '../legacy');
const DATA = path.resolve(process.env.STUDYOS_DATA_DIR || path.join(HERE, '../.studyos-data'));
const RESEARCH = process.env.STUDYOS_RESEARCH_DIR ? path.resolve(process.env.STUDYOS_RESEARCH_DIR) : null;
const HOST = process.env.STUDYOS_HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4317);
const EXT = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8', '.ipynb': 'application/json; charset=utf-8', '.pdf': 'application/pdf', '.jpg': 'image/jpeg' };
const ALLOWED = new Set(['.py','.md','.txt','.json','.ipynb','.png','.jpg','.jpeg','.webp','.svg','.pdf','.csv']);
const store = createStore(path.join(DATA, 'state.json'));
const peers = new Set();
let projectRoot = null;
let token;

function send(res, code, data, mime='application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}
function json(res, code, data) { send(res, code, data); }
function local(req) { return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress); }
function authenticated(req, url) {
  if (local(req)) return true;
  const supplied = req.headers['x-studyos-token'] || url.searchParams.get('token') || '';
  if (typeof supplied !== 'string' || supplied.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
}
function sameOrigin(req) {
  // Loopback proxy is used by the Vite dev server (which only listens on loopback).
  if (local(req) || !req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
async function readBody(req) {
  let size = 0, chunks = [];
  for await (const b of req) {
    size += b.length;
    if (size > 1024 * 1024) throw new Error('Request too large');
    chunks.push(b);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function readBinary(req, max = 15 * 1024 * 1024) {
  const parts = []; let total = 0;
  for await (const part of req) {
    total += part.length;
    if (total > max) throw new Error('File too large');
    parts.push(part);
  }
  return Buffer.concat(parts);
}
async function allowedProjectFile(relative) {
  if (!projectRoot) throw new Error('Project directory not configured');
  if (typeof relative !== 'string' || relative.includes('\\') || relative.startsWith('/') || relative.includes('\0')) throw new Error('Invalid path');
  const resolved = path.resolve(projectRoot, relative);
  if (!resolved.startsWith(projectRoot + path.sep)) throw new Error('Path outside project');
  const canonical = await realpath(resolved);
  if (!canonical.startsWith(projectRoot + path.sep)) throw new Error('File outside project');
  if (!ALLOWED.has(path.extname(canonical).toLowerCase())) throw new Error('Unsupported file type');
  if ((await stat(canonical)).size > 12 * 1024 * 1024) throw new Error('File too large');
  return canonical;
}
async function projectTree(dir=projectRoot, depth=0, count={n:0}) {
  if (!dir || depth > 6 || count.n > 1000) return [];
  const entries = (await readdir(dir, { withFileTypes:true })).filter(e => !e.name.startsWith('.') && !['node_modules','__pycache__','venv','.venv'].includes(e.name));
  const result=[];
  for(const e of entries) {
    if(++count.n > 1000) break;
    const full=path.join(dir,e.name), rel=path.relative(projectRoot,full).replaceAll(path.sep,'/');
    if(e.isDirectory()) result.push({type:'directory',name:e.name,path:rel,children:await projectTree(full,depth+1,count)});
    else if(e.isFile() && ALLOWED.has(path.extname(e.name).toLowerCase())) result.push({type:'file',name:e.name,path:rel});
  }
  return result;
}
function broadcast(data, except) { for(const peer of peers) if(peer!==except) peer.send(data); }

export async function start({ port=PORT, host=HOST }={}) {
  await mkdir(DATA, { recursive:true });
  try { token=(await readFile(path.join(DATA,'access-token'),'utf8')).trim(); }
  catch (e) { if (e.code !== 'ENOENT') throw e; token=randomBytes(24).toString('hex'); await writeFile(path.join(DATA,'access-token'),token,{mode:0o600}); }
  if (RESEARCH) { try { projectRoot=await realpath(RESEARCH); } catch { console.warn('STUDYOS_RESEARCH_DIR not found:',RESEARCH); } }
  await store.init();
  const server=http.createServer(async (req,res)=>{
    let url;
    try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
    catch { return json(res,400,{error:'Bad URL'}); }
    try {
      if (url.pathname.startsWith('/api/')) {
        if (!sameOrigin(req)) return json(res,403,{error:'Origin mismatch'});
        if (!authenticated(req,url)) return json(res,401,{error:'Access token required'});
        if (req.method==='GET' && url.pathname==='/api/bootstrap') return json(res,200,{state:store.getState(),project:{...PROJECT,connected:!!projectRoot,root:projectRoot?'Configured local repository':null}});
        if (req.method==='POST' && url.pathname==='/api/documents') {
          if (req.headers['content-type'] !== 'application/pdf') return json(res,415,{error:'PDF required'});
          const name = decodeURIComponent(String(req.headers['x-studyos-filename'] || 'paper.pdf')).replace(/[\x00-\x1f]/g,'').slice(0,160);
          if (!name.toLowerCase().endsWith('.pdf')) return json(res,400,{error:'Invalid document name'});
          const buffer = await readBinary(req);
          if (buffer.subarray(0,5).toString() !== '%PDF-') return json(res,400,{error:'Invalid PDF data'});
          const id = randomUUID();
          const folder = path.join(DATA,'documents');
          await mkdir(folder,{recursive:true});
          const tmp = path.join(folder, id+'.tmp');
          const dest = path.join(folder, id+'.pdf');
          await writeFile(tmp, buffer, {flag:'wx'});
          await rename(tmp,dest);
          try {const document = await store.addDocument({id,name,size:buffer.length}); return json(res,201,{document});}
          catch(error) {await unlink(dest).catch(()=>{}); throw error;}
        }
        if (req.method==='GET' && url.pathname.startsWith('/api/documents/')) {
          const id = url.pathname.slice('/api/documents/'.length);
          if (!store.findDocument(id)) return json(res,404,{error:'Document not found'});
          return send(res,200,await readFile(path.join(DATA,'documents',id+'.pdf')),'application/pdf');
        }
        if (req.method==='GET' && url.pathname==='/api/project/tree') return json(res,200,{files:projectRoot?await projectTree():[],connected:!!projectRoot});
        if (req.method==='GET' && url.pathname==='/api/project/file') {
          const file=await allowedProjectFile(url.searchParams.get('path'));
          const ext=path.extname(file).toLowerCase();
          return send(res,200,await readFile(file),EXT[ext] || 'application/octet-stream');
        }
        if (req.method==='PATCH' && url.pathname==='/api/state') {
          const result=await store.applyPatch(await readBody(req));
          broadcast({type:'state.patch',state:result});
          return json(res,200,{ok:true, state:result});
        }
        if (req.method==='POST' && url.pathname==='/api/elements') {
          const element=await readBody(req);
          const added=await store.upsertElement(element);
          if(added) broadcast({type:'element.add',element});
          return json(res,200,{ok:true,id:element.id,added});
        }
        return json(res,404,{error:'Unknown route'});
      }
      if (req.method!=='GET' && req.method!=='HEAD') return json(res,405,{error:'Method not allowed'});
      const base=url.pathname==='/'?'/index.html':url.pathname;
      const resolved=path.resolve(PUBLIC,'.'+decodeURIComponent(base));
      if (!resolved.startsWith(PUBLIC + path.sep)) return json(res,403,{error:'Forbidden'});
      const mime=EXT[path.extname(resolved)] || 'application/octet-stream';
      const bytes=await readFile(resolved);
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' ws: wss:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'"});
      res.end(req.method==='HEAD'?undefined:bytes);
    } catch(e) {
      const expected=['Invalid','outside','Unsupported','too large','not configured','File too large'];
      const bad=expected.some(x=>e.message.includes(x));
      json(res,bad?400:e.code==='ENOENT'?404:500,{error:bad?e.message:e.code==='ENOENT'?'Not found':'Internal server error'});
      if (!bad && e.code!=='ENOENT') console.error(e);
    }
  });
  server.on('upgrade',(req,socket,head)=>{
    let url;
    try { url=new URL(req.url,`http://${req.headers.host}`); } catch { socket.destroy(); return; }
    if(url.pathname!=='/ws'||!sameOrigin(req)||!authenticated(req,url)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return; }
    const peer=acceptSocket(req,socket,head,async (msg,source)=>{
      if(msg?.type==='element.add') {
        try { const added=await store.upsertElement(msg.element); if(added) broadcast({type:'element.add',element:msg.element},source); source.send({type:'element.ack',id:msg.element.id}); }
        catch { source.send({type:'error',message:'Element rejected'}); }
      } else if(msg?.type==='stroke.preview') {
        if(typeof msg.id==='string' && Array.isArray(msg.points) && msg.points.length<=128) broadcast(msg,source);
      }
    },peer=>peers.delete(peer));
    if(peer){peers.add(peer);peer.send({type:'hello',time:Date.now()});}
  });
  await new Promise(resolve=>server.listen(port,host,resolve));
  const address=server.address();
  console.log(`\n  STUDY OS · http://localhost:${address.port}`);
  console.log(`  research: ${projectRoot || 'not linked (set STUDYOS_RESEARCH_DIR)'}`);
  if(PUBLIC.endsWith('/legacy') || PUBLIC.endsWith('\\legacy')) console.log('  legacy fallback: run npm install && npm run build for WebGL/PDF.js frontend');
  if(host==='0.0.0.0' || host==='::') console.log(`  tablet access token: ${token} (LAN only; keep private)`);
  console.log('  stop with Ctrl+C\n');
  return {server,port:address.port,store,token};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start();
