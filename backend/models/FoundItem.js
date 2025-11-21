// backend/models/FoundItem.js
const { Schema, model } = require('mongoose');

const statusEnum = [
  'to_be_retrieved',      // Finder still has the item (custody A)
  'secured_unclaimed',    // Item turned in to office/manager (custody B or C)
  'pending_verification', // Manager must verify before public
  'public_unclaimed',     // Published to public listing (unclaimed)
  'pending_claim_review', // Claim submitted, manager reviews
  'ready_for_pickup',     // Manager approved claim; owner to present ID
  'claimed',              // Released to owner
  'rejected',             // Claim rejected
  'transferred'          // Transferred to another unit/central
];

const statusLogSchema = new Schema({
  previous_status: String,
  current_status: { type: String, enum: statusEnum },
  timestamp: { type: Date, default: Date.now },
  actor_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  note: String
}, { _id: false });

const foundSchema = new Schema({
  item_name: { type: String, required: true },
  category: { type: String, required: true }, // clothing, electronics, bags, etc.
  description: { type: String, required: true },
  found_location_general: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
  found_location_details: { type: String, default: null },
  date_found: { type: Date, default: null },
  custody: { type: String, enum: ['A','B','C'], required: true }, // A: finder still has, B: turned in, C: manager logged
  photo_url: { type: String, default: null },
  finder_name: { type: String, default: null },
  finder_phone: { type: String, default: null },
  assigned_unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
  status: { type: String, enum: statusEnum, default: 'to_be_retrieved' },
  status_log: [statusLogSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

foundSchema.pre('save', function(next){
  this.updated_at = Date.now();
  next();
});

module.exports = model('FoundItem', foundSchema);
module.exports.statusEnum = statusEnum;
