import jwt from 'jsonwebtoken';
import Recruiter from '../models/Recruiter.js';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import OpportunityInvite from '../models/OpportunityInvite.js';
import RecruiterMessage from '../models/RecruiterMessage.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

const generateRecruiterToken = (id) =>
  jwt.sign({ id, type: 'recruiter' }, process.env.JWT_SECRET, { expiresIn: '30d' });

const recruiterPublic = (r) => ({
  _id: r._id,
  fullName: r.fullName,
  email: r.email,
  companyName: r.companyName,
  title: r.title,
  logo: r.logo,
  location: r.location,
  website: r.website,
  bio: r.bio,
  socialLink: r.socialLink,
  verified: r.verified,
  verificationRequested: r.verificationRequested,
  createdAt: r.createdAt,
});

// @route POST /api/recruiters/register
export const registerRecruiter = async (req, res) => {
  const { fullName, email, password, companyName, title, location, website, bio, socialLink } = req.body;
  if (!fullName || !email || !password || !companyName) {
    return res.status(400).json({ message: 'fullName, email, password and companyName are required' });
  }

  const exists = await Recruiter.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  let logo = '';
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'circuit/recruiters');
    logo = result.secure_url;
  }

  const recruiter = await Recruiter.create({
    fullName,
    email,
    password,
    companyName,
    title: title || '',
    logo,
    location: location || '',
    website: website || '',
    bio: bio || '',
    socialLink: socialLink || '',
  });

  res.status(201).json({ ...recruiterPublic(recruiter), token: generateRecruiterToken(recruiter._id) });
};

// @route POST /api/recruiters/login
export const loginRecruiter = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const recruiter = await Recruiter.findOne({ email }).select('+password');
  if (!recruiter || !(await recruiter.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json({ ...recruiterPublic(recruiter), token: generateRecruiterToken(recruiter._id) });
};

// @route GET /api/recruiters/me
export const getRecruiterMe = async (req, res) => {
  res.json(recruiterPublic(req.recruiter));
};

// @route PUT /api/recruiters/me
export const updateRecruiterMe = async (req, res) => {
  const { fullName, companyName, title, location, website, bio, socialLink } = req.body;
  const updates = {};
  if (fullName) updates.fullName = fullName;
  if (companyName) updates.companyName = companyName;
  if (title !== undefined) updates.title = title;
  if (location !== undefined) updates.location = location;
  if (website !== undefined) updates.website = website;
  if (bio !== undefined) updates.bio = bio;
  if (socialLink !== undefined) updates.socialLink = socialLink;

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'circuit/recruiters');
    updates.logo = result.secure_url;
  }

  const recruiter = await Recruiter.findByIdAndUpdate(req.recruiter._id, updates, { new: true });
  res.json(recruiterPublic(recruiter));
};

// @route POST /api/recruiters/me/request-verification
export const requestVerification = async (req, res) => {
  if (req.recruiter.verificationRequested) {
    return res.status(400).json({ message: 'Verification already requested' });
  }
  await Recruiter.findByIdAndUpdate(req.recruiter._id, { verificationRequested: true });
  res.json({ message: 'Verification request submitted' });
};

// ── Opportunity CRUD ──────────────────────────────────────────────────────────

// @route GET /api/recruiters/me/opportunities
export const getMyOpportunities = async (req, res) => {
  const { status } = req.query;
  const filter = { recruiter: req.recruiter._id };
  if (status) filter.status = status;
  const opportunities = await Opportunity.find(filter).sort({ createdAt: -1 }).lean();
  res.json(opportunities);
};

// @route POST /api/recruiters/me/opportunities
export const createOpportunity = async (req, res) => {
  const {
    type, title, description, requirements, tags, location, remote,
    payAmount, payType, deadline, minCircuitScore, status,
  } = req.body;

  if (!type || !title || !description || !payType) {
    return res.status(400).json({ message: 'type, title, description and payType are required' });
  }

  const opp = await Opportunity.create({
    type,
    title,
    description,
    requirements: requirements || '',
    recruiter: req.recruiter._id,
    tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
    location: location || '',
    remote: remote === true || remote === 'true',
    payAmount: Number(payAmount) || 0,
    payType,
    deadline: deadline ? new Date(deadline) : undefined,
    minCircuitScore: Number(minCircuitScore) || 0,
    status: status === 'draft' ? 'draft' : 'active',
  });

  res.status(201).json(opp);
};

// @route PUT /api/recruiters/me/opportunities/:id
export const updateOpportunity = async (req, res) => {
  const opp = await Opportunity.findOne({ _id: req.params.id, recruiter: req.recruiter._id });
  if (!opp) return res.status(404).json({ message: 'Opportunity not found' });

  const allowed = ['title', 'description', 'requirements', 'tags', 'location', 'remote', 'payAmount', 'payType', 'deadline', 'status', 'minCircuitScore'];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) {
      if (key === 'tags') opp[key] = Array.isArray(req.body[key]) ? req.body[key] : JSON.parse(req.body[key]);
      else if (key === 'remote') opp[key] = req.body[key] === true || req.body[key] === 'true';
      else opp[key] = req.body[key];
    }
  });

  await opp.save();
  res.json(opp);
};

