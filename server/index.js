require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const { router: authRouter } = require('./routes/auth');
const friendsRouter = require('./routes/friends');
const expensesRouter = require('./routes/expenses');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/expenses', expensesRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
