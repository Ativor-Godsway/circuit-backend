import WorkExperience from '../models/WorkExperience.js';
import Education from '../models/Education.js';
import { updateProfileCompletion } from '../utils/profileCompletion.js';

// ─── Work Experience ──────────────────────────────────────────────────────────

// @route   GET /api/users/:id/work
export const getWorkExperience = async (req, res) => {
  const entries = await WorkExperience.find({ user: req.params.id })
    .sort({ startYear: -1, startMonth: -1 })
    .lean();
  res.json(entries);
};

// @route   POST /api/users/:id/work
export const addWorkExperience = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const { jobTitle, companyName, employmentType, startMonth, startYear,
    endMonth, endYear, currentlyHere, description } = req.body;

  if (!jobTitle?.trim()) {
    return res.status(400).json({ message: 'Job title is required' });
  }

  const entry = await WorkExperience.create({
    user: req.user._id,
    jobTitle: jobTitle.trim(),
    companyName: companyName || '',
    employmentType: employmentType || 'Full-time',
    startMonth: startMonth || null,
    startYear: startYear || null,
    endMonth: currentlyHere ? null : (endMonth || null),
    endYear: currentlyHere ? null : (endYear || null),
    currentlyHere: !!currentlyHere,
    description: (description || '').slice(0, 300),
  });

  updateProfileCompletion(req.user._id).catch(() => {});
  res.status(201).json(entry);
};

// @route   PUT /api/users/:id/work/:entryId
export const updateWorkExperience = async (req, res) => {
  const entry = await WorkExperience.findById(req.params.entryId);
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  if (entry.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const fields = ['jobTitle', 'companyName', 'employmentType', 'startMonth',
    'startYear', 'endMonth', 'endYear', 'currentlyHere', 'description'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) entry[f] = req.body[f];
  });
  if (entry.currentlyHere) { entry.endMonth = null; entry.endYear = null; }

  await entry.save();
  res.json(entry);
};

// @route   DELETE /api/users/:id/work/:entryId
export const deleteWorkExperience = async (req, res) => {
  const entry = await WorkExperience.findById(req.params.entryId);
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  if (entry.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  await entry.deleteOne();
  updateProfileCompletion(req.user._id).catch(() => {});
  res.json({ message: 'Entry deleted' });
};

// ─── Education ────────────────────────────────────────────────────────────────

// @route   GET /api/users/:id/education
export const getEducation = async (req, res) => {
  const entries = await Education.find({ user: req.params.id })
    .sort({ startYear: -1 })
    .lean();
  res.json(entries);
};

// @route   POST /api/users/:id/education
export const addEducation = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const { institutionName, degree, fieldOfStudy, startYear, endYear, currentlyEnrolled } = req.body;

  if (!institutionName?.trim()) {
    return res.status(400).json({ message: 'Institution name is required' });
  }

  const entry = await Education.create({
    user: req.user._id,
    institutionName: institutionName.trim(),
    degree: degree || '',
    fieldOfStudy: fieldOfStudy || '',
    startYear: startYear || null,
    endYear: currentlyEnrolled ? null : (endYear || null),
    currentlyEnrolled: !!currentlyEnrolled,
  });

  updateProfileCompletion(req.user._id).catch(() => {});
  res.status(201).json(entry);
};

// @route   PUT /api/users/:id/education/:entryId
export const updateEducation = async (req, res) => {
  const entry = await Education.findById(req.params.entryId);
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  if (entry.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const fields = ['institutionName', 'degree', 'fieldOfStudy', 'startYear', 'endYear', 'currentlyEnrolled'];
  fields.forEach((f) => { if (req.body[f] !== undefined) entry[f] = req.body[f]; });
  if (entry.currentlyEnrolled) entry.endYear = null;

  await entry.save();
  res.json(entry);
};

// @route   DELETE /api/users/:id/education/:entryId
export const deleteEducation = async (req, res) => {
  const entry = await Education.findById(req.params.entryId);
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  if (entry.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  await entry.deleteOne();
  updateProfileCompletion(req.user._id).catch(() => {});
  res.json({ message: 'Entry deleted' });
};
