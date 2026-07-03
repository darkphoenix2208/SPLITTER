const db = require('./server/database'); // Ensure db is initialized

async function runTest() {
  process.env.PORT = 3003;
  process.env.JWT_SECRET = 'test_secret_cents';

  const { router: authRouter } = require('./server/routes/auth');
  const friendsRouter = require('./server/routes/friends');
  const expensesRouter = require('./server/routes/expenses');
  const express = require('express');

  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/friends', friendsRouter);
  app.use('/expenses', expensesRouter);

  const server = app.listen(3003, async () => {
    console.log('Test server running on port 3003');

    try {
      // 1. Register a user
      const res1 = await fetch('http://localhost:3003/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User A', email: `test_${Date.now()}@a.com`, password: 'pw' })
      });
      const data1 = await res1.json();
      const token = data1.token;
      
      // 2. Add an unregistered friend
      const res2 = await fetch('http://localhost:3003/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: 'Friend B', image: 'url' })
      });
      const data2 = await res2.json();
      const friendshipId = data2.id;

      // --- TEST CASE 1: Bill $100.00, user's share $40.00, friend's share $60.00, user pays. ---
      await fetch('http://localhost:3003/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          friendshipId,
          description: 'Dinner',
          totalAmount: 100.00,
          myShare: 40.00,
          paidBy: 'user'
        })
      });

      let resFriends = await fetch('http://localhost:3003/friends', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let friendsList = await resFriends.json();
      let currentFriend = friendsList.find(f => f.id === friendshipId);
      console.log('Test 1 (Standard): Expected Balance: +60.00, Actual Balance:', currentFriend.balance);
      if (currentFriend.balance !== 60) throw new Error('Test 1 failed');

      // Settle up to clear balance for next test
      await fetch(`http://localhost:3003/expenses/${friendshipId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amountToSettle: 60.00, paidBy: 'friend' })
      });

      // --- TEST CASE 2: Float drift check. Bill $10.10, user's share $3.37, friend's share $6.73, user pays. ---
      await fetch('http://localhost:3003/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          friendshipId,
          description: 'Float Drift Test',
          totalAmount: 10.10,
          myShare: 3.37,
          paidBy: 'user' // User pays 10.10, friend's share is 6.73. Friend owes 6.73.
        })
      });

      resFriends = await fetch('http://localhost:3003/friends', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      friendsList = await resFriends.json();
      currentFriend = friendsList.find(f => f.id === friendshipId);
      console.log('Test 2 (Float Drift): Expected Balance: +6.73, Actual Balance:', currentFriend.balance);
      if (currentFriend.balance !== 6.73) throw new Error('Test 2 failed: Drift detected or wrong math');

      console.log('ALL TESTS PASSED SUCCESSFULLY');
    } catch (err) {
      console.error('TEST FAILED:', err.message);
    } finally {
      server.close();
      process.exit();
    }
  });
}

runTest();
