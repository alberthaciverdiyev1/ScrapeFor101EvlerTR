import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Auto-read Metraj database config if available
const metrajEnvPath = path.resolve(process.cwd(), '../Metraj/.env');
let metrajDbConfig = {
  host: process.env.METRAJ_DB_HOST || '127.0.0.1',
  port: Number(process.env.METRAJ_DB_PORT) || 5432,
  database: process.env.METRAJ_DB_NAME || 'metraj',
  user: process.env.METRAJ_DB_USER || 'admin',
  password: process.env.METRAJ_DB_PASSWORD || 'secret',
};

if (fs.existsSync(metrajEnvPath)) {
  const envContent = fs.readFileSync(metrajEnvPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...vals] = trimmed.split('=');
    const val = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (key === 'DB_HOST') metrajDbConfig.host = val;
    if (key === 'DB_PORT') metrajDbConfig.port = Number(val);
    if (key === 'DB_DATABASE') metrajDbConfig.database = val;
    if (key === 'DB_USERNAME') metrajDbConfig.user = val;
    if (key === 'DB_PASSWORD') metrajDbConfig.password = val;
  }
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  baseUrl: 'https://www.101evler.com',
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  requestTimeoutMs: 15000,
  defaultDelayMs: 1000,
  sqlitePath: path.resolve(process.cwd(), 'data/staging.db'),
  metrajDb: metrajDbConfig,
};