// @route POST /api/recruiters/me/opportunities/:id/duplicate
export const duplicateOpportunity = async (req, res) => {
  const original = await Opportunity.findOne({ _id: req.params.id, recruiter: req.recruiter._id }).lean();
  if (!original) return res.status(404).json({ message: 'Opportunity not found' });

  const { _id, createdAt, updatedAt, viewCount, applicantCount, ...rest } = original;
  const copy = await Opportunity.create({
    ...rest,
    title: `${rest.title} (Copy)`,
    status: 'draft',
    duplicateOf: _id,
    recruiter: req.recruiter._id,
  });

  res.status(201).json(copy);
};

// ── Applicant Management ──────────────────────────────────────────────────────

// @route GET /api/recruiters/me/applicants
export const getAllApplicants = async (req, res) => {
  const { opportunityId, status, tier } = req.query;

  const myOpps = await Opportunity.find({ recruiter: req.recruiter._id }).select('_id').lean();
  const oppIds = myOpps.map((o) => o._id);

  const filter = { opportunity: { $in: oppIds } };
  if (opportunityId) filter.opportunity = opportunityId;
  if (status) filter.status = status;

  let apps = await Application.find(filter)
    .populate('user', 'name avatar university bio circuitScore circuitTier')
    .populate('opportunity', 'title type')
    .sort({ createdAt: -1 })
    .lean();

  if (tier) apps = apps.filter((a) => a.user?.circuitTier === tier);

  res.json(apps);
};

// @route PUT /api/recruiters/me/applicants/:appId
export const updateApplicantStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const app = await Application.findById(req.params.appId)
    .populate('opportunity', 'recruiter');
  if (!app) return res.status(404).json({ message: 'Application not found' });
  if (app.opportunity.recruiter?.toString() !== req.recruiter._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  app.status = status;
  await app.save();

  const updated = await Application.findById(app._id)
    .populate('user', 'name avatar university bio circuitScore circuitTier')
    .populate('opportunity', 'title type')
    .lean();

  res.json(updated);
};

// @route PUT /api/recruiters/me/applicants/bulk
export const bulkUpdateApplicants = async (req, res) => {
  const { appIds, status } = req.body;
  const validStatuses = ['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'];
  if (!Array.isArray(appIds) || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'appIds array and valid status required' });
  }

  const myOpps = await Opportunity.find({ recruiter: req.recruiter._id }).select('_id').lean();
  const oppIds = new Set(myOpps.map((o) => o._id.toString()));

  const apps = await Application.find({ _id: { $in: appIds } }).populate('opportunity', '_id recruiter');
  const ownedIds = apps
    .filter((a) => oppIds.has(a.opportunity._id.toString()))
    .map((a) => a._id);

  await Application.updateMany({ _id: { $in: ownedIds } }, { status });
  res.json({ updated: ownedIds.length });
};

// ── Talent Spotlight ──────────────────────────────────────────────────────────

// @route GET /api/recruiters/talent
export const getTalent = async (req, res) => {
  const { search, tier, university } = req.query;
  const filter = { discoverable: true };
  if (tier) filter.circuitTier = tier;
  if (university) filter.university = { $regex: university, $options: 'i' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { bio: { $regex: search, $options: 'i' } },
      { university: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .select('name avatar bio university circuitScore circuitTier interests')
    .sort({ circuitScore: -1 })
    .limit(50)
    .lean();

  res.json(users);
};

// ── Invites ───────────────────────────────────────────────────────────────────

// @route POST /api/recruiters/invites
export const sendInvite = async (req, res) => {
  const { userId, opportunityId, message } = req.body;
  if (!userId || !opportunityId) {
    return res.status(400).json({ message: 'userId and opportunityId are required' });
  }

  const [user, opp] = await Promise.all([
    User.findById(userId).select('_id name discoverable'),
    Opportunity.findOne({ _id: opportunityId, recruiter: req.recruiter._id }),
  ]);

  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!user.discoverable) return res.status(403).json({ message: 'User is not discoverable' });
  if (!opp) return res.status(404).json({ message: 'Opportunity not found or not yours' });

  const existing = await OpportunityInvite.findOne({
    recruiter: req.recruiter._id,
    user: userId,
    opportunity: opportunityId,
  });
  if (existing) return res.status(400).json({ message: 'Already invited this user to this opportunity' });

  const invite = await OpportunityInvite.create({
    recruiter: req.recruiter._id,
    user: userId,
    opportunity: opportunityId,
    message: message || '',
  });

  // Create in-app notification for the user
  Notification.create({
    recipient: userId,
    type: 'opportunity_invite',
    title: `${req.recruiter.fullName} from ${req.recruiter.companyName} invited you`,
    body: opp.title,
    data: { inviteId: invite._id, opportunityId, recruiterId: req.recruiter._id },
  }).catch(() => {});

  res.status(201).json(invite);
};

// @route GET /api/recruiters/me/invites
export const getMyInvites = async (req, res) => {
  const invites = await OpportunityInvite.find({ recruiter: req.recruiter._id })
    .populate('user', 'name avatar university circuitScore circuitTier')
    .populate('opportunity', 'title type')
    .sort({ createdAt: -1 })
    .lean();
  res.json(invites);
};

// ── Notifications (user-facing) ───────────────────────────────────────────────

// @route GET /api/recruiters/notifications (called by users to read their notifs)
// This is intentionally separate from recruiter auth — user's own notifications
// Exported but wired under user routes (see routes/users.js)
export const getUserNotifications = async (req, res) => {
  const notifs = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  res.json(notifs);
};

export const markNotificationRead = async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true },
    { new: true }
  );
  if (!notif) return res.status(404).json({ message: 'Notification not found' });
  res.json(notif);
};

