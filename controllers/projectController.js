import Project from '../models/Project.js';
import User from '../models/User.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';
import { updateProfileCompletion } from '../utils/profileCompletion.js';

// @desc    Get projects for a user
// @route   GET /api/users/:id/projects
export const getUserProjects = async (req, res) => {
  const projects = await Project.find({ user: req.params.id })
    .populate('associatedOpportunity', 'title type')
    .sort({ createdAt: -1 })
    .lean();
  res.json(projects);
};

// @desc    Create a project
// @route   POST /api/users/:id/projects
export const createProject = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const count = await Project.countDocuments({ user: req.user._id });
  if (count >= 6) {
    return res.status(400).json({ message: 'You can add up to 6 projects' });
  }

  const { title, description, externalLink, skillTags, associatedOpportunity } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ message: 'Project title is required' });
  }

  let coverImage = '';
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer);
    coverImage = result.secure_url;
  }

  const project = await Project.create({
    user: req.user._id,
    title: title.trim().slice(0, 60),
    description: (description || '').slice(0, 200),
    coverImage,
    externalLink: externalLink || '',
    skillTags: Array.isArray(skillTags) ? skillTags : (skillTags ? JSON.parse(skillTags) : []),
    associatedOpportunity: associatedOpportunity || null,
  });

  const populated = await project.populate('associatedOpportunity', 'title type');
  updateProfileCompletion(req.user._id).catch(() => {});

  res.status(201).json(populated);
};

// @desc    Update a project
// @route   PUT /api/users/:id/projects/:projectId
export const updateProject = async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (project.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const { title, description, externalLink, skillTags, associatedOpportunity } = req.body;
  if (title !== undefined) project.title = title.trim().slice(0, 60);
  if (description !== undefined) project.description = description.slice(0, 200);
  if (externalLink !== undefined) project.externalLink = externalLink;
  if (associatedOpportunity !== undefined) project.associatedOpportunity = associatedOpportunity || null;
  if (skillTags !== undefined) {
    project.skillTags = Array.isArray(skillTags) ? skillTags : JSON.parse(skillTags);
  }

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer);
    project.coverImage = result.secure_url;
  }

  await project.save();
  const populated = await project.populate('associatedOpportunity', 'title type');
  updateProfileCompletion(req.user._id).catch(() => {});

  res.json(populated);
};

// @desc    Delete a project
// @route   DELETE /api/users/:id/projects/:projectId
export const deleteProject = async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (project.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await project.deleteOne();
  updateProfileCompletion(req.user._id).catch(() => {});
  res.json({ message: 'Project deleted' });
};
