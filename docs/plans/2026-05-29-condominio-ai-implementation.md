# Condomínio AI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bot de WhatsApp que responde dúvidas dos moradores sobre o regimento interno, detecta reclamações e modera ofensas, com relatórios de eficácia.

**Architecture:** Evolution API (Docker) recebe mensagens do grupo e dispara webhook para um bot Node/Express. O bot classifica cada mensagem com `gpt-4o-mini` (prompt pequeno, sem regimento); se for pergunta dirigida ao bot, faz uma 2ª chamada com o regimento inteiro no system prompt e responde citando o artigo. Reclamações e ofensas são registradas no Postgres (Supabase). Endpoint de relatório agrega os dados.

**Tech Stack:** Node.js 24 (ESM, JS puro), Express, OpenAI SDK, `pg` (node-postgres), `node:test` (built-in), dotenv. Sem RAG, sem banco vetorial. Deploy no Railway (2 serviços) + Supabase.

---

## Convenções

- **Diretório raiz:** `/Users/alexandrefreitasmiguel/Dev/condominio-ai`
- JS puro com ESM (`"type": "module"` no package.json). Sem passo de build.
- Lógica pura (classificação/parse, decisão de moderação, montagem de prompt, agregação de relatório) fica em módulos testáveis sem rede. Testa com `node:test`.
- Partes de rede (OpenAI, Evolution, Postgres) ficam isoladas atrás de funções finas; testadas manualmente na fase de deploy.
- Commits frequentes, mensagem em português, conventional commits.

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`
- Create: `src/config.js`
- Create: `.env.example`

**Step 1: package.json**

```json
{
  "name": "condominio-ai",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^5.1.0",
    "openai": "^4.77.0",
    "pg": "^8.13.1",
    "dotenv": "^16.4.7"
  }
}
```

**Step 2: Instalar**

Run: `cd /Users/alexandrefreitasmiguel/Dev/condominio-ai && pnpm install`
Expected: cria `node_modules` e `pnpm-lock.yaml` sem erro.

**Step 3: src/config.js** — lê env com defaults e valida o essencial.

```js
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  databaseUrl: process.env.DATABASE_URL,
  evolution: {
    baseUrl: process.env.EVOLUTION_BASE_URL,
    apiKey: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_INSTANCE,
  },
  // Como o bot é "chamado" no grupo: menção ou prefixo
  botTriggers: (process.env.BOT_TRIGGERS ?? 'zelador,sindico,bot').split(','),
  // Apaga mensagem ofensiva só acima deste nível de confiança
  moderationDeleteThreshold: Number(process.env.MODERATION_DELETE_THRESHOLD ?? 0.85),
};

export function assertConfig() {
  const required = ['OPENAI_API_KEY', 'DATABASE_URL', 'EVOLUTION_BASE_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
}
```

**Step 4: .env.example**

```
PORT=3000
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
DATABASE_URL=postgresql://user:pass@host:5432/postgres
EVOLUTION_BASE_URL=https://sua-evolution.up.railway.app
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=condominio
BOT_TRIGGERS=zelador,sindico,bot
MODERATION_DELETE_THRESHOLD=0.85
```

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/config.js .env.example
git commit -m "chore: scaffold do projeto (express, openai, pg)"
```

---

### Task 2: Detecção de "o bot foi chamado" (lógica pura)

**Files:**
- Create: `src/triage/mention.js`
- Test: `src/triage/mention.test.js`

**Step 1: Teste que falha**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wasBotCalled } from './mention.js';

const triggers = ['zelador', 'bot'];

test('detecta prefixo trigger ignorando caixa/acentos', () => {
  assert.equal(wasBotCalled('Zelador, posso ter cachorro?', triggers, false), true);
});

test('detecta menção ao número do bot', () => {
  assert.equal(wasBotCalled('@5511999999999 e a piscina?', triggers, true), true);
});

