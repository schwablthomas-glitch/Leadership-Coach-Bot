// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { safetyRouter } from '../core/safety.js';

test('safetyRouter routed crisis to escalation', () => {
  const result = safetyRouter('Ich denke über Selbstmord nach.');
  assert.equal(result.route, 'escalation');
  assert.ok(result.text?.includes('Ich kann dabei nicht helfen'));
});

test('safetyRouter routed medical to escalation', () => {
  const result = safetyRouter('Ich brauche eine Diagnose und Medikamentenplan.');
  assert.equal(result.route, 'escalation');
});

test('safetyRouter keeps neutral coaching as coaching', () => {
  const result = safetyRouter('Wie delegiere ich besser im Team?');
  assert.equal(result.route, 'coaching');
});
