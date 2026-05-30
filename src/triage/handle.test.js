import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMessage } from './handle.js';

function deps(overrides = {}) {
  const calls = { sent: [], deleted: [], recl: [], infr: [], log: [] };
  return {
    calls,
    triggers: ['zelador'],
    deleteThreshold: 0.85,
    classify: async () => ({ tipo: 'pergunta', assunto: '', confianca: 0.9 }),
    answer: async () => 'Conforme Art. 96, sim.',
    sendText: async (to, t) => calls.sent.push({ to, t }),
    deleteMessage: async (k) => calls.deleted.push(k),
    logMensagem: async (m) => calls.log.push(m),
    logReclamacao: async (r) => calls.recl.push(r),
    logInfracao: async (i) => calls.infr.push(i),
    ...overrides,
  };
}

const base = {
  texto: 'Zelador, posso ter pet?', telefone: '5541888', nome: 'João',
  mentionsBot: false, groupJid: '123@g.us', key: { id: 'x' },
};

test('pergunta dirigida ao bot → responde no grupo e loga como respondida', async () => {
  const d = deps();
  await handleMessage(base, d);
  assert.equal(d.calls.sent.length, 1);
  assert.equal(d.calls.sent[0].to, '123@g.us');
  assert.equal(d.calls.log[0].respondida, true);
});

test('pergunta NÃO dirigida ao bot → não responde, só loga', async () => {
  const d = deps();
  await handleMessage({ ...base, texto: 'alguém sabe se pode pet?' }, d);
  assert.equal(d.calls.sent.length, 0);
  assert.equal(d.calls.log[0].respondida, false);
});

test('reclamação → confirma no grupo e registra reclamação', async () => {
  const d = deps({ classify: async () => ({ tipo: 'reclamacao', assunto: 'barulho', confianca: 0.8 }) });
  await handleMessage({ ...base, texto: 'o vizinho faz muito barulho' }, d);
  assert.equal(d.calls.sent.length, 1);              // agora confirma o recebimento
  assert.equal(d.calls.sent[0].to, '123@g.us');
  assert.match(d.calls.sent[0].t, /anotad/i);
  assert.equal(d.calls.recl.length, 1);
  assert.equal(d.calls.recl[0].assunto, 'barulho');
});

test('ofensa confiança alta → apaga, avisa e registra infração', async () => {
  const d = deps({ classify: async () => ({ tipo: 'ofensa', assunto: '', confianca: 0.95 }) });
  await handleMessage({ ...base, texto: 'seu merda' }, d);
  assert.equal(d.calls.deleted.length, 1);
  assert.equal(d.calls.infr[0].acao, 'apagado');
  assert.equal(d.calls.sent.length, 1);
});

test('ofensa confiança baixa → só avisa, não apaga', async () => {
  const d = deps({ classify: async () => ({ tipo: 'ofensa', assunto: '', confianca: 0.4 }) });
  await handleMessage({ ...base, texto: 'mensagem ambígua' }, d);
  assert.equal(d.calls.deleted.length, 0);
  assert.equal(d.calls.infr[0].acao, 'avisado');
  assert.equal(d.calls.sent.length, 1);
});

test('irrelevante → apenas loga', async () => {
  const d = deps({ classify: async () => ({ tipo: 'irrelevante', assunto: '', confianca: 0.9 }) });
  await handleMessage({ ...base, texto: 'bom dia pessoal' }, d);
  assert.equal(d.calls.sent.length, 0);
  assert.equal(d.calls.log[0].tipo, 'irrelevante');
});
