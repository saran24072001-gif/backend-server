import { Router } from 'express';
import {
  getAllHodApprovals,
  getHodApprovalsByDeptHandler,
  submitHodApproval
} from '../controllers/hodApprovalController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// GET all HOD approval requests (admin)
router.get('/hod-approvals', verifyToken, getAllHodApprovals);

// GET HOD approval requests for a specific department
router.get('/hod-approvals/dept/:dept', verifyToken, getHodApprovalsByDeptHandler);

// POST submit HOD decision (Approved / Rejected)
router.post('/hod-approvals', verifyToken, submitHodApproval);

export default router;
