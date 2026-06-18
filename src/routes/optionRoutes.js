import { Router } from 'express';
import {
  getRoles, addRole, deleteRole,
  getDepartments, addDepartment, deleteDepartment,
  getProcesses, addProcess, deleteProcess,
  getMachines, addMachine, deleteMachine
} from '../controllers/optionController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Roles
router.get('/roles', verifyToken, getRoles);
router.post('/roles', verifyToken, addRole);
router.delete('/roles/:name', verifyToken, deleteRole);

// Departments
router.get('/departments', verifyToken, getDepartments);
router.post('/departments', verifyToken, addDepartment);
router.delete('/departments/:name', verifyToken, deleteDepartment);

// Processes
router.get('/processes', verifyToken, getProcesses);
router.post('/processes', verifyToken, addProcess);
router.delete('/processes/:name', verifyToken, deleteProcess);

// Machines
router.get('/machines', verifyToken, getMachines);
router.post('/machines', verifyToken, addMachine);
router.delete('/machines/:name', verifyToken, deleteMachine);

export default router;
