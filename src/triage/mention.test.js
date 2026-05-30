import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wasBotCalled } from './mention.js';

const triggers = ['zelador', 'bot'];

test('detecta prefixo trigger ignorando caixa/acentos', () => {
  assert.equal(wasBotCalled('Zelador, posso ter cachorro?', triggers, false), true);
});

test('detecta menção ao número do bot', () => {
  assert.equal(wasBotCalled('e a piscina?', triggers, true), true);
});

test('mensagem normal não chama o bot', () => {
  assert.equal(wasBotCalled('bom dia pessoal', triggers, false), false);
});

test('trigger no meio com @ também conta', () => {
  assert.equal(wasBotCalled('alguém sabe @bot se pode pet?', triggers, false), true);
});
