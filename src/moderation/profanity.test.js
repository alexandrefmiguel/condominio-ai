import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasExplicitProfanity } from './profanity.js';

test('detecta palavrão explícito', () => {
  assert.equal(hasExplicitProfanity('seu merda'), true);
});

test('detecta palavrão com acento/variação', () => {
  assert.equal(hasExplicitProfanity('que desgraça'), true);
});

test('texto limpo passa', () => {
  assert.equal(hasExplicitProfanity('a quadra está liberada?'), false);
});

test('não casa substring de palavra inocente', () => {
  assert.equal(hasExplicitProfanity('o lixeiro passou cedo'), false);
});
