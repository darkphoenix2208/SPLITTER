const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware');
const { toCents, toDollars } = require('../utils/money');

const router = express.Router();

// Get expense history for a friendship
router.get('/:friendshipId/expenses', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friendshipId } = req.params;

  try {
    // Verify friendship belongs to user
    const friendship = db.prepare('SELECT * FROM friendships WHERE id = ? AND (user_id = ? OR friend_user_id = ?)').get(friendshipId, userId, userId);
    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    const expenses = db.prepare(`
      SELECT e.*, es.share_amount as user_share
      FROM expenses e
      LEFT JOIN expense_shares es ON e.id = es.expense_id AND es.user_id = ?
      WHERE e.friendship_id = ?
      ORDER BY e.created_at DESC
    `).all(userId, friendshipId);

    const formattedExpenses = expenses.map(exp => ({
      ...exp,
      total_amount: toDollars(exp.total_amount),
      user_share: toDollars(exp.user_share)
    }));

    res.json(formattedExpenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new expense
router.post('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friendshipId, description, totalAmount, paidBy, myShare } = req.body;

  if (!friendshipId || !totalAmount || !paidBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const friendship = db.prepare('SELECT * FROM friendships WHERE id = ? AND (user_id = ? OR friend_user_id = ?)').get(friendshipId, userId, userId);
    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    const friendId = friendship.user_id === userId ? friendship.friend_user_id : friendship.user_id;
    const actualPaidBy = paidBy === 'user' ? userId : friendId;
    
    const totalCents = toCents(totalAmount);
    const myShareCents = toCents(myShare);
    const friendShareCents = totalCents - myShareCents;

    const insertExpense = db.prepare(`
      INSERT INTO expenses (friendship_id, description, total_amount, paid_by)
      VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      const info = insertExpense.run(friendshipId, description || 'Expense', totalCents, actualPaidBy);
      const expenseId = info.lastInsertRowid;

      // Insert user's share
      db.prepare(`
        INSERT INTO expense_shares (expense_id, user_id, share_amount)
        VALUES (?, ?, ?)
      `).run(expenseId, userId, myShareCents);

      // Insert friend's share if they exist (even if unregistered, we use their friendId if we eventually have one, but wait - if unregistered, friendId is null. We shouldn't insert NULL into user_id if we have multiple unregistered friends, but we can't anyway if it's part of PK. Actually, the schema allows it, but it's cleaner to only insert if friendId exists, or just use the user_id from friendship if they are registered. Wait, if they are unregistered, `friend_user_id` is null. So `friendId` is null.
      // If `friendId` is null, we don't insert a second row because an unregistered friend can never log in to query it anyway. 
      if (friendId) {
        db.prepare(`
          INSERT INTO expense_shares (expense_id, user_id, share_amount)
          VALUES (?, ?, ?)
        `).run(expenseId, friendId, friendShareCents);
      }
    })();

    res.status(201).json({ message: 'Expense created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Settle up
router.post('/:friendshipId/settle', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friendshipId } = req.params;
  const { amountToSettle, paidBy } = req.body;

  try {
    const friendship = db.prepare('SELECT * FROM friendships WHERE id = ? AND (user_id = ? OR friend_user_id = ?)').get(friendshipId, userId, userId);
    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    const friendId = friendship.user_id === userId ? friendship.friend_user_id : friendship.user_id;
    const actualPaidBy = paidBy === 'user' ? userId : friendId;

    const amountCents = toCents(amountToSettle);
    let userShare = paidBy === 'user' ? 0 : amountCents;
    let friendShare = paidBy === 'user' ? amountCents : 0;

    db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO expenses (friendship_id, description, total_amount, paid_by)
        VALUES (?, 'Settlement', ?, ?)
      `).run(friendshipId, amountCents, actualPaidBy);
      const expenseId = info.lastInsertRowid;

      db.prepare(`
        INSERT INTO expense_shares (expense_id, user_id, share_amount)
        VALUES (?, ?, ?)
      `).run(expenseId, userId, userShare);

      if (friendId) {
        db.prepare(`
          INSERT INTO expense_shares (expense_id, user_id, share_amount)
          VALUES (?, ?, ?)
        `).run(expenseId, friendId, friendShare);
      }
    })();

    res.json({ message: 'Settled up successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
