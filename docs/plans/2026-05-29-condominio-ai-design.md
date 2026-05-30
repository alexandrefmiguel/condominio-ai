# Condomínio AI — Consulta ao Regimento Interno via WhatsApp

**Data:** 2026-05-29
**Contexto:** Atividade extensionista — automatizar a consulta ao regimento interno de um condomínio residencial usando IA, atuando dentro de um grupo de WhatsApp dos moradores.

## Objetivos (da atividade)

- Agente de IA capaz de interpretar perguntas dos moradores.
- Consulta automatizada ao regimento interno.
- Acesso às regras por linguagem natural.
- Reduzir dúvidas recorrentes e a dependência do síndico/administração.
- Validar a eficácia por meio de testes com moradores.

## Escopo da entrega

Sistema funcional rodando no WhatsApp (não apenas proposta escrita). Demonstração com um grupo real usando um chip de teste dedicado.

## Arquitetura

```
Morador no grupo WhatsApp
        │  (manda mensagem)
        ▼
┌─────────────────────┐   webhook    ┌──────────────────────┐
│   Evolution API     │ ───────────► │   Bot (Node/Express) │
│  (Docker @ Railway) │              │   (Node @ Railway)   │
│  - pareia o chip    │ ◄─────────── │  - recebe webhook    │
│  - envia/recebe msg │  send-text   │  - classifica msg    │
│  - apaga msg (admin)│  delete-msg  │  - chama OpenAI      │
└─────────┬───────────┘              │  - modera + registra │
          │                          └──────────┬───────────┘
          ▼                                      │
   Supabase (Postgres)                           ▼
   - sessão Evolution                      OpenAI gpt-4o-mini
   - tabelas do projeto              (regimento no system prompt,
                                       só na chamada de resposta)
```

### Decisões-chave

- **Sem RAG / sem banco vetorial.** Um único regimento (~15–50 páginas ≈ até ~33k tokens) cabe folgado na janela de 128k do `gpt-4o-mini`. Mandar o documento inteiro no system prompt é mais simples e mais preciso. RAG só valeria com 100+ páginas / múltiplos documentos longos.
- **OpenAI `gpt-4o-mini`** — custo de centavos por pergunta; prompt caching automático do prefixo estático (regimento).
- **Dois serviços no Railway** — Evolution API (imagem Docker `atendai/evolution-api`) + o Bot (Node).
- **Supabase** como Postgres — usado pela Evolution (sessão) e pelas tabelas do projeto.

## Fluxo de mensagens — o bot tem 3 papéis

Toda mensagem do grupo passa por uma triagem. O bot **responde** apenas quando chamado, mas **observa** todas as mensagens para moderar e detectar reclamações.

```
Mensagem chega no grupo
        │
        ▼
 (pré-filtro regex de palavrão — atalho barato)
        │
        ▼
 ┌──────────────────┐
 │  Classificador   │  gpt-4o-mini, prompt pequeno (~300 tokens, SEM regimento)
 └──────────────────┘
        │
        ├─ PERGUNTA e o bot foi chamado (@menção ou "Zelador, ...")?
        │     → chamada com regimento → responde citando o artigo
        │       (ou escala pro síndico se não consta)
        │
        ├─ RECLAMAÇÃO? → não responde no grupo; registra em `reclamacoes`
        │
        └─ OFENSA/PALAVRÃO? → modera (avisa + registra; apaga só se confiança alta)
```

### Por que duas chamadas de tamanhos diferentes

- **Classificador** roda em toda mensagem, mas **não carrega o regimento** (~300 tokens). Barato e rápido.
- **Resposta com regimento** (~33k tokens) só dispara quando é pergunta dirigida ao bot — uma fração das mensagens.
- **Prompt caching:** o prefixo estático (diretrizes + regimento) vem primeiro e é sempre igual → a partir da 2ª pergunta sai ~50% mais barato e mais rápido. A pergunta variável vai no final.

## Guardrails

- A IA responde **apenas** sobre o condomínio/regimento. Perguntas fora de escopo recebem recusa educada.
- Quando o regimento não cobre a dúvida, **não inventa**: avisa que não consta e sugere falar com a administração/síndico.
- Toda resposta de regra **cita o artigo/seção** como fonte.

## Moderação (comportamento conservador)

- O chip do bot precisa ser **administrador do grupo** no WhatsApp para apagar mensagens de terceiros (`deleteMessageForEveryone`).
- Padrão conservador: **sempre avisa + registra** a infração; **apaga de fato apenas com confiança alta** (palavrão explícito). Reduz falso positivo (ironia/gíria regional) e gera dado para o relatório.
- Toda ação de moderação é logada com o nível de confiança.

## Modelo de dados (Supabase)

Além das tabelas que a Evolution cria sozinha:

**mensagens_log**
- id, telefone_usuario, nome, texto, tipo (pergunta/reclamacao/ofensa/irrelevante), respondida (bool), artigo_citado, criado_em

**reclamacoes**
- id, telefone_usuario, nome, texto, assunto (vaga/barulho/pet/...), criado_em

**infracoes**
- id, telefone_usuario, nome, texto_original, tipo, acao (avisado/apagado), confianca (0–1), criado_em

## Relatórios (validação de eficácia)

Endpoint `GET /relatorio` (ou página de 1 tela) entrega:

- Total de perguntas e **% respondidas pela IA** vs. escaladas → *redução de dependência*.
- **Top dúvidas recorrentes** agrupadas por assunto → *reduzir dúvidas recorrentes*.
- **Reclamações por assunto** e usuários que mais reclamam.
- **Infrações**: quantas sinalizadas, quantas apagadas, por usuário.

Esses números são a evidência de "validar a eficácia" pedida pela atividade.

## Stack final

- **Evolution API** (Docker @ Railway) — conexão WhatsApp.
- **Bot** Node.js 24 + Express (@ Railway) — webhook, classificação, OpenAI, moderação, relatórios.
- **OpenAI** `gpt-4o-mini` — classificar + responder; regimento no system prompt; prompt caching.
- **Supabase** (Postgres) — sessão Evolution + tabelas do projeto.
- Sem RAG, sem banco vetorial.

## Riscos / notas

- API não-oficial do WhatsApp → usar **chip de teste**, não número pessoal (risco de ban).
- Apagar mensagem exige o bot **admin** do grupo.
- Detecção de ofensa em PT-BR erra → manter comportamento conservador + log.
- Variáveis sensíveis (OPENAI_API_KEY, credenciais Evolution/Supabase) só em env, nunca no git.
