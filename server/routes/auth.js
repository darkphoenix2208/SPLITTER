const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const crypto = require('crypto');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Add it to your .env file.');
}

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, avatar_url } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check if user exists
    const checkUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (checkUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const avatar = avatar_url || `https://i.pravatar.cc/48?u=${crypto.randomUUID()}`;

    const insert = db.prepare(`
      INSERT INTO users (name, email, password_hash, avatar_url)
      VALUES (?, ?, ?, ?)
    `);
    
    const info = insert.run(name, normalizedEmail, password_hash, avatar);
    
    const token = jwt.sign({ userId: info.lastInsertRowid, email: normalizedEmail }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({ token, user: { id: info.lastInsertRowid, name, email: normalizedEmail, avatar_url: avatar } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, JWT_SECRET };
