import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  percent: { type: Number, min: 0, max: 100, default: 0 },
});

const goalSchema = new mongoose.Schema(
  {
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    deadline: { type: Date },
    progress: [progressSchema],
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Overdue'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Goal', goalSchema);
