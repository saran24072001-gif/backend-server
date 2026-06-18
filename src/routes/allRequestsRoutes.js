import { Router } from 'express';
import { createChange, updateChangeStatus, updateChangeDetails } from '../controllers/allRequestsController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/changes', verifyToken, createChange);
router.put('/changes/:id/status', verifyToken, updateChangeStatus);
router.put('/changes/:id/details', verifyToken, updateChangeDetails);

export default router;
