import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'.automation','cpolar');
const configFile=path.join(directory,'config.yml'),stateFile=path.join(directory,'process.json');
const logFile=path.join(directory,'stdout.log'),accessFile=path.join(directory,'access.json');
const read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const mode=process.argv[2]||'status';
fs.mkdirSync(directory,{recursive:true});
if(mode==='setup'){
  if(alive(read(stateFile)?.pid))throw new Error('Stop this project tunnel before changing its configuration');
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  process.stdout.write('Ready for cpolar token on stdin (input hidden):\n');
  let input='';for await(const chunk of process.stdin){input+=chunk.toString();if(/[\r\n]/.test(input))break;}
  if(process.stdin.isTTY)process.stdin.setRawMode(false);
  const token=input.trim();if(!/^[A-Za-z0-9_=-]{20,256}$/.test(token))throw new Error('Invalid token format');
  const access=read(accessFile)||{username:'tester',password:randomBytes(18).toString('base64url')};
  fs.writeFileSync(accessFile,JSON.stringify(access,null,2),{mode:0o600});
  fs.writeFileSync(configFile,`authtoken: ${token}\nregion: cn\nconsole_ui: false\nhttp_proxy: false\nweb_addr: 127.0.0.1:4048\ntunnels:\n  roadbook-test:\n    proto: http\n    addr: 127.0.0.1:3010\n    auth: "${access.username}:${access.password}"\n    bind_tls: true\n    inspect: false\n    region: cn\n`,{mode:0o600});
  console.log('Local configuration ready. Token and test password were not printed.');
}else if(mode==='start'){
  const prior=read(stateFile);if(prior&&alive(prior.pid)){console.log('Project tunnel process is already running; use status.');process.exit(0);}
  if(!fs.existsSync(configFile))throw new Error('Run setup first');
  const executable=process.env.CPOLAR_BIN||'D:/cpolar.exe';
  fs.writeFileSync(logFile,'');
  const savedAccess=read(accessFile);if(savedAccess){delete savedAccess.url;fs.writeFileSync(accessFile,JSON.stringify(savedAccess,null,2),{mode:0o600});}
  const out=fs.openSync(path.join(directory,'stdout.log'),'a'),err=fs.openSync(path.join(directory,'stderr.log'),'a');
  // Credentials are read from the ignored config, never from process arguments.
  const child=spawn(executable,['start',`-config=${configFile}`,'-log=stdout','-log-level=INFO','-daemon=on','-processMode=single','-inspect-addr=127.0.0.1:4048','-dashboard=off','roadbook-test'],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,err]});
  child.unref();fs.closeSync(out);fs.closeSync(err);
  fs.writeFileSync(stateFile,JSON.stringify({pid:child.pid,startedAt:new Date().toISOString()},null,2));
  console.log(JSON.stringify({started:true,pid:child.pid}));
}else if(mode==='status'){
  const state=read(stateFile),access=read(accessFile);
  let log='';try{log=fs.readFileSync(logFile,'utf8');}catch{}
  const lines=log.split(/\r?\n/),urls=[...new Set(lines.filter(l=>/start.*tunnel|tunnel.*start|tunnel established|url=/i.test(l)).flatMap(l=>l.match(/https:\/\/[^\s"<>]+/g)||[]))];
  const url=urls.at(-1);
  if(url&&access){
    access.url=`${url.replace(/\/$/,'')}/agent/`;fs.writeFileSync(accessFile,JSON.stringify(access,null,2),{mode:0o600});
    fs.writeFileSync(path.join(directory,'测试访问信息.txt'),`旅行智能体临时测试入口\n\n网址：${access.url}\n账号：${access.username}\n访问口令：${access.password}\n\n只向受邀测试者分享以上三项。这里的访问口令不是cpolar authtoken。\n\n本机必须开机、联网且不休眠。网站服务与cpolar后台进程均须运行。免费网址会变化；在项目目录执行 npm.cmd run share:status 查看新地址。\n停止对外访问：npm.cmd run share:stop\n重新开放：npm.cmd run share:start ，稍后执行 npm.cmd run share:status\n本机原入口：http://localhost:3010/agent/\n`,{mode:0o600});
  }
  console.log(JSON.stringify({running:Boolean(state&&alive(state.pid)),pid:state?.pid,url:access?.url||url,accessFile,errors:lines.filter(l=>/lvl=eror|level=error|ERR_/i.test(l)).slice(-3).map(l=>l.replace(/authtoken[^\s]*/gi,'[redacted]'))},null,2));
}else if(mode==='stop'){
  const state=read(stateFile);if(state&&alive(state.pid)){process.kill(state.pid);console.log('Stopped this project tunnel.');}else console.log('Project tunnel is not running.');
}else throw new Error('Use setup, start, status or stop');
