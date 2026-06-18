import { Router } from 'express';
import { getLogs, createLog, updateLog, deleteLog, getAttachmentFile } from '../controllers/effectivenessController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/effectiveness', verifyToken, getLogs);
router.post('/effectiveness', verifyToken, createLog);
router.put('/effectiveness/:id', verifyToken, updateLog);
router.delete('/effectiveness/:id', verifyToken, deleteLog);
router.get('/effectiveness/attachment/:logId/:fileName', verifyToken, getAttachmentFile);

export default router;
