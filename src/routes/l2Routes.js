import { Router } from 'express';
import { getL2ValidationLogs, createL2ValidationLog, getL2Details, getL2AttachmentFile } from '../controllers/l2Controller.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/changes/l2', verifyToken, getL2ValidationLogs);
router.post('/changes/l2', verifyToken, createL2ValidationLog);
router.get('/changes/l2/attachment/:changeNo/:fileName', verifyToken, getL2AttachmentFile);
router.get('/changes/l2/:changeNo', verifyToken, getL2Details);

export default router;
