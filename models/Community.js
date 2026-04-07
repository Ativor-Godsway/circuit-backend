import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', maxlength: 500 },
    category: {
      type: String,
      enum: ['Academic', 'Work', 'Social', 'General'],
      default: 'General',
    },
    coverImage: { type: String, default: '' },
    privacy: { type: String, enum: ['public', 'private'], default: 'public' },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

communitySchema.index({ members: 1 });
communitySchema.index({ category: 1 });
communitySchema.index({ privacy: 1, createdAt: -1 });

export default mongoose.model('Community', communitySchema);
