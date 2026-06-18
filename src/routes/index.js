import { Router } from 'express';
import authRoutes from './authRoutes.js';
import allRequestsRoutes from './allRequestsRoutes.js';
import l1Routes from './l1Routes.js';
import l2Routes from './l2Routes.js';
import l3Routes from './l3Routes.js';
import effectivenessRoutes from './effectivenessRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import optionRoutes from './optionRoutes.js';
import hodApprovalRoutes from './hodApprovalRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = Router();

router.use(authRoutes);
router.use(allRequestsRoutes);
router.use(l1Routes);
router.use(l2Routes);
router.use(l3Routes);
router.use(effectivenessRoutes);
router.use(notificationRoutes);
router.use(optionRoutes);
router.use(hodApprovalRoutes);
router.use(dashboardRoutes);

export default router;
