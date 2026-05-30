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

// Série diária dos últimos N dias (para o gráfico de atividade).
export async function serieDiaria(dias = 14) {
  const { rows } = await pool.query(
    `select to_char(date_trunc('day', criado_em), 'YYYY-MM-DD') as dia,
            count(*) filter (where tipo = 'pergunta')::int as perguntas,
            count(*) filter (where tipo = 'reclamacao')::int as reclamacoes
     from mensagens_log
     where criado_em >= (now() - make_interval(days => $1))
     group by 1 order by 1`,
    [dias],
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
