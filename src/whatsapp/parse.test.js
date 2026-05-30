import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebhook } from './parse.js';

const botJid = '5511999999999@s.whatsapp.net';

function groupPayload(text, { mentioned = [], fromMe = false } = {}) {
  return {
    event: 'messages.upsert',
    data: {
      key: { remoteJid: '12345@g.us', fromMe, id: 'ABC', participant: '5541888888888@s.whatsapp.net' },
      pushName: 'João',
      message: mentioned.length
        ? { extendedTextMessage: { text, contextInfo: { mentionedJid: mentioned } } }
        : { conversation: text },
    },
  };
}

test('extrai texto, telefone e nome de mensagem de grupo', () => {
  const r = parseWebhook(groupPayload('Zelador, posso ter pet?'), botJid);
  assert.equal(r.texto, 'Zelador, posso ter pet?');
  assert.equal(r.telefone, '5541888888888');
  assert.equal(r.nome, 'João');
  assert.equal(r.groupJid, '12345@g.us');
  assert.equal(r.mentionsBot, false);
});

test('detecta menção ao bot', () => {
  const r = parseWebhook(groupPayload('e a piscina?', { mentioned: [botJid] }), botJid);
  assert.equal(r.mentionsBot, true);
});

test('marca fromMe corretamente', () => {
  const r = parseWebhook(groupPayload('oi', { fromMe: true }), botJid);
  assert.equal(r.fromMe, true);
});

test('retorna null sem mensagem de texto', () => {
  assert.equal(parseWebhook({ data: { key: { remoteJid: 'x@g.us' } } }, botJid), null);
  assert.equal(parseWebhook({}, botJid), null);
});
