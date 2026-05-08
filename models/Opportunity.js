import mongoose from 'mongoose';

const opportunitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['job', 'challenge', 'gig'], required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    requirements: { type: String, default: '' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruiter', default: null },
    tags: [{ type: String, trim: true }],
    location: { type: String, default: '' },
    remote: { type: Boolean, default: false },
    payAmount: { type: Number, default: 0 },
    payType: { type: String, enum: ['monthly', 'fixed', 'prize'], required: true },
    deadline: { type: Date },
    status: { type: String, enum: ['active', 'closed', 'draft'], default: 'active' },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
    minCircuitScore: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    applicantCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

opportunitySchema.index({ type: 1, status: 1, createdAt: -1 });
opportunitySchema.index({ company: 1, createdAt: -1 });

export default mongoose.model('Opportunity', opportunitySchema);
