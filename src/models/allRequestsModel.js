import pool from '../config/db.js';
import { broadcast } from '../config/websocket.js';


export const addChange = async (title, requester, priority) => {
  const newId = `CHG-${Math.floor(1000 + Math.random() * 9000)}`;
  const status = 'Pending';

  await pool.query(
    'INSERT INTO change_requests (id, title, requester, date, priority, status) VALUES (?, ?, ?, CURDATE(), ?, ?)',
    [newId, title, requester, priority || 'Medium', status]
  );

  broadcast({ type: 'REFRESH_CHANGES' });

  return {
    id: newId,
    title,
    requester,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    priority: priority || 'Medium',
    status
  };
};

export const updateChangeStatus = async (id, status) => {
  await pool.query(
    'UPDATE change_requests SET status = ? WHERE id = ?',
    [status, id]
  );
  broadcast({ type: 'REFRESH_CHANGES' });
  return { id, status };
};

export const updateChangeDetails = async (changeNo, level, updateData) => {
  if (!updateData || Object.keys(updateData).length === 0) return;
  
  const tableName = level === 'l1' ? 'l1_requests' : level === 'l2' ? 'l2_validations' : 'l3_approvals';
  
  const keys = Object.keys(updateData);
  const setString = keys.map(k => `${k} = ?`).join(', ');
  const values = Object.values(updateData);
  values.push(changeNo);
  
  await pool.query(`UPDATE ${tableName} SET ${setString} WHERE change_no = ?`, values);
  broadcast({ type: 'REFRESH_CHANGES' });
};
