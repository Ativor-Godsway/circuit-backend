import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import User from '../models/User.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

// Generate JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

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

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    university: user.university,
    token: generateToken(user._id),
  });
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Need password field for comparison
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    university: user.university,
    token: generateToken(user._id),
  });
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

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    university: user.university,
    token: generateToken(user._id),
  });
};

// @desc    Apple Sign-In — verify identity token, find or create user
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
  // Apple only sends name on first sign-in, passed separately
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

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    university: user.university,
    token: generateToken(user._id),
  });
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    avatar: req.user.avatar,
    coverPhoto: req.user.coverPhoto,
    bio: req.user.bio,
    university: req.user.university,
  });
};
