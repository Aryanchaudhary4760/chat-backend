// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  sender: {
    type: String,
    required: true
  },
  senderColor: {
    type: String,
    default: '#128c7e'
  },
  edited: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);

