// Lista enxuta de palavrões explícitos para atalho barato (evita gastar uma
// chamada de IA em casos óbvios). Ajuste conforme a realidade do grupo.
const WORDS = [
  'merda', 'porra', 'caralho', 'cacete', 'fdp', 'desgraca', 'arrombado',
  'idiota', 'imbecil', 'otario', 'babaca', 'corno', 'vagabundo', 'lixo',
  'viado', 'puta', 'vsf', 'vtnc',
];

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Detecta palavrão explícito por correspondência de palavra inteira. */
export function hasExplicitProfanity(text) {
  const t = normalize(text);
  return WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(t));
}
