import { Router } from 'express';
import { createL1Request, getNextChangeNo, getL1Details, getL1AttachmentFile } from '../controllers/l1Controller.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/changes/next-no', verifyToken, getNextChangeNo);
router.post('/changes/l1', verifyToken, createL1Request);
router.get('/changes/l1/attachment/:changeNo/:fileName', verifyToken, getL1AttachmentFile);
router.get('/changes/l1/:changeNo', verifyToken, getL1Details);

export default router;
