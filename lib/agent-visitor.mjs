import {randomBytes} from 'node:crypto';
export const VISITOR_COOKIE='roadbook_agent_visitor';
export function agentVisitor(value){return typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:randomBytes(32).toString('hex');}
