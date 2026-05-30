import express from 'express';
import { config, assertConfig } from './config.js';
import { parseWebhook } from './whatsapp/parse.js';
import { handleMessage } from './triage/handle.js';
import { classify } from './ai/classify.js';
import { answer } from './ai/answer.js';
import { sendText, deleteMessage } from './whatsapp/evolution.js';
import { logMensagem, logReclamacao, logInfracao } from './db/repo.js';
import { gerarRelatorio } from './db/relatorio.js';
import { hasExplicitProfanity } from './moderation/profanity.js';

assertConfig();

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

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
