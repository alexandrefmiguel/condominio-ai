function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Decide se o bot foi "chamado" numa mensagem do grupo.
 * @param {string} text   texto da mensagem
 * @param {string[]} triggers  palavras-chave que acionam o bot (ex: ["zelador","bot"])
 * @param {boolean} mentionsBot  true se o JID do bot foi mencionado (@) na mensagem
 */
export function wasBotCalled(text, triggers, mentionsBot) {
  if (mentionsBot) return true;
  const t = normalize(text);
  return triggers.some((tr) => {
    const n = normalize(tr);
    return t.startsWith(n) || t.includes(`@${n}`);
  });
}