test('mensagem normal não chama o bot', () => {
  assert.equal(wasBotCalled('bom dia pessoal', triggers, false), false);
});
```

**Step 2: Rodar** — `pnpm test` → FALHA (`wasBotCalled` não existe).

**Step 3: Implementação**

```js
function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function wasBotCalled(text, triggers, mentionsBot) {
  if (mentionsBot) return true;
  const t = normalize(text);
  return triggers.some((tr) => t.startsWith(normalize(tr)) || t.includes(`@${normalize(tr)}`));
}
```

**Step 4: Rodar** — `pnpm test` → PASSA.

**Step 5: Commit** — `git commit -am "feat: detecção de chamada ao bot"`

---

### Task 3: Pré-filtro de palavrão (lógica pura)

**Files:**
- Create: `src/moderation/profanity.js`
- Test: `src/moderation/profanity.test.js`

**Step 1: Teste**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasExplicitProfanity } from './profanity.js';

test('detecta palavrão explícito', () => {
  assert.equal(hasExplicitProfanity('seu merda'), true);
});
test('texto limpo passa', () => {
  assert.equal(hasExplicitProfanity('a quadra está liberada?'), false);
});
```

**Step 2: Rodar** → FALHA.

**Step 3: Implementação** — lista enxuta + normalização. (Ajustável depois.)

```js
const WORDS = ['merda', 'porra', 'caralho', 'fdp', 'idiota', 'imbecil', 'otario', 'lixo'];

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function hasExplicitProfanity(text) {
  const t = normalize(text);
  return WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(t));
}
```

**Step 4: Rodar** → PASSA.

**Step 5: Commit** — `git commit -am "feat: pré-filtro de palavrão por regex"`

---

### Task 4: Decisão de moderação (lógica pura)

**Files:**
- Create: `src/moderation/decide.js`
- Test: `src/moderation/decide.test.js`

Regra: dado o resultado da classificação (`tipo`, `confianca`) e o threshold, decide a ação.

**Step 1: Teste**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideModeration } from './decide.js';

test('ofensa com confiança alta → apaga', () => {
  assert.deepEqual(decideModeration({ tipo: 'ofensa', confianca: 0.95 }, 0.85), { acao: 'apagado' });
});
test('ofensa com confiança baixa → só avisa', () => {
  assert.deepEqual(decideModeration({ tipo: 'ofensa', confianca: 0.5 }, 0.85), { acao: 'avisado' });
});
test('não-ofensa → nenhuma ação', () => {
  assert.deepEqual(decideModeration({ tipo: 'pergunta', confianca: 0.9 }, 0.85), { acao: 'nenhuma' });
});
```

**Step 2: Rodar** → FALHA.

**Step 3: Implementação**

```js
export function decideModeration(classification, deleteThreshold) {
  if (classification.tipo !== 'ofensa') return { acao: 'nenhuma' };
  return { acao: classification.confianca >= deleteThreshold ? 'apagado' : 'avisado' };
}
```

**Step 4: Rodar** → PASSA.

**Step 5: Commit** — `git commit -am "feat: decisão de moderação conservadora"`

---

### Task 5: Cliente OpenAI — classificador

**Files:**
- Create: `src/ai/client.js`
- Create: `src/ai/classify.js`

**Step 1: client.js**

```js
import OpenAI from 'openai';
import { config } from '../config.js';

export const openai = new OpenAI({ apiKey: config.openaiApiKey });
```

**Step 2: classify.js** — prompt PEQUENO, sem regimento. Pede JSON.

```js
import { openai } from './client.js';
import { config } from '../config.js';

const SYSTEM = `Você classifica mensagens de um grupo de WhatsApp de um condomínio.
Responda APENAS um JSON: {"tipo": "...", "assunto": "...", "confianca": 0..1}.
tipo ∈ ["pergunta","reclamacao","ofensa","irrelevante"].
- pergunta: dúvida sobre regras/regimento do condomínio.
- reclamacao: morador reclamando de algo (barulho, vaga, limpeza, pet, etc).
- ofensa: xingamento/agressão a alguém.
- irrelevante: bate-papo, saudação, figurinha, fora de escopo.
assunto: tema curto em uma palavra quando reclamacao/pergunta (ex: barulho, vaga, pet); senão "".
confianca: o quanto você tem certeza do tipo.`;

