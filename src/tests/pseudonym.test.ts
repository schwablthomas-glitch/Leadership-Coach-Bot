// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { pseudonymize } from '../core/pseudonym.js';

test('pseudonymize ist deterministisch', () => {
  const a = pseudonymize('user-123', 'salt');
  const b = pseudonymize('user-123', 'salt');
  assert.equal(a, b);
});

test('pseudonymize ändert sich bei anderem Salt', () => {
  const a = pseudonymize('user-123', 'salt-a');
  const b = pseudonymize('user-123', 'salt-b');
  assert.notEqual(a, b);
});
