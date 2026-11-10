import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2]||'status';
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const port=Number(arg('--port')||3010);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local service port');
let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(root,'.automation','service','build.json'),'utf8'));}catch{}
const distDir=arg('--dist-dir')||manifest?.distDir||'.next-service';
if(!/^\.next(?:-[a-z0-9-]+)?$/.test(distDir))throw new Error('Build directory must be a project-local .next directory');
const directory=path.join(root,'.automation','service');fs.mkdirSync(directory,{recursive:true});
const stateFile=path.join(directory,`${port}.json`),lockFile=path.join(directory,`${port}.lock`),stopFile=path.join(directory,`${port}.stop`);
const read=filename=>{try{return JSON.parse(fs.readFileSync(filename,'utf8'));}catch{return null;}};
const alive=pid=>{if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function health(){try{const response=await fetch(`http://127.0.0.1:${port}/api/health/?probe=${Date.now()}`,{headers:{Connection:'close','Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(2500)});if(!response.ok){await response.body?.cancel();return null;}const data=await response.json();return data.service==='dynamic-roadbook'&&data.status==='ready'?data:null;}catch{return null;}}
async function status(){const state=read(stateFile),ready=await health();return {running:Boolean(ready&&state?.instance===ready.instance&&alive(state.supervisorPid)),url:`http://localhost:${port}/agent/`,...state,health:ready};}
function log(message){fs.appendFileSync(path.join(directory,`${port}.supervisor.log`),`${new Date().toISOString()} ${message}\n`);}

if(mode==='status')console.log(JSON.stringify(await status(),null,2));
else if(mode==='restart'){
 for(const action of ['stop','start']){const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),action,'--port',String(port),'--dist-dir',distDir],{cwd:root,stdio:'inherit',windowsHide:true});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);}
}
else if(mode==='start'){
 const current=await status();if(current.running){console.log(JSON.stringify(current,null,2));process.exit(0);}
 if(alive(read(lockFile)?.pid))throw new Error('Supervisor already exists but is not ready; inspect .automation/service logs');
 if(!fs.existsSync(path.join(root,distDir,'BUILD_ID')))throw new Error(`Build ${distDir} first: set NEXT_DIST_DIR=${distDir} and run npm run build`);
 const out=fs.openSync(path.join(directory,`${port}.supervisor.out.log`),'a'),err=fs.openSync(path.join(directory,`${port}.supervisor.err.log`),'a');
 const supervisor=spawn(process.execPath,[fileURLToPath(import.meta.url),'supervise','--port',String(port),'--dist-dir',distDir],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,err]});
 supervisor.unref();fs.closeSync(out);fs.closeSync(err);
 for(let n=0;n<45;n++){await delay(1000);const ready=await status();if(ready.running){console.log(JSON.stringify(ready,null,2));process.exit(0);}if(n%10===0)log(`startup check parent=${process.pid} supervisor=${supervisor.pid} stored=${ready.instance||'none'} observed=${ready.health?.instance||'none'} running=${ready.running}`);if(!alive(supervisor.pid))throw new Error('Supervisor exited; see .automation/service logs');}
 throw new Error('Service startup timed out; inspect .automation/service logs');
}else if(mode==='stop'){
 const state=read(stateFile);if(!state||!alive(state.supervisorPid)){console.log('No running supervisor');process.exit(0);}
 fs.writeFileSync(stopFile,JSON.stringify({instance:state.instance}));
 for(let n=0;n<20;n++){await delay(500);if(!alive(state.supervisorPid)){console.log('Service stopped');process.exit(0);}}
 throw new Error('Stop request is pending; no unrelated process was terminated');
}else if(mode==='supervise'){
 const prior=read(lockFile);if(alive(prior?.pid))throw new Error('Another supervisor owns this port');
 if(prior)fs.unlinkSync(lockFile);
 const instance=randomUUID();fs.writeFileSync(lockFile,JSON.stringify({pid:process.pid,instance}),{flag:'wx'});
 let child=null,stopping=false,restarts=0,failures=0,busy=false,started=0,interval;
 const writeState=status=>fs.writeFileSync(stateFile,JSON.stringify({supervisorPid:process.pid,childPid:child?.pid??null,instance,port,distDir,status,restarts,startedAt:new Date(started||Date.now()).toISOString()},null,2));
 const launch=()=>{
  if(stopping)return;
  const out=fs.openSync(path.join(directory,`${port}.server.out.log`),'a'),err=fs.openSync(path.join(directory,`${port}.server.err.log`),'a');
  started=Date.now();failures=0;
  const worker=spawn(process.execPath,[path.join(root,'node_modules','next','dist','bin','next'),'start','-H','127.0.0.1','-p',String(port)],{cwd:root,windowsHide:true,stdio:['ignore',out,err],env:{...process.env,NEXT_DIST_DIR:distDir,ROADBOOK_SERVICE_INSTANCE:instance}});
  child=worker;fs.closeSync(out);fs.closeSync(err);writeState('starting');log(`child started pid=${worker.pid}`);
  worker.on('error',error=>log(`child launch error ${error.code||'unknown'}`));
  worker.once('exit',(code)=>{log(`child exited code=${code}`);if(child===worker)child=null;if(stopping)return;restarts++;writeState('restarting');setTimeout(launch,Math.min(10000,1000*restarts));});
 };
 const shutdown=()=>{if(stopping)return;stopping=true;clearInterval(interval);if(child)child.kill();writeState('stopped');if(read(lockFile)?.instance===instance)fs.unlinkSync(lockFile);if(read(stopFile)?.instance===instance)fs.unlinkSync(stopFile);setTimeout(()=>process.exit(0),500);};
 process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
 process.on('uncaughtException',error=>{log(`supervisor error ${error.code||error.name}`);shutdown();});
 launch();
 interval=setInterval(async()=>{
  if(read(stopFile)?.instance===instance){shutdown();return;}
  if(busy||!child)return;busy=true;
  try{const ready=await health();if(ready?.instance===instance){failures=0;writeState('ready');}else if(Date.now()-started>20000&&++failures>=3){log('health check failed; restarting owned child');child.kill();}}
  finally{busy=false;}
 },3000);
}else throw new Error('Use start, restart, status or stop');