export async function classify(text) {
  const res = await openai.chat.completions.create({
    model: config.openaiModel,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: text },
    ],
  });
  const parsed = JSON.parse(res.choices[0].message.content);
  return {
    tipo: parsed.tipo ?? 'irrelevante',
    assunto: parsed.assunto ?? '',
    confianca: Number(parsed.confianca ?? 0),
  };
}
```

**Step 3: Commit** — `git commit -am "feat: classificador de mensagens (gpt-4o-mini)"`

> Teste real desta função ocorre na fase de deploy (precisa de chave). Lógica de parse já está coberta indiretamente pelos módulos puros.

---

### Task 6: Geração de resposta com regimento + guardrails

**Files:**
- Create: `data/regimento.md` (placeholder — o regimento real entra aqui)
- Create: `src/ai/answer.js`

**Step 1: data/regimento.md**

```
# Regimento Interno (COLE AQUI O REGIMENTO REAL)

Substitua este arquivo pelo texto integral do regimento interno do condomínio.
```

**Step 2: answer.js** — prefixo estático primeiro (cache), pergunta no final.

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openai } from './client.js';
import { config } from '../config.js';

const regimento = readFileSync(fileURLToPath(new URL('../../data/regimento.md', import.meta.url)), 'utf8');

const SYSTEM = `Você é o assistente virtual do condomínio. Responda em português, de forma curta e cordial, adequada a um grupo de WhatsApp.
REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base no regimento abaixo. Não use conhecimento externo.
2. Sempre cite a fonte: o artigo/seção do regimento em que se baseou.
3. Se a resposta NÃO estiver no regimento, diga que não consta e oriente procurar o síndico/administração. NUNCA invente.
4. Se a pergunta não for sobre o condomínio, recuse educadamente.

REGIMENTO INTERNO:
${regimento}`;

export async function answer(question) {
  const res = await openai.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM },   // estático → cacheado
      { role: 'user', content: question },     // variável → no final
    ],
  });
  return res.choices[0].message.content.trim();
}
```

**Step 3: Commit** — `git commit -am "feat: resposta com regimento e guardrails"`

---

### Task 7: Esquema do banco (Supabase/Postgres)

**Files:**
- Create: `db/schema.sql`
- Create: `src/db/pool.js`
- Create: `src/db/repo.js`

**Step 1: db/schema.sql**

```sql
create table if not exists mensagens_log (
  id bigserial primary key,
  telefone_usuario text not null,
  nome text,
  texto text not null,
  tipo text not null,
  respondida boolean not null default false,
  artigo_citado text,
  criado_em timestamptz not null default now()
);

create table if not exists reclamacoes (
  id bigserial primary key,
  telefone_usuario text not null,
  nome text,
  texto text not null,
  assunto text,
  criado_em timestamptz not null default now()
);

create table if not exists infracoes (
  id bigserial primary key,
  telefone_usuario text not null,
  nome text,
  texto_original text not null,
  tipo text not null,
  acao text not null,
  confianca real,
  criado_em timestamptz not null default now()
);
```

**Step 2: src/db/pool.js**

```js
import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false }, // Supabase
});
```

**Step 3: src/db/repo.js**

```js
import { pool } from './pool.js';

export const logMensagem = (m) =>
  pool.query(
    `insert into mensagens_log (telefone_usuario, nome, texto, tipo, respondida, artigo_citado)
     values ($1,$2,$3,$4,$5,$6)`,
    [m.telefone, m.nome, m.texto, m.tipo, m.respondida ?? false, m.artigo ?? null],
  );

export const logReclamacao = (r) =>
  pool.query(
    `insert into reclamacoes (telefone_usuario, nome, texto, assunto) values ($1,$2,$3,$4)`,
    [r.telefone, r.nome, r.texto, r.assunto ?? null],
  );

export const logInfracao = (i) =>
  pool.query(
    `insert into infracoes (telefone_usuario, nome, texto_original, tipo, acao, confianca)
     values ($1,$2,$3,$4,$5,$6)`,
    [i.telefone, i.nome, i.texto, i.tipo, i.acao, i.confianca],
  );
```

