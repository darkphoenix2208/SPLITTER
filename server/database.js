const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'expense-splitter.db');
const db = new Database(dbPath, { verbose: console.log });

// Initialize database schema
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_user_id INTEGER,
      name TEXT,
      avatar_url TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (friend_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      friendship_id INTEGER NOT NULL,
      description TEXT,
      total_amount INTEGER NOT NULL,
      paid_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (friendship_id) REFERENCES friendships(id),
      FOREIGN KEY (paid_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expense_shares (
      expense_id INTEGER NOT NULL,
      user_id INTEGER,
      share_amount INTEGER NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      PRIMARY KEY (expense_id, user_id)
    );
  `);
}

initDb();

module.exports = db;
