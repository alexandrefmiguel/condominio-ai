import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideModeration } from './decide.js';

test('ofensa com confiança alta → apaga', () => {
  assert.deepEqual(decideModeration({ tipo: 'ofensa', confianca: 0.95 }, 0.85), { acao: 'apagado' });
});

test('ofensa com confiança baixa → só avisa', () => {
  assert.deepEqual(decideModeration({ tipo: 'ofensa', confianca: 0.5 }, 0.85), { acao: 'avisado' });
});

test('ofensa exatamente no threshold → apaga', () => {
  assert.deepEqual(decideModeration({ tipo: 'ofensa', confianca: 0.85 }, 0.85), { acao: 'apagado' });
});

test('não-ofensa → nenhuma ação', () => {
  assert.deepEqual(decideModeration({ tipo: 'pergunta', confianca: 0.9 }, 0.85), { acao: 'nenhuma' });
});
