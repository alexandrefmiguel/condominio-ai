import crypto from 'node:crypto';
import { config } from '../config.js';

// Token sem estado: HMAC de uma string fixa com o secret do servidor.
// Quem souber a senha (PAINEL_SENHA) recebe esse token no login; o servidor
// recalcula e compara. Simples e suficiente para um único síndico/admin.
export function gerarToken() {
  return crypto.createHmac('sha256', config.painel.secret).update('painel-ok').digest('hex');
}

export function tokenValido(token) {
  if (!token) return false;
  const esperado = gerarToken();
  if (token.length !== esperado.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
  } catch {
    return false;
  }
}

// Middleware Express: exige header "Authorization: Bearer <token>".
export function exigirAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!tokenValido(token)) return res.status(401).json({ erro: 'Não autorizado' });
  next();
}
