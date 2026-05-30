import { config } from '../config.js';

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: config.evolution.apiKey,
});

/** Envia mensagem de texto para um número ou JID de grupo. */
export async function sendText(to, text) {
  const url = `${config.evolution.baseUrl}/message/sendText/${config.evolution.instance}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: to, text }),
  });
  if (!res.ok) throw new Error(`Evolution sendText ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Apaga uma mensagem para todos. Exige que o bot seja ADMIN do grupo.
 * @param {{id:string, remoteJid:string, fromMe:boolean, participant?:string}} key
 */
export async function deleteMessage(key) {
  const url = `${config.evolution.baseUrl}/chat/deleteMessageForEveryone/${config.evolution.instance}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify(key),
  });
  if (!res.ok) throw new Error(`Evolution delete ${res.status}: ${await res.text()}`);
  return res.json();
}
