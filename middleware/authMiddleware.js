import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';
import Recruiter from '../models/Recruiter.js';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Update lastActivityDate at most once per day (fire-and-forget)
    const today = new Date().toISOString().split('T')[0];
    const lastActive = req.user.lastActivityDate?.toISOString().split('T')[0];
    if (lastActive !== today) {
      User.findByIdAndUpdate(req.user._id, { lastActivityDate: new Date() }).catch(() => {});
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Sets req.user if a valid token is present, but never blocks the request
const optionalProtect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
  } catch {
    // Invalid token — just skip setting req.user
  }
  next();
};

// Protects company-only routes — works the same as `protect` but looks up Company
const protectCompany = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'company') {
      return res.status(401).json({ message: 'Not authorized as company' });
    }
    req.company = await Company.findById(decoded.id).select('-password');
    if (!req.company) return res.status(401).json({ message: 'Company not found' });
    next();
  } catch {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Protects recruiter-only routes
const protectRecruiter = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'recruiter') {
      return res.status(401).json({ message: 'Not authorized as recruiter' });
    }
    req.recruiter = await Recruiter.findById(decoded.id).select('-password');
    if (!req.recruiter) return res.status(401).json({ message: 'Recruiter not found' });
    next();
  } catch {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export { protect, optionalProtect, protectCompany, protectRecruiter };
