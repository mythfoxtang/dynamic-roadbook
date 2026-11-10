import {createHash} from 'node:crypto';
import {readTravelPrivate,writeTravelPrivate} from './travel-vault.mjs';
const states=globalThis.__journeyAgentStates||(globalThis.__journeyAgentStates=new Map(readTravelPrivate('agent-states',[])));
const owner=(id,config)=>createHash('sha256').update(id||config.apiKey).digest('hex');
export function readAgentState(id,config){const item=states.get(owner(id,config));return item&&item.expiresAt>Date.now()?item.state:null;}
export function saveAgentState(id,config,state){
  for(const [key,item] of states)if(item.expiresAt<=Date.now())states.delete(key);
  const key=owner(id,config);if(!states.has(key)&&states.size>=100)states.delete(states.keys().next().value);
  states.set(key,{state,expiresAt:Date.now()+30*86400000});writeTravelPrivate('agent-states',[...states]);
}