**Step 4: Aplicar schema** (na fase de deploy, contra o Supabase):
Run: `psql "$DATABASE_URL" -f db/schema.sql`

**Step 5: Commit** — `git commit -am "feat: esquema e repositório do banco"`

---

### Task 8: Cliente Evolution API (enviar texto / apagar mensagem)

**Files:**
- Create: `src/whatsapp/evolution.js`

**Step 1: evolution.js** — usa `fetch` nativo do Node 24.

```js
import { config } from '../config.js';

const headers = { 'Content-Type': 'application/json', apikey: config.evolution.apiKey };

export async function sendText(to, text) {
  const url = `${config.evolution.baseUrl}/message/sendText/${config.evolution.instance}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ number: to, text }) });
  if (!res.ok) throw new Error(`Evolution sendText ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function deleteMessage(key) {
  // key = { id, remoteJid, fromMe, participant } vindo do webhook
  const url = `${config.evolution.baseUrl}/chat/deleteMessageForEveryone/${config.evolution.instance}`;
  const res = await fetch(url, { method: 'DELETE', headers, body: JSON.stringify(key) });
  if (!res.ok) throw new Error(`Evolution delete ${res.status}: ${await res.text()}`);
  return res.json();
}
```

> Os nomes/rotas exatas serão confirmados contra a versão da Evolution no deploy (v2). Ajustar se necessário.

**Step 2: Commit** — `git commit -am "feat: cliente da Evolution API"`

---

### Task 9: Orquestrador da triagem (lógica de fluxo, testável)

**Files:**
- Create: `src/triage/handle.js`
- Test: `src/triage/handle.test.js`

A função `handleMessage` recebe a mensagem normalizada + dependências injetadas (classify, answer, repo, whatsapp) → orquestra. Injeção de dependência permite testar sem rede.

**Step 1: Teste (com mocks)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMessage } from './handle.js';

function deps(overrides = {}) {
  const calls = { sent: [], deleted: [], recl: [], infr: [], log: [] };
  return {
    calls,
    triggers: ['zelador'],
    deleteThreshold: 0.85,
    classify: async () => ({ tipo: 'pergunta', assunto: '', confianca: 0.9 }),
    answer: async () => 'Conforme Art. 5º, sim.',
    sendText: async (to, t) => calls.sent.push({ to, t }),
    deleteMessage: async (k) => calls.deleted.push(k),
    logMensagem: async (m) => calls.log.push(m),
    logReclamacao: async (r) => calls.recl.push(r),
    logInfracao: async (i) => calls.infr.push(i),
    ...overrides,
  };
}

const msg = { texto: 'Zelador, posso ter pet?', telefone: '5511', nome: 'João', mentionsBot: false, key: { id: 'x' } };

test('pergunta dirigida ao bot → responde e loga', async () => {
  const d = deps();
  await handleMessage(msg, d);
  assert.equal(d.calls.sent.length, 1);
  assert.equal(d.calls.log[0].respondida, true);
});

test('reclamação → não responde, registra', async () => {
  const d = deps({ classify: async () => ({ tipo: 'reclamacao', assunto: 'barulho', confianca: 0.8 }) });
  await handleMessage({ ...msg, texto: 'o vizinho faz muito barulho' }, d);
  assert.equal(d.calls.sent.length, 0);
  assert.equal(d.calls.recl.length, 1);
});

test('ofensa confiança alta → apaga e registra infração', async () => {
  const d = deps({ classify: async () => ({ tipo: 'ofensa', assunto: '', confianca: 0.95 }) });
  await handleMessage({ ...msg, texto: 'seu merda' }, d);
  assert.equal(d.calls.deleted.length, 1);
  assert.equal(d.calls.infr[0].acao, 'apagado');
});
```

**Step 2: Rodar** → FALHA.

**Step 3: Implementação**

```js
import { wasBotCalled } from './mention.js';
import { decideModeration } from '../moderation/decide.js';

