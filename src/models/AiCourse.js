const mongoose = require('mongoose');

const aiCourseSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topic: { type: String, required: true, trim: true },
    language: { type: String, default: 'English' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    ai: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = { AiCourse: mongoose.model('AiCourse', aiCourseSchema) };