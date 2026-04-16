import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, pool } from '../db/pool';
import { JWT_SECRET } from '../middleware/auth';

const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '24h';
const TOKEN_EXPIRY_MS = 24 * 3600 * 1000;

function publicUser(u: Record<string, unknown>) {
  const { password_hash, ...pub } = u;
  void password_hash;
  return pub;
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password required' }); return;
    }

    const user = await queryOne<Record<string, unknown>>(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email.trim()]
    );

    // Always run bcrypt to prevent timing attacks
    const hash = (user?.password_hash as string) || '$2a$12$invalidhashthatisfakeXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) { res.status(401).json({ error: 'Invalid email or password' }); return; }
    if (!user.is_active) { res.status(401).json({ error: 'Account disabled. Contact your administrator.' }); return; }

    const jti = uuidv4();
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, jti }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await pool.query(`INSERT INTO sessions (user_id, token_jti, expires_at) VALUES ($1,$2,$3)`, [user.id, jti, expiresAt]);
    await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);
    // Prune expired sessions
    await pool.query(`DELETE FROM sessions WHERE user_id = $1 AND expires_at <= NOW()`, [user.id]);

    res.json({ token, user: publicUser(user) });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error' }); }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (req.user) await pool.query(`DELETE FROM sessions WHERE token_jti = $1`, [req.user.jti]);
    res.json({ message: 'Logged out' });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await queryOne<Record<string, unknown>>(`SELECT * FROM users WHERE id = $1`, [req.user!.id]);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(publicUser(user));
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function listUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await query(`SELECT id,email,full_name,role,is_active,last_login,created_at FROM users ORDER BY created_at DESC`);
    res.json(users);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
    if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }
    const validRoles = ['admin', 'sales_rep', 'viewer'];
    const userRole = validRoles.includes(role) ? role : 'user';
    const existing = await queryOne(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }
    const hash = await bcrypt.hash(password, 12);
    const [user] = await query<Record<string, unknown>>(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id,email,full_name,role,is_active,created_at`,
      [email.toLowerCase().trim(), hash, full_name || null, userRole]
    );
    res.status(201).json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function toggleUser(req: Request, res: Response): Promise<void> {
  try {
    const uid = parseInt(req.params.userId);
    if (uid === req.user!.id) { res.status(400).json({ error: 'Cannot disable your own account' }); return; }
    const user = await queryOne<{ is_active: boolean }>(`SELECT is_active FROM users WHERE id = $1`, [uid]);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const newActive = !user.is_active;
    await pool.query(`UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2`, [newActive, uid]);
    if (!newActive) await pool.query(`DELETE FROM sessions WHERE user_id=$1`, [uid]);
    res.json({ id: uid, is_active: newActive });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const uid = parseInt(req.params.userId);
    if (uid === req.user!.id) { res.status(400).json({ error: 'Cannot delete your own account' }); return; }
    await pool.query(`DELETE FROM users WHERE id=$1`, [uid]);
    res.json({ message: 'User deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const uid = parseInt(req.params.userId);
    const { full_name, role, password } = req.body;
    const updates: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (full_name !== undefined) { updates.push(`full_name=$${i++}`); vals.push(full_name); }
    if (role && ['admin','sales_rep','viewer'].includes(role)) { updates.push(`role=$${i++}`); vals.push(role); }
    if (password && password.length >= 8) {
      const hash = await bcrypt.hash(password, 12);
      updates.push(`password_hash=$${i++}`); vals.push(hash);
    }
    if (!updates.length) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.push(`updated_at=NOW()`);
    vals.push(uid);
    await pool.query(`UPDATE users SET ${updates.join(',')} WHERE id=$${i}`, vals);
    const user = await queryOne(`SELECT id,email,full_name,role,is_active,created_at FROM users WHERE id=$1`, [uid]);
    res.json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
}
