import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import User from '../models/User.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

// Generate JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// Shared serializer — every auth response uses the same shape
const serializeUser = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  coverPhoto: user.coverPhoto || '',
  bio: user.bio || '',
  university: user.university || '',
  location: user.location || '',
  interests: user.interests || [],
  skills: user.skills || [],
  discoverable: user.discoverable ?? false,
  onboardingComplete: user.onboardingComplete ?? false,
  circuitScore: user.circuitScore ?? 0,
  circuitTier: user.circuitTier || 'Starter',
  profileCompletion: user.profileCompletion ?? 0,
  token,
});

// @desc    Register new user
// @route   POST /api/auth/register
export const register = async (req, res) => {
  const { name, email, password, university } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  let avatar = '';
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer);
    avatar = result.secure_url;
  }

  const user = await User.create({ name, email, password, university: university || '', avatar });

  res.status(201).json(serializeUser(user, generateToken(user._id)));
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json(serializeUser(user, generateToken(user._id)));
};

// @desc    Google OAuth — verify ID token, find or create user
// @route   POST /api/auth/google
export const googleAuth = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Google ID token is required' });
  }

  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { sub: googleId, email, name, picture } = ticket.getPayload();

  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    user = await User.create({ name, email, googleId, avatar: picture || '' });
  } else if (!user.googleId) {
    user.googleId = googleId;
    await user.save();
  }

  res.json(serializeUser(user, generateToken(user._id)));
};

// @desc    Apple Sign-In
// @route   POST /api/auth/apple
export const appleAuth = async (req, res) => {
  const { identityToken, user: appleUser } = req.body;

  if (!identityToken) {
    return res.status(400).json({ message: 'Apple identity token is required' });
  }

  const appleIdTokenClaims = await appleSignin.verifyIdToken(identityToken, {
    audience: process.env.APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });

  const appleId = appleIdTokenClaims.sub;
  const email = appleIdTokenClaims.email;
  const name = appleUser?.name
    ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
    : email?.split('@')[0] || 'Apple User';

  let user = await User.findOne({ $or: [{ appleId }, ...(email ? [{ email }] : [])] });

  if (!user) {
    user = await User.create({ name, email: email || `${appleId}@apple.com`, appleId });
  } else if (!user.appleId) {
    user.appleId = appleId;
    await user.save();
  }

  res.json(serializeUser(user, generateToken(user._id)));
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
  res.json(serializeUser(req.user, null));
};

// @desc    Change password
// @route   PUT /api/auth/change-password
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user.password) {
    return res.status(400).json({ message: 'This account uses social sign-in — no password to change' });
  }
  const match = await user.matchPassword(currentPassword);
  if (!match) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated successfully' });
};

// @desc    Delete user account
// @route   DELETE /api/auth/account
export const deleteAccount = async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (user.password) {
    if (!password) return res.status(400).json({ message: 'Password required to delete account' });
    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ message: 'Incorrect password' });
  }

  await user.deleteOne();
  res.json({ message: 'Account deleted' });
};
