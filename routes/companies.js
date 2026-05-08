import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { protectCompany } from '../middleware/authMiddleware.js';
import {
  registerCompany,
  loginCompany,
  getCompanyMe,
  updateCompanyMe,
  getMyOpportunities,
  createOpportunity,
  updateOpportunity,
  getApplicants,
  updateApplicantStatus,
} from '../controllers/companyController.js';

const router = express.Router();

router.post('/register', upload.single('logo'), registerCompany);
router.post('/login', loginCompany);

router.get('/me', protectCompany, getCompanyMe);
router.put('/me', protectCompany, upload.single('logo'), updateCompanyMe);

router.get('/me/opportunities', protectCompany, getMyOpportunities);
router.post('/me/opportunities', protectCompany, createOpportunity);
router.put('/me/opportunities/:id', protectCompany, updateOpportunity);

router.get('/me/opportunities/:id/applicants', protectCompany, getApplicants);
router.put('/me/opportunities/:id/applicants/:appId', protectCompany, updateApplicantStatus);

export default router;