export async function handleMessage(msg, deps) {
  const c = await deps.classify(msg.texto);

  // Moderação (observa todas as mensagens)
  if (c.tipo === 'ofensa') {
    const { acao } = decideModeration(c, deps.deleteThreshold);
    if (acao === 'apagado') await deps.deleteMessage(msg.key);
    await deps.logInfracao({ telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: 'ofensa', acao, confianca: c.confianca });
    await deps.sendText(msg.telefone === msg.telefone ? msg.groupJid ?? msg.telefone : msg.telefone,
      acao === 'apagado'
        ? `⚠️ Mensagem removida por linguagem ofensiva, contra as diretrizes do grupo.`
        : `⚠️ Atenção: mantenha o respeito conforme as diretrizes do grupo.`);
    await deps.logMensagem({ telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: 'ofensa', respondida: false });
    return;
  }

  // Reclamação → registra, não responde no grupo
  if (c.tipo === 'reclamacao') {
    await deps.logReclamacao({ telefone: msg.telefone, nome: msg.nome, texto: msg.texto, assunto: c.assunto });
    await deps.logMensagem({ telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: 'reclamacao', respondida: false });
    return;
  }

  // Pergunta → só responde se chamado
  if (c.tipo === 'pergunta' && wasBotCalled(msg.texto, deps.triggers, msg.mentionsBot)) {
    const resposta = await deps.answer(msg.texto);
    await deps.sendText(msg.groupJid ?? msg.telefone, resposta);
    await deps.logMensagem({ telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: 'pergunta', respondida: true });
    return;
  }

  // Irrelevante / pergunta não dirigida → só loga
  await deps.logMensagem({ telefone: msg.telefone, nome: msg.nome, texto: msg.texto, tipo: c.tipo, respondida: false });
}
```

**Step 4: Rodar** → PASSA (ajustar `groupJid` no teste se necessário).

**Step 5: Commit** — `git commit -am "feat: orquestrador da triagem com testes"`

---

### Task 10: Servidor Express + webhook da Evolution

**Files:**
- Create: `src/whatsapp/parse.js` (extrai campos do payload do webhook — lógica pura)
- Test: `src/whatsapp/parse.test.js`
- Create: `src/server.js`

**Step 1: Teste do parser** — o payload da Evolution v2 (`messages.upsert`) traz `data.key` e `data.message`. Escrever teste com um payload de exemplo real (capturado no deploy) e extrair `{ texto, telefone, nome, mentionsBot, key, groupJid }`. Implementar `parseWebhook(body, botJid)`.

**Step 2/3:** Implementar parser tolerante (texto pode vir em `conversation` ou `extendedTextMessage.text`; detectar menção em `extendedTextMessage.contextInfo.mentionedJid`).

**Step 4: server.js**

```js
import express from 'express';
import { config, assertConfig } from './config.js';
import { parseWebhook } from './whatsapp/parse.js';
import { handleMessage } from './triage/handle.js';
import { classify } from './ai/classify.js';
import { answer } from './ai/answer.js';
import { sendText, deleteMessage } from './whatsapp/evolution.js';
import { logMensagem, logReclamacao, logInfracao } from './db/repo.js';
import { hasExplicitProfanity } from './moderation/profanity.js';

assertConfig();
const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // responde rápido; processa async
  try {
    const msg = parseWebhook(req.body, config.evolution.botJid);
    if (!msg || !msg.texto || msg.fromMe) return;
    await handleMessage(msg, {
      triggers: config.botTriggers,
      deleteThreshold: config.moderationDeleteThreshold,
      // atalho: palavrão explícito força tipo ofensa alta confiança sem gastar classificação
      classify: async (t) => (hasExplicitProfanity(t) ? { tipo: 'ofensa', assunto: '', confianca: 0.95 } : classify(t)),
      answer, sendText, deleteMessage, logMensagem, logReclamacao, logInfracao,
    });
  } catch (e) { console.error('webhook erro:', e); }
});

