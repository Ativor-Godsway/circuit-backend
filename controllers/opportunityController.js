import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import { updateCircuitScore } from '../utils/circuitScoreUpdater.js';

// @route GET /api/opportunities
export const getOpportunities = async (req, res) => {
  const { type, search, remote, tag, page = 1, limit = 20 } = req.query;
  const filter = { status: 'active' };

  if (type && ['job', 'challenge', 'gig'].includes(type)) filter.type = type;
  if (remote === 'true') filter.remote = true;
  if (tag) filter.tags = { $in: [tag] };
  if (search) filter.title = { $regex: search, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);

  const [opportunities, total] = await Promise.all([
    Opportunity.find(filter)
      .populate('company', 'name logo verified location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Opportunity.countDocuments(filter),
  ]);

  // Attach isSaved and hasApplied flags for the requesting user
  const userId = req.user?._id;
  let savedSet = new Set();
  let appliedSet = new Set();

  if (userId) {
    const user = await User.findById(userId).select('savedOpportunities').lean();
    savedSet = new Set((user?.savedOpportunities || []).map(String));

    const apps = await Application.find({ user: userId, opportunity: { $in: opportunities.map((o) => o._id) } }).select('opportunity').lean();
    appliedSet = new Set(apps.map((a) => String(a.opportunity)));
  }

  const enriched = opportunities.map((o) => ({
    ...o,
    isSaved: savedSet.has(String(o._id)),
    hasApplied: appliedSet.has(String(o._id)),
  }));

  res.json({ opportunities: enriched, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// @route GET /api/opportunities/saved
export const getSavedOpportunities = async (req, res) => {
  const user = await User.findById(req.user._id).select('savedOpportunities').lean();
  const savedIds = user?.savedOpportunities || [];

  const opportunities = await Opportunity.find({ _id: { $in: savedIds } })
    .populate('company', 'name logo verified location')
    .sort({ createdAt: -1 })
    .lean();

  const appliedApps = await Application.find({ user: req.user._id, opportunity: { $in: savedIds } }).select('opportunity').lean();
  const appliedSet = new Set(appliedApps.map((a) => String(a.opportunity)));

  const enriched = opportunities.map((o) => ({
    ...o,
    isSaved: true,
    hasApplied: appliedSet.has(String(o._id)),
  }));

  res.json(enriched);
};

// @route GET /api/opportunities/my-applications
export const getMyApplications = async (req, res) => {
  const apps = await Application.find({ user: req.user._id })
    .populate({ path: 'opportunity', populate: { path: 'company', select: 'name logo verified' } })
    .sort({ createdAt: -1 })
    .lean();
  res.json(apps);
};

// @route GET /api/opportunities/:id
export const getOpportunityById = async (req, res) => {
  const opp = await Opportunity.findById(req.params.id)
    .populate('company', 'name logo verified location website')
    .lean();

  if (!opp) return res.status(404).json({ message: 'Opportunity not found' });

  // Increment view count (fire-and-forget)
  Opportunity.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).catch(() => {});

  const userId = req.user?._id;
  let isSaved = false;
  let hasApplied = false;

  if (userId) {
    const [user, app] = await Promise.all([
      User.findById(userId).select('savedOpportunities').lean(),
      Application.findOne({ opportunity: opp._id, user: userId }).select('_id status').lean(),
    ]);
    isSaved = (user?.savedOpportunities || []).map(String).includes(String(opp._id));
    hasApplied = !!app;
    opp.applicationStatus = app?.status || null;
  }

  res.json({ ...opp, isSaved, hasApplied });
};

// @route POST /api/opportunities/:id/apply
export const applyToOpportunity = async (req, res) => {
  const { coverNote } = req.body;

  const opp = await Opportunity.findById(req.params.id);
  if (!opp) return res.status(404).json({ message: 'Opportunity not found' });
  if (opp.status === 'closed') return res.status(400).json({ message: 'This opportunity is no longer accepting applications' });

  // Circuit score gate for challenges
  if (opp.minCircuitScore > 0 && req.user.circuitScore < opp.minCircuitScore) {
    return res.status(403).json({
      message: `A Circuit Score of ${opp.minCircuitScore}+ is required to apply`,
    });
  }

  try {
    const app = await Application.create({
      opportunity: opp._id,
      user: req.user._id,
      coverNote: (coverNote || '').slice(0, 300),
    });

    await Opportunity.findByIdAndUpdate(opp._id, { $inc: { applicantCount: 1 } });

    // Challenge entry counts toward opportunitiesScore
    if (opp.type === 'challenge') updateCircuitScore(req.user._id);

    res.status(201).json(app);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'You have already applied to this opportunity' });
    }
    throw err;
  }
};

// @route PUT /api/opportunities/applications/:appId/rate
// Company rates a completed gig (1–5 stars). Only valid for gig opportunities
// where the application has been accepted.
export const rateGigApplication = async (req, res) => {
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  const app = await Application.findById(req.params.appId).populate('opportunity', 'type company');
  if (!app) return res.status(404).json({ message: 'Application not found' });
  if (app.opportunity?.type !== 'gig') return res.status(400).json({ message: 'Ratings only apply to gig applications' });
  if (app.opportunity?.company?.toString() !== req.company._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (app.rating != null) return res.status(400).json({ message: 'This application has already been rated' });

  app.rating  = Math.round(rating);
  app.ratedAt = new Date();
  await app.save();

  // Update opportunitiesScore for the applicant (non-blocking)
  updateCircuitScore(app.user);

  res.json(app);
};

// @route POST /api/opportunities/:id/save  (toggle)
export const toggleSaveOpportunity = async (req, res) => {
  const opp = await Opportunity.findById(req.params.id);
  if (!opp) return res.status(404).json({ message: 'Opportunity not found' });

  const user = await User.findById(req.user._id).select('savedOpportunities');
  const alreadySaved = user.savedOpportunities.map(String).includes(String(opp._id));

  if (alreadySaved) {
    user.savedOpportunities = user.savedOpportunities.filter((id) => String(id) !== String(opp._id));
  } else {
    user.savedOpportunities.push(opp._id);
  }

  await user.save();
  res.json({ saved: !alreadySaved });
};
