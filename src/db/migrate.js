import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

// Aplica db/schema.sql no boot. É idempotente (CREATE TABLE IF NOT EXISTS),
// então pode rodar a cada inicialização sem efeito colateral.
export async function runSchema() {
  const sql = readFileSync(
    fileURLToPath(new URL('../../db/schema.sql', import.meta.url)),
    'utf8',
  );
  await pool.query(sql);
  console.log('Schema aplicado (tabelas garantidas).');
}