export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
  res.json({ message: 'All notifications marked read' });
};

// ── Recruiter Messaging ───────────────────────────────────────────────────────

// @route GET /api/recruiters/me/messages — list threads (one per user)
export const getRecruiterThreads = async (req, res) => {
  const threads = await RecruiterMessage.aggregate([
    { $match: { recruiter: req.recruiter._id } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$user',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: { $cond: [{ $and: [{ $eq: ['$senderType', 'user'] }, { $eq: ['$isRead', false] }] }, 1, 0] },
        },
      },
    },
    {
      $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDoc' },
    },
    { $unwind: '$userDoc' },
    {
      $project: {
        user: { _id: '$userDoc._id', name: '$userDoc.name', avatar: '$userDoc.avatar', university: '$userDoc.university' },
        lastMessage: 1,
        unreadCount: 1,
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);
  res.json(threads);
};

// @route GET /api/recruiters/me/messages/:userId — full thread with a user
export const getRecruiterThread = async (req, res) => {
  await RecruiterMessage.updateMany(
    { recruiter: req.recruiter._id, user: req.params.userId, senderType: 'user', isRead: false },
    { isRead: true, readAt: new Date() }
  );

  const messages = await RecruiterMessage.find({
    recruiter: req.recruiter._id,
    user: req.params.userId,
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json(messages);
};

// @route POST /api/recruiters/me/messages/:userId — recruiter sends a message
export const sendRecruiterMessage = async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'text is required' });

  const user = await User.findById(req.params.userId).select('_id');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const msg = await RecruiterMessage.create({
    recruiter: req.recruiter._id,
    user: req.params.userId,
    text: text.trim(),
    senderType: 'recruiter',
  });

  res.status(201).json(msg);
};

// ── User-side: recruiter message threads ─────────────────────────────────────

// @route GET /api/users/me/recruiter-threads (called by user, wired in user routes)
export const getUserRecruiterThreads = async (req, res) => {
  const threads = await RecruiterMessage.aggregate([
    { $match: { user: req.user._id } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$recruiter',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: { $cond: [{ $and: [{ $eq: ['$senderType', 'recruiter'] }, { $eq: ['$isRead', false] }] }, 1, 0] },
        },
      },
    },
    { $lookup: { from: 'recruiters', localField: '_id', foreignField: '_id', as: 'recruiterDoc' } },
    { $unwind: '$recruiterDoc' },
    {
      $project: {
        recruiter: {
          _id: '$recruiterDoc._id',
          fullName: '$recruiterDoc.fullName',
          companyName: '$recruiterDoc.companyName',
          logo: '$recruiterDoc.logo',
        },
        lastMessage: 1,
        unreadCount: 1,
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);
  res.json(threads);
};

// @route GET /api/users/me/recruiter-threads/:recruiterId
export const getUserRecruiterThread = async (req, res) => {
  await RecruiterMessage.updateMany(
    { recruiter: req.params.recruiterId, user: req.user._id, senderType: 'recruiter', isRead: false },
    { isRead: true, readAt: new Date() }
  );

  const messages = await RecruiterMessage.find({
    recruiter: req.params.recruiterId,
    user: req.user._id,
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json(messages);
};

// @route POST /api/users/me/recruiter-threads/:recruiterId
export const sendUserRecruiterMessage = async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'text is required' });

  const recruiter = await Recruiter.findById(req.params.recruiterId).select('_id');
  if (!recruiter) return res.status(404).json({ message: 'Recruiter not found' });

  const msg = await RecruiterMessage.create({
    recruiter: req.params.recruiterId,
    user: req.user._id,
    text: text.trim(),
    senderType: 'user',
  });

  res.status(201).json(msg);
};
