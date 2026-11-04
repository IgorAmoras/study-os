import { spawn } from 'node:child_process';
const processes=[];
const run=(args)=>{
  const p=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,STUDYOS_HOST:'127.0.0.1'}});
  processes.push(p);p.on('exit',(code)=>{if(code!==0)shutdown(code||1);});return p;
};
function shutdown(code=0){for(const p of processes)if(!p.killed)p.kill();process.exitCode=code;}
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
run(['--watch','server/index.mjs']);
run(['node_modules/vite/bin/vite.js','--host','127.0.0.1']);
