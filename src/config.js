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
    // JID completo do número do bot (ex: "5511999999999@s.whatsapp.net").
    // Usado para detectar quando alguém menciona o bot no grupo.
    botJid: process.env.EVOLUTION_BOT_JID ?? '',
  },
  // Como o bot é "chamado" no grupo: menção (@) ou prefixo no início da mensagem.
  botTriggers: (process.env.BOT_TRIGGERS ?? 'zelador,sindico,bot').split(',').map((s) => s.trim()).filter(Boolean),
  // Apaga mensagem ofensiva só acima deste nível de confiança (0..1). Abaixo disso, só avisa.
  moderationDeleteThreshold: Number(process.env.MODERATION_DELETE_THRESHOLD ?? 0.85),
  // Painel (dashboard) do síndico.
  painel: {
    senha: process.env.PAINEL_SENHA ?? '',
    secret: process.env.PAINEL_SECRET ?? 'vista-parque-secret-troque-isto',
  },
};

export function assertConfig() {
  const required = ['OPENAI_API_KEY', 'DATABASE_URL', 'EVOLUTION_BASE_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
  }
}
