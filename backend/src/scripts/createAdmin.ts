import bcrypt from 'bcryptjs';
import { pool, testConnection } from '../db/pool';
import dotenv from 'dotenv';
dotenv.config();

const args = process.argv.slice(2);
const get = (name: string) => { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i+1] : null; };

const email = get('email') || 'admin@blackcloverlogistics.com';
const password = get('password') || 'Admin123!';
const name = get('name') || 'Admin';

async function createAdmin() {
  await testConnection();
  const existing = (await pool.query(`SELECT id FROM users WHERE LOWER(email)=LOWER($1)`, [email])).rows[0];
  if (existing) { console.log(`User ${email} already exists (id: ${existing.id})`); process.exit(0); }
  const hash = await bcrypt.hash(password, 12);
  const user = (await pool.query(`INSERT INTO users (email,password_hash,full_name,role) VALUES ($1,$2,$3,'admin') RETURNING id,email,full_name,role`, [email.toLowerCase(),hash,name])).rows[0];
  console.log(`\n✓ Admin created:\n  ID: ${user.id}\n  Email: ${user.email}\n  Password: ${password}\n`);
  await pool.end();
}

createAdmin().catch(err => { console.error(err); process.exit(1); });
