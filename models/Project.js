import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 200 },
    coverImage: { type: String, default: '' },
    externalLink: { type: String, default: '' },
    skillTags: [{ type: String, trim: true }],
    associatedOpportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
  },
  { timestamps: true }
);

projectSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Project', projectSchema);
