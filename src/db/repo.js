import { pool } from './pool.js';

export const logMensagem = (m) =>
  pool.query(
    `insert into mensagens_log (telefone_usuario, nome, texto, tipo, respondida, artigo_citado)
     values ($1,$2,$3,$4,$5,$6)`,
    [m.telefone, m.nome ?? null, m.texto, m.tipo, m.respondida ?? false, m.artigo ?? null],
  );

export const logReclamacao = (r) =>
  pool.query(
    `insert into reclamacoes (telefone_usuario, nome, texto, assunto) values ($1,$2,$3,$4)`,
    [r.telefone, r.nome ?? null, r.texto, r.assunto ?? null],
  );

export const logInfracao = (i) =>
  pool.query(
    `insert into infracoes (telefone_usuario, nome, texto_original, tipo, acao, confianca)
     values ($1,$2,$3,$4,$5,$6)`,
    [i.telefone, i.nome ?? null, i.texto, i.tipo, i.acao, i.confianca ?? null],
  );
