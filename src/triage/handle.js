import { wasBotCalled } from './mention.js';
import { decideModeration } from '../moderation/decide.js';

/**
 * Orquestra o que fazer com uma mensagem do grupo. Dependências são injetadas
 * para permitir testar sem rede (classify, answer, sendText, deleteMessage, repo).
 *
 * @param {{texto:string, telefone:string, nome:string|null, mentionsBot:boolean, groupJid:string, key:object}} msg
 * @param {object} deps
 */
export async function handleMessage(msg, deps) {
  const c = await deps.classify(msg.texto);

  // 1. Moderação — observa TODAS as mensagens.
  if (c.tipo === 'ofensa') {
    const { acao } = decideModeration(c, deps.deleteThreshold);
    if (acao === 'apagado') {
      await deps.deleteMessage(msg.key);
    }
    await deps.logInfracao({
      telefone: msg.telefone, nome: msg.nome, texto: msg.texto,
      tipo: 'ofensa', acao, confianca: c.confianca,
    });
    const aviso = acao === 'apagado'
      ? '⚠️ Uma mensagem foi removida por linguagem ofensiva, em desacordo com as diretrizes de convivência do condomínio.'
      : '⚠️ Atenção: vamos manter o respeito conforme as diretrizes de convivência do condomínio.';
    await deps.sendText(msg.groupJid, aviso);
    await deps.logMensagem({
      telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: 'ofensa', respondida: false,
    });
    return;
  }

  // 2. Reclamação — registra para métricas E confirma o recebimento no grupo.
  if (c.tipo === 'reclamacao') {
    await deps.logReclamacao({
      telefone: msg.telefone, nome: msg.nome, texto: msg.texto, assunto: c.assunto,
    });
    await deps.sendText(
      msg.groupJid,
      '📝 Sua reclamação foi anotada! Vamos verificar com a equipe e tomar as providências necessárias. Obrigado por avisar.',
    );
    await deps.logMensagem({
      telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: 'reclamacao', respondida: true,
    });
    return;
  }

  // 3. Pergunta — só responde se o bot foi chamado (evita spam no grupo).
  if (c.tipo === 'pergunta' && wasBotCalled(msg.texto, deps.triggers, msg.mentionsBot)) {
    const resposta = await deps.answer(msg.texto);
    await deps.sendText(msg.groupJid, resposta);
    await deps.logMensagem({
      telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: 'pergunta', respondida: true,
    });
    return;
  }

  // 4. Irrelevante, ou pergunta não dirigida ao bot — apenas registra.
  await deps.logMensagem({
    telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: c.tipo, respondida: false,
  });
}
