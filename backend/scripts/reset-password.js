// backend/scripts/reset-password.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { connect } = require('../db');
const User = require('../models/User');

async function run() {
  await connect();

  const phone = process.argv[2];      // e.g. node reset-password.js 09170000001 NewPass123!
  const newPass = process.argv[3];

  if (!phone || !newPass) {
    console.log("Usage: node backend/scripts/reset-password.js <phone> <newPassword>");
    return process.exit(1);
  }

  const user = await User.findOne({ phone });
  if (!user) {
    console.log("User not found for phone:", phone);
    return process.exit(1);
  }

  user.password_hash = await bcrypt.hash(newPass, 10);
  await user.save();

  console.log("Password reset successfully for phone:", phone);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
