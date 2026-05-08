import jwt from 'jsonwebtoken';
import Company from '../models/Company.js';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

const generateCompanyToken = (id) =>
  jwt.sign({ id, type: 'company' }, process.env.JWT_SECRET, { expiresIn: '30d' });

const companyPublic = (c) => ({
  _id: c._id,
  name: c.name,
  email: c.email,
  logo: c.logo,
  location: c.location,
  website: c.website,
  verified: c.verified,
  createdAt: c.createdAt,
});

// @route POST /api/companies/register
export const registerCompany = async (req, res) => {
  const { name, email, password, location, website } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  const exists = await Company.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  let logo = '';
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'circuit/companies');
    logo = result.secure_url;
  }

  const company = await Company.create({ name, email, password, logo, location: location || '', website: website || '' });

  res.status(201).json({ ...companyPublic(company), token: generateCompanyToken(company._id) });
};

// @route POST /api/companies/login
export const loginCompany = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const company = await Company.findOne({ email }).select('+password');
  if (!company || !(await company.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json({ ...companyPublic(company), token: generateCompanyToken(company._id) });
};

// @route GET /api/companies/me
export const getCompanyMe = async (req, res) => {
  res.json(companyPublic(req.company));
};

// @route PUT /api/companies/me
export const updateCompanyMe = async (req, res) => {
  const { name, location, website } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (location !== undefined) updates.location = location;
  if (website !== undefined) updates.website = website;

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'circuit/companies');
    updates.logo = result.secure_url;
  }

  const company = await Company.findByIdAndUpdate(req.company._id, updates, { new: true });
  res.json(companyPublic(company));
};

// @route GET /api/companies/me/opportunities
export const getMyOpportunities = async (req, res) => {
  const opportunities = await Opportunity.find({ company: req.company._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json(opportunities);
};

// @route POST /api/companies/me/opportunities
export const createOpportunity = async (req, res) => {
  const {
    type, title, description, requirements, tags, location, remote,
    payAmount, payType, deadline, minCircuitScore,
  } = req.body;

  if (!type || !title || !description || !payType) {
    return res.status(400).json({ message: 'type, title, description and payType are required' });
  }

  const opp = await Opportunity.create({
    type,
    title,
    description,
    requirements: requirements || '',
    company: req.company._id,
    tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
    location: location || '',
    remote: remote === true || remote === 'true',
    payAmount: Number(payAmount) || 0,
    payType,
    deadline: deadline ? new Date(deadline) : undefined,
    minCircuitScore: Number(minCircuitScore) || 0,
  });

  const populated = await opp.populate('company', 'name logo verified location');
  res.status(201).json(populated);
};

// @route PUT /api/companies/me/opportunities/:id
export const updateOpportunity = async (req, res) => {
  const opp = await Opportunity.findOne({ _id: req.params.id, company: req.company._id });
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

// @route GET /api/companies/me/opportunities/:id/applicants
export const getApplicants = async (req, res) => {
  const opp = await Opportunity.findOne({ _id: req.params.id, company: req.company._id });
  if (!opp) return res.status(404).json({ message: 'Opportunity not found' });

  const apps = await Application.find({ opportunity: opp._id })
    .populate('user', 'name avatar university bio circuitScore')
    .sort({ createdAt: -1 })
    .lean();

  res.json(apps);
};

// @route PUT /api/companies/me/opportunities/:id/applicants/:appId
export const updateApplicantStatus = async (req, res) => {
  const opp = await Opportunity.findOne({ _id: req.params.id, company: req.company._id });
  if (!opp) return res.status(404).json({ message: 'Opportunity not found' });

  const validStatuses = ['pending', 'reviewed', 'accepted', 'rejected'];
  if (!validStatuses.includes(req.body.status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const app = await Application.findByIdAndUpdate(
    req.params.appId,
    { status: req.body.status },
    { new: true }
  ).populate('user', 'name avatar university bio circuitScore');

  if (!app) return res.status(404).json({ message: 'Application not found' });
  res.json(app);
};
