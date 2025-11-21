// backend/models/LostReport.js
const { Schema, model } = require('mongoose');

const lostStatus = [
  'reported', 'matched', 'pending_claim', 'resolved', 'closed'
];

const lostSchema = new Schema({
  reporter_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reporter_name: { type: String, required: true },
  reporter_phone: { type: String, required: true },
  reporter_email: { type: String, default: null },

  item_name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },

  last_seen_unit: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
  last_seen_details: { type: String, default: null },
  date_last_seen: { type: Date, default: null },

  education_level: { type: String, default: null },
  department: { type: String, default: null },

  photo_url: { type: String, default: null },

  status: { type: String, enum: lostStatus, default: 'reported' },
  potential_matches: [{ type: Schema.Types.ObjectId, ref: 'FoundItem' }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  status_log: [{
    previous_status: String,
    current_status: String,
    actor_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

lostSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = model('LostReport', lostSchema);
module.exports.lostStatus = lostStatus;
