import mongoose from 'mongoose';

const educationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    institutionName: { type: String, required: true, trim: true },
    degree: { type: String, default: '', trim: true },
    fieldOfStudy: { type: String, default: '', trim: true },
    startYear: { type: Number, default: null },
    endYear: { type: Number, default: null },
    currentlyEnrolled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

educationSchema.index({ user: 1, startYear: -1 });

export default mongoose.model('Education', educationSchema);
