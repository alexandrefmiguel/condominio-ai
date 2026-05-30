import express from 'express';
import { fileURLToPath } from 'node:url';
import { config, assertConfig } from './config.js';
import { parseWebhook } from './whatsapp/parse.js';
import { handleMessage } from './triage/handle.js';
import { classify } from './ai/classify.js';
import { answer } from './ai/answer.js';
import { sendText, deleteMessage } from './whatsapp/evolution.js';
import { logMensagem, logReclamacao, logInfracao } from './db/repo.js';
import { gerarRelatorio } from './db/relatorio.js';
import { listarConversas, listarReclamacoes, listarInfracoes } from './db/consultas.js';
import { runSchema } from './db/migrate.js';
import { hasExplicitProfanity } from './moderation/profanity.js';
import { gerarToken, exigirAuth } from './painel/auth.js';

assertConfig();
await runSchema().catch((e) => console.error('falha ao aplicar schema:', e));

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- Painel (dashboard do síndico) ----------
const painelHtml = fileURLToPath(new URL('../public/painel.html', import.meta.url));
app.get('/', (_req, res) => res.redirect('/painel'));
app.get('/painel', (_req, res) => res.sendFile(painelHtml));

app.post('/api/login', (req, res) => {
  const senha = req.body?.senha ?? '';
  if (!config.painel.senha) return res.status(500).json({ erro: 'PAINEL_SENHA não configurada no servidor' });
  if (senha !== config.painel.senha) return res.status(401).json({ erro: 'Senha incorreta' });
  res.json({ token: gerarToken() });
});

app.get('/api/metricas', exigirAuth, async (_req, res) => {
  try { res.json(await gerarRelatorio()); }
  catch (e) { console.error('metricas erro:', e); res.status(500).json({ erro: 'falha ao gerar métricas' }); }
});

app.get('/api/conversas', exigirAuth, async (_req, res) => {
  try { res.json(await listarConversas()); }
  catch (e) { console.error('conversas erro:', e); res.status(500).json({ erro: 'falha ao listar conversas' }); }
});

app.get('/api/reclamacoes', exigirAuth, async (_req, res) => {
  try { res.json(await listarReclamacoes()); }
  catch (e) { console.error('reclamacoes erro:', e); res.status(500).json({ erro: 'falha ao listar reclamações' }); }
});

app.get('/api/infracoes', exigirAuth, async (_req, res) => {
  try { res.json(await listarInfracoes()); }
  catch (e) { console.error('infracoes erro:', e); res.status(500).json({ erro: 'falha ao listar infrações' }); }
});

// Relatório JSON aberto (legado/diagnóstico)
app.get('/relatorio', async (_req, res) => {
  try {
    res.json(await gerarRelatorio());
  } catch (e) {
    console.error('relatorio erro:', e);
    res.status(500).json({ erro: 'falha ao gerar relatório' });
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // responde rápido ao Evolution; processa em background
  try {
    const msg = parseWebhook(req.body, config.evolution.botJid);
    if (!msg || !msg.texto || msg.fromMe) return;

    await handleMessage(msg, {
      triggers: config.botTriggers,
      deleteThreshold: config.moderationDeleteThreshold,
      // Atalho: palavrão explícito vira ofensa de alta confiança sem gastar classificação.
      classify: async (t) =>
        hasExplicitProfanity(t)
          ? { tipo: 'ofensa', assunto: '', confianca: 0.95 }
          : classify(t),
      answer,
      sendText,
      deleteMessage,
      logMensagem,
      logReclamacao,
      logInfracao,
    });
  } catch (e) {
    console.error('webhook erro:', e);
  }
});

app.listen(config.port, () => console.log(`Condomínio AI ouvindo na porta ${config.port}`));
