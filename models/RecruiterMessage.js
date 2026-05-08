import mongoose from 'mongoose';

const recruiterMessageSchema = new mongoose.Schema(
  {
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruiter', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
    senderType: { type: String, enum: ['recruiter', 'user'], required: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recruiterMessageSchema.index({ recruiter: 1, user: 1, createdAt: 1 });

export default mongoose.model('RecruiterMessage', recruiterMessageSchema);
