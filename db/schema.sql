-- Tabelas do projeto Condomínio AI (rodar contra o Postgres do Supabase).
-- A Evolution API cria as próprias tabelas separadamente.

create table if not exists mensagens_log (
  id bigserial primary key,
  telefone_usuario text not null,
  nome text,
  texto text not null,
  tipo text not null,            -- pergunta | reclamacao | ofensa | irrelevante
  respondida boolean not null default false,
  artigo_citado text,
  criado_em timestamptz not null default now()
);

create table if not exists reclamacoes (
  id bigserial primary key,
  telefone_usuario text not null,
  nome text,
  texto text not null,
  assunto text,                  -- barulho | vaga | pet | lixo | ...
  criado_em timestamptz not null default now()
);

create table if not exists infracoes (
  id bigserial primary key,
  telefone_usuario text not null,
  nome text,
  texto_original text not null,
  tipo text not null,            -- ofensa
  acao text not null,            -- avisado | apagado
  confianca real,
  criado_em timestamptz not null default now()
);

create index if not exists idx_mensagens_tipo on mensagens_log (tipo);
create index if not exists idx_reclamacoes_assunto on reclamacoes (assunto);
create index if not exists idx_infracoes_usuario on infracoes (telefone_usuario);
