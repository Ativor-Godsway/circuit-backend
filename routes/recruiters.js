import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { protectRecruiter } from '../middleware/authMiddleware.js';
import {
  registerRecruiter,
  loginRecruiter,
  getRecruiterMe,
  updateRecruiterMe,
  requestVerification,
  getMyOpportunities,
  createOpportunity,
  updateOpportunity,
  duplicateOpportunity,
  getAllApplicants,
  updateApplicantStatus,
  bulkUpdateApplicants,
  getTalent,
  sendInvite,
  getMyInvites,
  getRecruiterThreads,
  getRecruiterThread,
  sendRecruiterMessage,
} from '../controllers/recruiterController.js';

const router = express.Router();

// Auth
router.post('/register', upload.single('logo'), registerRecruiter);
router.post('/login', loginRecruiter);

// Profile
router.get('/me', protectRecruiter, getRecruiterMe);
router.put('/me', protectRecruiter, upload.single('logo'), updateRecruiterMe);
router.post('/me/request-verification', protectRecruiter, requestVerification);

// Opportunities
router.get('/me/opportunities', protectRecruiter, getMyOpportunities);
router.post('/me/opportunities', protectRecruiter, createOpportunity);
router.put('/me/opportunities/:id', protectRecruiter, updateOpportunity);
router.post('/me/opportunities/:id/duplicate', protectRecruiter, duplicateOpportunity);

// Applicants
router.get('/me/applicants', protectRecruiter, getAllApplicants);
router.put('/me/applicants/bulk', protectRecruiter, bulkUpdateApplicants);
router.put('/me/applicants/:appId', protectRecruiter, updateApplicantStatus);

// Talent
router.get('/talent', protectRecruiter, getTalent);

// Invites
router.post('/invites', protectRecruiter, sendInvite);
router.get('/me/invites', protectRecruiter, getMyInvites);

// Messaging
router.get('/me/messages', protectRecruiter, getRecruiterThreads);
router.get('/me/messages/:userId', protectRecruiter, getRecruiterThread);
router.post('/me/messages/:userId', protectRecruiter, sendRecruiterMessage);

export default router;
