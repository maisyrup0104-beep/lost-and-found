// backend/models/User.js
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  name: { type: String, required: true },

  // user type (domain-specific)
  user_type: {
    type: String,
    enum: ['student', 'teaching_staff', 'non_teaching_staff'],
    required: true
  },

  department: { type: String },

  education_level: {
    type: String,
    enum: ['elementary', 'jhs', 'shs', 'college', 'other'],
    default: null
  },

  phone: { type: String, required: true, unique: true, index: true },
  email: { type: String },

  // store password hash
  password_hash: { type: String, required: true },

  // role: normal user, manager, or it admin
  role: { type: String, enum: ['user', 'manager', 'it_admin'], default: 'user' },

  /**
   * Assigned single unit for the user (used for managers).
   * For a manager, this points to the Unit they manage.
   * Keep unit->managers array in sync when promoting/demoting.
   */
  unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },

  // UI/backend flags
  promotion_requested: { type: Boolean, default: false },

  created_at: { type: Date, default: Date.now }
},
{
  // make it easier to inspect objects and get timestamps if you want later
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = model('User', userSchema);