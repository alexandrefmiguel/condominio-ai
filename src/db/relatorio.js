import { pool } from './pool.js';

export async function gerarRelatorio() {
  const [perguntas, top, recl, reclUsers, infr] = await Promise.all([
    pool.query(
      `select count(*)::int total,
              count(*) filter (where respondida)::int respondidas,
              count(*) filter (where not respondida)::int escaladas
       from mensagens_log where tipo = 'pergunta'`,
    ),
    pool.query(
      `select texto, count(*)::int n
       from mensagens_log where tipo = 'pergunta'
       group by texto order by n desc limit 10`,
    ),
    pool.query(
      `select coalesce(nullif(assunto,''),'(sem assunto)') assunto, count(*)::int n
       from reclamacoes group by 1 order by n desc`,
    ),
    pool.query(
      `select coalesce(nome,'(desconhecido)') nome, telefone_usuario, count(*)::int n
       from reclamacoes group by nome, telefone_usuario order by n desc limit 10`,
    ),
    pool.query(
      `select count(*)::int total,
              count(*) filter (where acao = 'apagado')::int apagadas,
              count(*) filter (where acao = 'avisado')::int avisadas
       from infracoes`,
    ),
  ]);

  return {
    perguntas: perguntas.rows[0],
    top_duvidas: top.rows,
    reclamacoes_por_assunto: recl.rows,
    usuarios_que_mais_reclamam: reclUsers.rows,
    infracoes: infr.rows[0],
  };
}
