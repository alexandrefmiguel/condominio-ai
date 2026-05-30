import { openai } from './client.js';
import { config } from '../config.js';

// Prompt PEQUENO de propósito: classificar NÃO precisa do regimento, então
// roda barato em toda mensagem do grupo.
const SYSTEM = `Você classifica mensagens de um grupo de WhatsApp de um condomínio residencial.
Responda APENAS um JSON no formato: {"tipo": "...", "assunto": "...", "confianca": 0.0}.

tipo deve ser um destes:
- "pergunta": dúvida sobre regras, regimento, funcionamento ou áreas do condomínio.
- "reclamacao": morador reclamando de algo (barulho, vaga, limpeza, pet, vizinho, obra, etc).
- "ofensa": APENAS quando há xingamento explícito ou palavrão agressivo direcionado a uma pessoa (ex: "seu babaca", "vai à merda"). NÃO marque como ofensa: críticas, reclamações, desabafos, ironia, ou palavras de baixo calão usadas sem agredir alguém (ex: "que merda de situação", "o lixo está acumulado"). Na dúvida, NÃO é ofensa.
- "irrelevante": bate-papo, saudação, figurinha, combinação pessoal, fora de escopo.

assunto: tema em UMA palavra quando for pergunta ou reclamacao (ex: barulho, vaga, pet, lixo, mudanca, obra); senão "".
confianca: número de 0 a 1 indicando o quanto você tem certeza do tipo.`;

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
  let parsed = {};
  try {
    parsed = JSON.parse(res.choices[0].message.content);
  } catch {
    parsed = {};
  }
  const tipos = ['pergunta', 'reclamacao', 'ofensa', 'irrelevante'];
  return {
    tipo: tipos.includes(parsed.tipo) ? parsed.tipo : 'irrelevante',
    assunto: typeof parsed.assunto === 'string' ? parsed.assunto : '',
    confianca: Number.isFinite(Number(parsed.confianca)) ? Number(parsed.confianca) : 0,
  };
}
