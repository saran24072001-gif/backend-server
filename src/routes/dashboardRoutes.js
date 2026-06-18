import { Router } from 'express';
import { getDashboardChanges } from '../controllers/dashboardController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/dashboard/changes', verifyToken, getDashboardChanges);

export default router;
