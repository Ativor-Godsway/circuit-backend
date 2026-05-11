import mongoose from 'mongoose';

const personalGoalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Overdue'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

personalGoalSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('PersonalGoal', personalGoalSchema);
