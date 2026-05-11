import mongoose from 'mongoose';

const workExperienceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobTitle: { type: String, required: true, trim: true },
    companyName: { type: String, default: '', trim: true },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Internship', 'Freelance', 'Volunteer'],
      default: 'Full-time',
    },
    startMonth: { type: Number, min: 1, max: 12, default: null },
    startYear: { type: Number, default: null },
    endMonth: { type: Number, min: 1, max: 12, default: null },
    endYear: { type: Number, default: null },
    currentlyHere: { type: Boolean, default: false },
    description: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

workExperienceSchema.index({ user: 1, startYear: -1 });

export default mongoose.model('WorkExperience', workExperienceSchema);
