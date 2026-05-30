import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openai } from './client.js';
import { config } from '../config.js';

const regimento = readFileSync(
  fileURLToPath(new URL('../../data/regimento.md', import.meta.url)),
  'utf8',
);

// Prefixo estático (instruções + regimento) vem PRIMEIRO para maximizar o
// prompt caching da OpenAI; a pergunta variável vai por último.
const SYSTEM = `Você é o assistente virtual de um condomínio residencial, atuando no grupo de WhatsApp dos moradores.
Responda em português, de forma curta, clara e cordial, adequada a uma mensagem de WhatsApp.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base no Regimento Interno abaixo. Não use conhecimento externo nem invente regras.
2. Sempre cite a fonte: o(s) artigo(s) do regimento em que você se baseou (ex: "conforme o Art. 96").
3. Se a resposta NÃO estiver no regimento, diga que não consta no regimento e oriente o morador a procurar o síndico ou a administração. NUNCA invente uma resposta.
4. Se a pergunta não for sobre o condomínio, recuse educadamente e explique que você só responde dúvidas sobre o regimento do condomínio.

REGIMENTO INTERNO:
${regimento}`;

export async function answer(question) {
  const res = await openai.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: question },
    ],
  });
  return res.choices[0].message.content.trim();
}
