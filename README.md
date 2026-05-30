# Condomínio AI

Bot de WhatsApp que responde dúvidas dos moradores sobre o **regimento interno** do condomínio, detecta reclamações e modera ofensas — gerando dados de eficácia para acompanhamento.

Atividade extensionista: *Automatizar Consulta ao Regimento Interno com IA*.

## Como funciona

Cada mensagem do grupo passa por uma triagem feita com `gpt-4o-mini`:

- **Pergunta** dirigida ao bot (menção `@` ou prefixo como "Zelador, ...") → responde com base no regimento, **citando o artigo**. Se a dúvida não consta no regimento, orienta procurar o síndico.
- **Reclamação** → registra no banco (não responde no grupo) para virar métrica.
- **Ofensa/palavrão** → modera: sempre avisa e registra; **só apaga** com confiança alta (precisa ser admin do grupo).
- **Irrelevante** → apenas registra.

O regimento inteiro vai no system prompt (sem RAG — cabe folgado no contexto), com prompt caching da OpenAI nas chamadas repetidas.

## Arquitetura

```
WhatsApp ──► Evolution API (Docker) ──webhook──► Bot (Node/Express) ──► OpenAI gpt-4o-mini
                    │                                   │
              Supabase (Postgres) ◄────────────────────┘  (logs + métricas)
```

## Rodar local

```bash
pnpm install
cp .env.example .env   # preencha as chaves
pnpm test              # roda os testes (lógica pura)
pnpm dev               # sobe o servidor
```

## Banco

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## Deploy (Railway + Supabase)

1. **Supabase**: criar projeto → copiar a connection string (`DATABASE_URL`) → aplicar `db/schema.sql`.
2. **Railway — Evolution API**: novo serviço a partir da imagem `atendai/evolution-api:latest`. Variáveis principais:
   - `DATABASE_PROVIDER=postgresql`
   - `DATABASE_CONNECTION_URI=<connection string do Supabase>`
   - `AUTHENTICATION_API_KEY=<chave forte>` (vira `EVOLUTION_API_KEY`)
   - Expor porta pública → vira `EVOLUTION_BASE_URL`.
3. **Railway — Bot**: deploy deste repositório (usa o `Dockerfile`). Setar todas as variáveis do `.env.example`.
4. **Criar instância e parear o chip**:
   - `POST {EVOLUTION_BASE_URL}/instance/create` com `{ "instanceName": "condominio", "integration": "WHATSAPP-BAILEYS" }`.
   - Abrir `GET /instance/connect/condominio`, escanear o QR code com o **chip de teste**.
   - Configurar o webhook da instância apontando para `https://<bot>.up.railway.app/webhook`, evento `messages.upsert`.
   - Preencher `EVOLUTION_BOT_JID` com o JID do número do bot (`55DDDNUMERO@s.whatsapp.net`).
5. **Grupo**: adicionar o chip ao grupo e **promovê-lo a administrador** (necessário para apagar mensagens).
6. Colar o regimento real em `data/regimento.md` (já feito a partir do PDF) e fazer redeploy.

## Relatório de eficácia

`GET /relatorio` retorna JSON com:

- total de perguntas e **% respondidas pela IA** vs. escaladas ao síndico;
- **top dúvidas recorrentes**;
- reclamações por assunto e usuários que mais reclamam;
- infrações registradas (avisadas/apagadas).

## Notas

- Usar **chip de teste**, nunca número pessoal (API não-oficial → risco de ban).
- Moderação conservadora por padrão para reduzir falso positivo.
- Nunca commitar `.env` ou credenciais.
