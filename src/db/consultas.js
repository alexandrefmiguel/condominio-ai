import { pool } from './pool.js';

// Conversas recentes (perguntas e reclamações com a resposta dada pelo bot).
export async function listarConversas(limite = 50) {
  const { rows } = await pool.query(
    `select id, nome, telefone_usuario, texto, tipo, resposta, criado_em
     from mensagens_log
     where tipo in ('pergunta','reclamacao')
     order by criado_em desc
     limit $1`,
    [limite],
  );
  return rows;
}

export async function listarReclamacoes(limite = 100) {
  const { rows } = await pool.query(
    `select id, nome, telefone_usuario, texto, assunto, criado_em
     from reclamacoes order by criado_em desc limit $1`,
    [limite],
  );
  return rows;
}

export async function listarInfracoes(limite = 100) {
  const { rows } = await pool.query(
    `select id, nome, telefone_usuario, texto_original, tipo, acao, confianca, criado_em
     from infracoes order by criado_em desc limit $1`,
    [limite],
  );
  return rows;
}
