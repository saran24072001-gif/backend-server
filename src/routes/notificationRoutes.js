import { Router } from 'express';
import { getNotifications, toggleRead, markAllRead, deleteNotification, clearRead } from '../controllers/notificationController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/notifications', verifyToken, getNotifications);
router.put('/notifications/mark-all-read', verifyToken, markAllRead);
router.put('/notifications/clear-read', verifyToken, clearRead);
router.put('/notifications/:id/read', verifyToken, toggleRead);
router.delete('/notifications/:id', verifyToken, deleteNotification);

export default router;
