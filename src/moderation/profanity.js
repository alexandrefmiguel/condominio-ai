// Lista enxuta APENAS de xingamentos/palavrões inequívocos (atalho barato que
// evita gastar uma chamada de IA em casos óbvios). NÃO inclui palavras que têm
// uso legítimo no condomínio (ex: "lixo", "desgraça") para não apagar
// reclamações ou desabafos por engano. Ajuste conforme a realidade do grupo.
const WORDS = [
  'merda', 'porra', 'caralho', 'cacete', 'fdp', 'arrombado', 'desgracado',
  'otario', 'babaca', 'corno', 'vagabundo', 'viado', 'puta', 'escroto',
  'cuzao', 'fdputa', 'vsf', 'vtnc', 'vaitomarnocu',
];

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Detecta palavrão explícito por correspondência de palavra inteira. */
export function hasExplicitProfanity(text) {
  const t = normalize(text);
  return WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(t));
}
