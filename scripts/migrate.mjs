import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL_UNPOOLED for migrations');
await neon(url).query(await readFile(new URL('../migrations/001_designs.sql', import.meta.url), 'utf8'));
console.log('Design schema ready');
