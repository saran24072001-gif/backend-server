import { Router } from 'express';
import { login, signup, forgotPassword, getUsers, deleteUser, updateUser } from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Public auth routes
router.post('/auth/login', login);
router.post('/auth/signup', signup);
router.post('/auth/forgot-password', forgotPassword);

// Time endpoint (public)
router.get('/time', (req, res) => {
  res.status(200).json({ time: new Date().toISOString() });
});

// Protected user routes
router.get('/users', verifyToken, getUsers);
router.put('/users/:id', verifyToken, updateUser);
router.delete('/users/:id', verifyToken, deleteUser);

export default router;
