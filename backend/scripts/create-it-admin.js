// backend/scripts/create-it-admin.js
require('dotenv').config();
const { connect } = require('../db');
const User = require('../models/User');
const bcrypt = require('bcrypt');

async function run() {
  await connect();

  const phone = process.argv[2] || '09170000001';
  const password = process.argv[3] || 'devpass123';
  const name = process.argv[4] || 'IT Admin';

  let user = await User.findOne({ phone });
  if (user) {
    console.log('User already exists. Updating role to it_admin and resetting password...');
    user.role = 'it_admin';
    user.password_hash = await bcrypt.hash(password, 10);
    await user.save();
    console.log('Updated existing user:', phone);
    process.exit(0);
  }

  const password_hash = await bcrypt.hash(password, 10);
  user = new User({
    name,
    user_type: 'teaching_staff',
    department: 'IT',
    phone,
    email: null,
    password_hash,
    role: 'it_admin'
  });

  await user.save();
  console.log('Created it_admin -> phone:', phone, 'password:', password);
  process.exit(0);
}

run().catch(err => {
  console.error('create-it-admin failed', err);
  process.exit(1);
});
