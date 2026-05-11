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
    circuitScore: { type: Number, default: 0, min: 0, max: 100 },
    circuitTier: {
      type: String,
      enum: ['Starter', 'Rising', 'Established', 'Circuit Elite'],
      default: 'Starter',
    },
    // Stored component sub-scores for permanence (opportunitiesScore never decays)
    goalsScore: { type: Number, default: 0 },
    opportunitiesScore: { type: Number, default: 0 },
    // Streak shield — one per calendar month
    streakShieldAvailable: { type: Boolean, default: true },
    streakShieldUsedMonth: { type: Number, default: null }, // 0-11 (JS UTC month)
    // Tracks last known activity for inactivity decay
    lastActivityDate: { type: Date, default: null },
    savedOpportunities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' }],
    discoverable: { type: Boolean, default: false },
    onboardingComplete: { type: Boolean, default: false },
    location: { type: String, default: '' },
    skills: [{ type: String, trim: true }],
    profileCompletion: { type: Number, default: 0, min: 0, max: 100 },
    followerCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
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
