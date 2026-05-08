import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'],
      default: 'pending',
    },
    coverNote: { type: String, maxlength: 300, default: '' },
    // Company rates gig completions (1–5 stars); null until rated
    rating: { type: Number, min: 1, max: 5, default: null },
    ratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One application per user per opportunity
applicationSchema.index({ opportunity: 1, user: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema);
