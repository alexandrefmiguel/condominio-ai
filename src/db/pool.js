import pg from 'pg';
import { config } from '../config.js';

// Supabase exige SSL. rejectUnauthorized:false é suficiente para o pooler.
// max baixo de propósito: o pooler do Supabase tem limite de clientes, e o bot
// faz poucas queries curtas. Use a URL do Transaction pooler (porta 6543) aqui.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
