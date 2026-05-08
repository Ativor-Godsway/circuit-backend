import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const recruiterSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    companyName: { type: String, required: true, trim: true },
    title: { type: String, default: '' },
    logo: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 200 },
    socialLink: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    verificationRequested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

recruiterSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

recruiterSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model('Recruiter', recruiterSchema);
