import pg from 'pg';
import { config } from '../config.js';

// Supabase exige SSL. rejectUnauthorized:false é suficiente para o pooler.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
});
