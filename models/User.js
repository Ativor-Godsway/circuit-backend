import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Optional for social auth users
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },
    appleId: { type: String, sparse: true },
    avatar: { type: String, default: '' },
    coverPhoto: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 300 },
    university: { type: String, default: '' },
    interests: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password helper
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
