import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentVisitor} from './agent-visitor.mjs';
test('browser visitor IDs are distinct, opaque, stable and cannot contain arbitrary owner keys',()=>{
  const a=agentVisitor(),b=agentVisitor();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.equal(agentVisitor(a),a);assert.notEqual(agentVisitor('shared-server-api-key'),'shared-server-api-key');
});
