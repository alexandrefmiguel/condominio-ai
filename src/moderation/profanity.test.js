import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasExplicitProfanity } from './profanity.js';

test('detecta palavrão explícito', () => {
  assert.equal(hasExplicitProfanity('seu merda'), true);
});

test('detecta xingamento direto', () => {
  assert.equal(hasExplicitProfanity('seu babaca'), true);
});

test('texto limpo passa', () => {
  assert.equal(hasExplicitProfanity('a quadra está liberada?'), false);
});

test('não casa substring de palavra inocente', () => {
  assert.equal(hasExplicitProfanity('o lixeiro passou cedo'), false);
});

test('reclamação sobre lixo NÃO é palavrão', () => {
  assert.equal(hasExplicitProfanity('o lixo não foi recolhido hoje'), false);
});

test('palavra "desgraça" em desabafo NÃO é palavrão', () => {
  assert.equal(hasExplicitProfanity('que desgraça de chuva'), false);
});
