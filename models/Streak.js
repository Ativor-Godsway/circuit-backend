import mongoose from 'mongoose';

const streakSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    // ISO date string of last active day (YYYY-MM-DD) for day-level comparison
    lastActiveDate: { type: String, default: null },
  },
  { timestamps: true }
);

// One streak record per user per community
streakSchema.index({ user: 1, community: 1 }, { unique: true });

export default mongoose.model('Streak', streakSchema);
