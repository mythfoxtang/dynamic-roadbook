import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const distDir=`.next-service-${Date.now()}`;
const result=spawnSync(process.execPath,[path.join(root,'node_modules','next','dist','bin','next'),'build'],{cwd:root,env:{...process.env,NEXT_DIST_DIR:distDir},stdio:'inherit'});
if(result.error)throw result.error;
if(result.status===0){const directory=path.join(root,'.automation','service');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'build.json'),JSON.stringify({distDir,builtAt:new Date().toISOString()},null,2));console.log('Service build ready; restart the service to use it. Running build was preserved.');}
process.exit(result.status??1);
