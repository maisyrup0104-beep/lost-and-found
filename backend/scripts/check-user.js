// backend/scripts/check-user.js
require('dotenv').config();
const { connect } = require('../db');
const User = require('../models/User');

async function run() {
  await connect();
  const phone = process.argv[2] || '09170000001';
  const u = await User.findOne({ phone }).lean();
  if (!u) {
    console.log('User not found for phone:', phone);
  } else {
    console.log('User found:');
    console.log({
      _id: u._id.toString(),
      name: u.name,
      phone: u.phone,
      role: u.role,
      unit_id: u.unit_id || null,
      promotion_requested: u.promotion_requested || false
    });
  }
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
