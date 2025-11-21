// backend/scripts/seed-units.js
require('dotenv').config();
const { connect } = require('../db');
const Unit = require('../models/Unit');

async function run() {
  await connect();

  const units = [
    { code: 'LIB', name: 'Library', type: 'facility' },
    { code: 'NURS', name: 'Nursing Building', type: 'academic' },
    { code: 'GATE', name: 'Main Gate', type: 'facility' },
    { code: 'COLA', name: 'College Building A', type: 'academic' },
    { code: 'CENT', name: 'Central Lost & Found', type: 'facility' }
  ];

  for (const u of units) {
    await Unit.updateOne({ code: u.code }, { $set: u }, { upsert: true });
  }

  console.log('Units seeded ✅');
  process.exit(0);
}

run().catch(err => {
  console.error('Seed failed', err);
  process.exit(1);
});
