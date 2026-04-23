const app = require('./src/app');
const { seed } = require('./src/seed');

const PORT = process.env.PORT || 3000;

// Seed the database with 2026 profiles (idempotent – safe to run every startup)
seed();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
