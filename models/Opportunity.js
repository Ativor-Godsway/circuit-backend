import mongoose from 'mongoose';

const opportunitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['job', 'challenge', 'gig'], required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    // Stored as an array of individual requirement strings
    requirements: [{ type: String, trim: true }],
    // Controls whether job applications require a CV upload
    cvRequired: {
      type:    String,
      enum:    ['not_needed', 'optional', 'required'],
      default: 'not_needed',
    },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruiter', default: null },
    tags: [{ type: String, trim: true }],
    location: { type: String, default: '' },
    remote: { type: Boolean, default: false },
    payAmount: { type: Number, default: 0 },
    payType: { type: String, enum: ['monthly', 'fixed', 'prize'], required: true },
    deadline: { type: Date },
    // 'taken' = position filled; listing stays visible but Apply is disabled
    status: { type: String, enum: ['active', 'closed', 'draft', 'taken'], default: 'active' },
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
