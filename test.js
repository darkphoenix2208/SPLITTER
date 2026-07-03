const db = require('./server/database');

async function runTest() {
  try {
    // 1. We don't have to start the express app to test the database functions directly, 
    // but the issue was in the route handler. 
    // It's easier to just start the express app in the test script on a different port and test it.
    process.env.PORT = 3002;
    process.env.JWT_SECRET = 'test_secret';
    
    // We already required database which might have initialized it.
    
    const { router } = require('./server/routes/auth');
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/auth', router);
    
    const server = app.listen(3002, async () => {
      console.log('Test server running');
      
      try {
        // Test 1: Register without avatar
        const res1 = await fetch('http://localhost:3002/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test User', email: 'Test@Example.com', password: 'password123' })
        });
        const data1 = await res1.json();
        console.log('Register response:', data1);
        if (data1.error) throw new Error(data1.error);
        if (!data1.user.avatar_url) throw new Error('Avatar URL missing');

        // Test 2: Register with same email mixed case (should fail)
        const res2 = await fetch('http://localhost:3002/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Another', email: 'test@example.com', password: 'abc' })
        });
        const data2 = await res2.json();
        console.log('Register duplicate (mixed case) response:', data2);
        if (res2.status !== 400) throw new Error('Expected 400 for duplicate email');

        // Test 3: Login with different case
        const res3 = await fetch('http://localhost:3002/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'tEst@examPle.COM', password: 'password123' })
        });
        const data3 = await res3.json();
        console.log('Login response:', data3);
        if (data3.error) throw new Error(data3.error);
        if (data3.user.email !== 'test@example.com') throw new Error('Expected normalized email in response');

        console.log('ALL TESTS PASSED');
      } catch (err) {
        console.error('TEST FAILED:', err.message);
      } finally {
        server.close();
        process.exit();
      }
    });
  } catch (err) {
    console.error('Setup failed:', err);
  }
}

runTest();
