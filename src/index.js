const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { env } = require('./config/env');
const { errorHandler } = require('./middlewares/errorHandler');
const { bot } = require('./bot/bot');

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/finance', require('./routes/finance.routes'));
app.use('/api/payments', require('./routes/payments.routes'));
app.use('/api/ml', require('./routes/ml.routes'));

// Global error handler
app.use(errorHandler);

const startServer = async () => {
  try {
    // Launch Telegram bot
    bot.launch();
    console.log('Telegram Bot started successfully');

    // Launch Express server
    app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});

startServer();
