/**
 * Extrai os campos relevantes do payload `messages.upsert` da Evolution API v2.
 * Retorna null se não for uma mensagem de texto processável.
 *
 * @param {object} body  corpo do webhook
 * @param {string} botJid  JID do número do bot (para detectar menção)
 * @returns {null | {
 *   texto: string, telefone: string, nome: string|null,
 *   mentionsBot: boolean, fromMe: boolean,
 *   groupJid: string, key: object
 * }}
 */
export function parseWebhook(body, botJid) {
  const data = body?.data;
  if (!data?.key || !data.message) return null;

  const message = data.message;
  const texto =
    message.conversation ??
    message.extendedTextMessage?.text ??
    '';
  if (!texto) return null;

  const key = data.key;
  const remoteJid = key.remoteJid ?? '';
  const isGroup = remoteJid.endsWith('@g.us');

  // Em grupo, quem enviou é `participant`; em conversa direta, é o próprio remoteJid.
  const senderJid = key.participant ?? remoteJid;
  const telefone = senderJid.split('@')[0];

  const mentioned = message.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
  const mentionsBot = Boolean(botJid) && mentioned.includes(botJid);

  return {
    texto,
    telefone,
    nome: data.pushName ?? null,
    mentionsBot,
    fromMe: Boolean(key.fromMe),
    // Para onde responder: SEMPRE o JID original exato da conversa (grupo, número
    // ou @lid). Não remontar a partir do número — o WhatsApp usa @lid em alguns
    // casos e reconstruir como @s.whatsapp.net gera um destino inexistente.
    groupJid: remoteJid,
    isGroup,
    key,
  };
}
