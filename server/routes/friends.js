const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware');
const crypto = require('crypto');
const { toDollars } = require('../utils/money');

const router = express.Router();

// Get all friends for the authenticated user and compute their balance
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  try {
    // We need to fetch all friendships for this user, and calculate the net balance.
    // Balance is from the perspective of the user: positive means the friend owes the user, negative means the user owes the friend.
    
    const friendships = db.prepare(`
      SELECT 
        f.id as friendship_id,
        CASE WHEN f.user_id = ? THEN f.friend_user_id ELSE f.user_id END as friend_user_id,
        CASE WHEN f.user_id = ? THEN COALESCE(u.name, f.name) ELSE u2.name END as name,
        CASE WHEN f.user_id = ? THEN COALESCE(u.avatar_url, f.avatar_url) ELSE u2.avatar_url END as image
      FROM friendships f
      LEFT JOIN users u ON f.friend_user_id = u.id
      LEFT JOIN users u2 ON f.user_id = u2.id
      WHERE f.user_id = ? OR f.friend_user_id = ?
    `).all(userId, userId, userId, userId, userId);

    // Calculate balances
    const friendsWithBalance = friendships.map(friend => {
      // Find all expenses for this friendship
      const expenses = db.prepare(`
        SELECT id, total_amount, paid_by
        FROM expenses
        WHERE friendship_id = ?
      `).all(friend.friendship_id);

      let balance = 0;

      expenses.forEach(exp => {
        // Find the user's share for this expense
        const userShareRow = db.prepare(`
          SELECT share_amount FROM expense_shares 
          WHERE expense_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
        `).get(exp.id, userId, userId); // In our simple model, user_id is always the authenticated user for their own share

        const userShare = userShareRow ? userShareRow.share_amount : 0;

        if (exp.paid_by === userId) {
          // User paid the total bill. 
          // The friend owes the user: (total_amount - userShare)
          balance += (exp.total_amount - userShare);
        } else {
          // Friend paid the total bill.
          // The user owes the friend: userShare
          balance -= userShare;
        }
      });

      return {
        id: friend.friendship_id,
        name: friend.name,
        image: friend.image,
        balance: toDollars(balance)
      };
    });

    res.json(friendsWithBalance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new friend (currently supports only unregistered friends for simplicity)
router.post('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { name, image } = req.body;

  if (!name || !image) {
    return res.status(400).json({ error: 'Name and image are required' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO friendships (user_id, name, avatar_url)
      VALUES (?, ?, ?)
    `);
    
    const info = insert.run(userId, name, image);
    
    res.status(201).json({
      id: info.lastInsertRowid,
      name,
      image,
      balance: 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
