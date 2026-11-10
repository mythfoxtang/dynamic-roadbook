import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
test('encrypted AI sessions and owner-isolated journey state survive process restart; deletion persists',()=>{
 fs.mkdirSync('.automation',{recursive:true});const directory=fs.mkdtempSync(path.resolve('.automation/agent-state-test-'));
 const ai=pathToFileURL(path.resolve('lib/ai-config.mjs')).href,state=pathToFileURL(path.resolve('lib/travel-agent-state.mjs')).href;
 const run=source=>{const r=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:directory,env:{...process.env,NODE_ENV:'development'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const id=run(`import {saveAiSession} from ${JSON.stringify(ai)};import {saveAgentState} from ${JSON.stringify(state)};const config={provider:'DeepSeek',model:'deepseek-flash',apiKey:'not-a-real-test-secret',baseUrl:'https://api.deepseek.com'};const id=saveAiSession(config);saveAgentState(id,config,{plan:{title:'private-test'}});console.log(JSON.stringify(id));`);
 const restored=run(`import {resolveAiConfig} from ${JSON.stringify(ai)};import {readAgentState} from ${JSON.stringify(state)};const config=resolveAiConfig(${JSON.stringify(id)},{});console.log(JSON.stringify({configured:config?.apiKey==='not-a-real-test-secret',title:readAgentState(${JSON.stringify(id)},config)?.plan.title,other:readAgentState('other-browser',config)}));`);
 assert.deepEqual(restored,{configured:true,title:'private-test',other:null});
 for(const file of ['ai-sessions.enc','agent-states.enc'])assert.ok(!fs.readFileSync(path.join(directory,'.automation/travel-private',file)).includes(Buffer.from('not-a-real-test-secret')));
 run(`import {deleteAiSession} from ${JSON.stringify(ai)};deleteAiSession(${JSON.stringify(id)});console.log('true');`);
 assert.equal(run(`import {resolveAiConfig} from ${JSON.stringify(ai)};console.log(JSON.stringify(resolveAiConfig(${JSON.stringify(id)},{})));`),null);
});
