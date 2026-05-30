/**
 * Decide a ação de moderação a partir da classificação da mensagem.
 * Comportamento conservador: só apaga quando a confiança é alta; caso
 * contrário apenas avisa. Mensagens que não são ofensa não geram ação.
 * @param {{tipo: string, confianca: number}} classification
 * @param {number} deleteThreshold  confiança mínima para apagar (0..1)
 * @returns {{acao: 'apagado'|'avisado'|'nenhuma'}}
 */
export function decideModeration(classification, deleteThreshold) {
  if (classification.tipo !== 'ofensa') return { acao: 'nenhuma' };
  return { acao: classification.confianca >= deleteThreshold ? 'apagado' : 'avisado' };
}