app.listen(config.port, () => console.log(`bot ouvindo na porta ${config.port}`));
```

**Step 5: Commit** — `git commit -am "feat: servidor express + webhook"`

---

### Task 11: Relatório de eficácia

**Files:**
- Create: `src/db/relatorio.js`
- Modify: `src/server.js` (add `GET /relatorio`)

**Step 1: relatorio.js** — queries de agregação.

```js
import { pool } from './pool.js';

export async function gerarRelatorio() {
  const [perguntas, top, recl, reclUsers, infr] = await Promise.all([
    pool.query(`select count(*) total, count(*) filter (where respondida) respondidas from mensagens_log where tipo='pergunta'`),
    pool.query(`select texto, count(*) n from mensagens_log where tipo='pergunta' group by texto order by n desc limit 10`),
    pool.query(`select assunto, count(*) n from reclamacoes group by assunto order by n desc`),
    pool.query(`select nome, telefone_usuario, count(*) n from reclamacoes group by nome, telefone_usuario order by n desc limit 10`),
    pool.query(`select count(*) total, count(*) filter (where acao='apagado') apagadas from infracoes`),
  ]);
  return {
    perguntas: perguntas.rows[0],
    top_duvidas: top.rows,
    reclamacoes_por_assunto: recl.rows,
    usuarios_que_mais_reclamam: reclUsers.rows,
    infracoes: infr.rows[0],
  };
}
```

**Step 2: server.js** — `app.get('/relatorio', async (_req, res) => res.json(await gerarRelatorio()));`

**Step 3: Commit** — `git commit -am "feat: endpoint de relatório de eficácia"`

---

### Task 12: Deploy (Railway + Supabase + parear o chip)

**Files:**
- Create: `Dockerfile`
- Create: `README.md` (passo a passo de deploy)

**Step 1: Dockerfile do bot**

```dockerfile
FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

**Step 2: Supabase**
- Criar projeto, pegar a connection string (`DATABASE_URL`).
- `psql "$DATABASE_URL" -f db/schema.sql`.

**Step 3: Railway — serviço Evolution API**
- New Service → Docker Image: `atendai/evolution-api:latest`.
- Env: `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI=<supabase>`, `AUTHENTICATION_API_KEY=<gera uma>`, `CONFIG_SESSION_PHONE_*`, etc. (conferir docs da v2).
- Expor porta pública → vira `EVOLUTION_BASE_URL`.

**Step 4: Railway — serviço do bot**
- Deploy do repo (usa o Dockerfile).
- Env: todas do `.env.example` apontando pra Evolution e Supabase.

**Step 5: Criar instância + parear chip**
- `POST /instance/create` na Evolution com `{ instanceName: "condominio", integration: "WHATSAPP-BAILEYS" }`.
- Pegar QR code (`/instance/connect/condominio`) e escanear com o **chip de teste**.
- Configurar webhook da instância → `https://<bot>.up.railway.app/webhook`, evento `messages.upsert`.
- Capturar `botJid` (o número do bot) → setar `EVOLUTION_BOT_JID`.

**Step 6: Setup do grupo**
- Adicionar o chip ao grupo do condomínio e **promover a administrador** (necessário pra apagar mensagens).
- Colar o regimento real em `data/regimento.md` e redeploy.

**Step 7: Teste fim-a-fim**
- "Zelador, posso ter cachorro?" → resposta citando artigo.
- Mensagem fora de escopo → recusa.
- Pergunta sem cobertura → escala pro síndico.
- Reclamação → aparece em `/relatorio`.
- Palavrão → aviso/remoção + infração registrada.

**Step 8: Commit** — `git commit -am "chore: dockerfile e guia de deploy"`

---

## Ordem de execução

Tasks 1→11 são locais e testáveis sem credenciais (5 e 6 só ganham teste real no deploy). Task 12 precisa das chaves OpenAI/Supabase/Evolution e do chip. Recomendo executar 1–11 já, e fazer 12 quando você tiver as contas criadas.
