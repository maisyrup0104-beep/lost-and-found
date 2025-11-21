// backend/models/Unit.js
const { Schema, model } = require('mongoose');

const unitSchema = new Schema({
  code: { type: String, trim: true },               // e.g. LIB, NURS
  name: { type: String, required: true, index: true },
  type: { type: String, enum: ['academic', 'facility'], default: 'facility' },
  aliases: [String],

  /**
   * Assigned managers (IT wants to see which managers belong to which unit)
   * This supports MULTIPLE managers per unit.
   */
  managers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  created_at: { type: Date, default: Date.now }
});

module.exports = model('Unit', unitSchema);