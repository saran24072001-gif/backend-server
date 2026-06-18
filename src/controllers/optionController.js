import pool from '../config/db.js';
import { broadcast } from '../config/websocket.js';

// Roles
export const getRoles = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM roles ORDER BY id ASC');
    const rolesList = rows.map(r => r.name);
    return res.status(200).json(rolesList);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({ error: 'Failed to fetch roles.' });
  }
};

export const addRole = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required.' });
  }
  const trimmed = name.trim();
  try {
    const [existing] = await pool.query('SELECT name FROM roles WHERE name = ?', [trimmed]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Role already exists.' });
    }
    await pool.query('INSERT INTO roles (name) VALUES (?)', [trimmed]);
    broadcast({ type: 'REFRESH_USERS' });
    return res.status(201).json({ message: 'Role added successfully.', name: trimmed });
  } catch (error) {
    console.error('Error adding role:', error);
    return res.status(500).json({ error: 'Failed to add role.' });
  }
};

export const deleteRole = async (req, res) => {
  const { name } = req.params;
  try {
    await pool.query('DELETE FROM roles WHERE name = ?', [name]);
    broadcast({ type: 'REFRESH_USERS' });
    return res.status(200).json({ message: 'Role deleted successfully.' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return res.status(500).json({ error: 'Failed to delete role.' });
  }
};

// Departments
export const getDepartments = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM departments ORDER BY id ASC');
    const deptsList = rows.map(d => d.name);
    return res.status(200).json(deptsList);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return res.status(500).json({ error: 'Failed to fetch departments.' });
  }
};

export const addDepartment = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Department name is required.' });
  }
  const trimmed = name.trim();
  try {
    const [existing] = await pool.query('SELECT name FROM departments WHERE name = ?', [trimmed]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Department already exists.' });
    }
    await pool.query('INSERT INTO departments (name) VALUES (?)', [trimmed]);
    broadcast({ type: 'REFRESH_USERS' });
    return res.status(201).json({ message: 'Department added successfully.', name: trimmed });
  } catch (error) {
    console.error('Error adding department:', error);
    return res.status(500).json({ error: 'Failed to add department.' });
  }
};

export const deleteDepartment = async (req, res) => {
  const { name } = req.params;
  try {
    await pool.query('DELETE FROM departments WHERE name = ?', [name]);
    broadcast({ type: 'REFRESH_USERS' });
    return res.status(200).json({ message: 'Department deleted successfully.' });
  } catch (error) {
    console.error('Error deleting department:', error);
    return res.status(500).json({ error: 'Failed to delete department.' });
  }
};

// Processes
export const getProcesses = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM processes ORDER BY id ASC');
    const list = rows.map(r => r.name);
    return res.status(200).json(list);
  } catch (error) {
    console.error('Error fetching processes:', error);
    return res.status(500).json({ error: 'Failed to fetch processes.' });
  }
};

export const addProcess = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Process name is required.' });
  }
  const trimmed = name.trim();
  try {
    const [existing] = await pool.query('SELECT name FROM processes WHERE name = ?', [trimmed]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Process already exists.' });
    }
    await pool.query('INSERT INTO processes (name) VALUES (?)', [trimmed]);
    return res.status(201).json({ message: 'Process added successfully.', name: trimmed });
  } catch (error) {
    console.error('Error adding process:', error);
    return res.status(500).json({ error: 'Failed to add process.' });
  }
};

export const deleteProcess = async (req, res) => {
  const { name } = req.params;
  try {
    await pool.query('DELETE FROM processes WHERE name = ?', [name]);
    return res.status(200).json({ message: 'Process deleted successfully.' });
  } catch (error) {
    console.error('Error deleting process:', error);
    return res.status(500).json({ error: 'Failed to delete process.' });
  }
};

// Machines
export const getMachines = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM machines ORDER BY id ASC');
    const list = rows.map(r => r.name);
    return res.status(200).json(list);
  } catch (error) {
    console.error('Error fetching machines:', error);
    return res.status(500).json({ error: 'Failed to fetch machines.' });
  }
};

export const addMachine = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Machine name is required.' });
  }
  const trimmed = name.trim();
  try {
    const [existing] = await pool.query('SELECT name FROM machines WHERE name = ?', [trimmed]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Machine already exists.' });
    }
    await pool.query('INSERT INTO machines (name) VALUES (?)', [trimmed]);
    return res.status(201).json({ message: 'Machine added successfully.', name: trimmed });
  } catch (error) {
    console.error('Error adding machine:', error);
    return res.status(500).json({ error: 'Failed to add machine.' });
  }
};

export const deleteMachine = async (req, res) => {
  const { name } = req.params;
  try {
    await pool.query('DELETE FROM machines WHERE name = ?', [name]);
    return res.status(200).json({ message: 'Machine deleted successfully.' });
  } catch (error) {
    console.error('Error deleting machine:', error);
    return res.status(500).json({ error: 'Failed to delete machine.' });
  }
};
