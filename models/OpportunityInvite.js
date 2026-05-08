import mongoose from 'mongoose';

const opportunityInviteSchema = new mongoose.Schema(
  {
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruiter', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    message: { type: String, default: '', maxlength: 300 },
    status: {
      type: String,
      enum: ['pending', 'viewed', 'applied', 'declined'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

opportunityInviteSchema.index({ user: 1, createdAt: -1 });
opportunityInviteSchema.index({ recruiter: 1, opportunity: 1, user: 1 }, { unique: true });

export default mongoose.model('OpportunityInvite', opportunityInviteSchema);
