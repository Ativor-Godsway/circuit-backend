import express from 'express';
import { protect, optionalProtect, protectCompany } from '../middleware/authMiddleware.js';
import {
  getOpportunities,
  getOpportunityById,
  applyToOpportunity,
  toggleSaveOpportunity,
  getSavedOpportunities,
  getMyApplications,
  rateGigApplication,
} from '../controllers/opportunityController.js';

const router = express.Router();

// These two fixed routes must come BEFORE /:id to avoid being matched as ids
router.get('/saved', protect, getSavedOpportunities);
router.get('/my-applications', protect, getMyApplications);

router.get('/', optionalProtect, getOpportunities);
router.get('/:id', optionalProtect, getOpportunityById);

router.post('/:id/apply', protect, applyToOpportunity);
router.post('/:id/save', protect, toggleSaveOpportunity);
// Company rates a completed gig applicant — uses company auth
router.put('/applications/:appId/rate', protectCompany, rateGigApplication);

export default router;
