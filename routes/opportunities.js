import express from 'express';
import { protect, optionalProtect, protectCompany } from '../middleware/authMiddleware.js';
import {
  getOpportunities,
  getOpportunityById,
  applyToOpportunity,
  toggleSaveOpportunity,
  getSavedOpportunities,
  getMyApplications,
  getMyApplicationForOpportunity,
  deleteApplication,
  rateGigApplication,
} from '../controllers/opportunityController.js';

const router = express.Router();

// Fixed routes must come BEFORE /:id
router.get('/saved',           protect, getSavedOpportunities);
router.get('/my-applications', protect, getMyApplications);

router.get('/',    optionalProtect, getOpportunities);
router.get('/:id', optionalProtect, getOpportunityById);

router.get('/:id/my-application', protect, getMyApplicationForOpportunity);
router.post('/:id/apply', protect, applyToOpportunity);
router.post('/:id/save',  protect, toggleSaveOpportunity);

// Application management
router.delete('/applications/:appId', protect, deleteApplication);
// Company rates a completed gig applicant
router.put('/applications/:appId/rate', protectCompany, rateGigApplication);

export default router;
