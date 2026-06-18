import * as effectivenessModel from '../models/effectivenessModel.js';
import pool from '../config/db.js';

const checkCanUpdate = async (email) => {
  if (!email) return false;
  const [userRows] = await pool.query('SELECT department, role FROM users WHERE email = ?', [email]);
  if (userRows.length > 0) {
    const user = userRows[0];
    const dept = (user.department || '').toLowerCase();
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrator';
    const isQADept = dept === 'quality' || dept === 'qad' || dept === 'qa';
    return isAdmin || isQADept;
  }
  return false;
};



export const getLogs = async (req, res) => {
  try {
    const list = await effectivenessModel.getLogs();
    res.status(200).json(list);
  } catch (error) {
    console.error('Error in getLogs:', error);
    res.status(500).json({ error: 'Failed to fetch effectiveness logs' });
  }
};

export const createLog = async (req, res) => {
  const { logData, attachments } = req.body;

  if (!logData || !logData.id || !logData.changeNo) {
    return res.status(400).json({ error: 'Log ID and Change Number are required.' });
  }

  try {
    const canUpdate = await checkCanUpdate(req.user?.email);
    if (!canUpdate) {
      return res.status(403).json({ error: 'Access Denied: Only authorized users in the Quality (QA) department and Administrators are allowed to create effectiveness logs.' });
    }

    const [existing] = await pool.query('SELECT id FROM effectiveness_logs WHERE change_no = ?', [logData.changeNo]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'An effectiveness log has already been submitted for this change request.' });
    }

    const newLog = await effectivenessModel.createLog(logData, attachments);
    res.status(201).json({
      message: 'Effectiveness log created successfully',
      log: newLog
    });
  } catch (error) {
    console.error('Error in createLog:', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'The selected Change Number does not exist. Please select a valid approved change.' });
    }
    res.status(500).json({ error: 'Failed to create effectiveness log' });
  }
};

export const updateLog = async (req, res) => {
  const { id } = req.params;
  const { logData, attachments } = req.body;

  if (!logData) {
    return res.status(400).json({ error: 'Log data is required.' });
  }

  try {
    const canUpdate = await checkCanUpdate(req.user?.email);
    if (!canUpdate) {
      return res.status(403).json({ error: 'Access Denied: Only authorized users in the Quality (QA) department and Administrators are allowed to update effectiveness logs.' });
    }

    const updated = await effectivenessModel.updateLog(id, logData, attachments);
    res.status(200).json({
      message: 'Effectiveness log updated successfully',
      log: updated
    });
  } catch (error) {
    console.error('Error in updateLog:', error);
    res.status(500).json({ error: 'Failed to update effectiveness log' });
  }
};

export const deleteLog = async (req, res) => {
  const { id } = req.params;

  try {
    const canUpdate = await checkCanUpdate(req.user?.email);
    if (!canUpdate) {
      return res.status(403).json({ error: 'Access Denied: Only authorized users in the Quality (QA) department and Administrators are allowed to delete effectiveness logs.' });
    }

    await effectivenessModel.deleteLog(id);
    res.status(200).json({
      message: 'Effectiveness log deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteLog:', error);
    res.status(500).json({ error: 'Failed to delete effectiveness log' });
  }
};

export const getAttachmentFile = async (req, res) => {
  const { logId, fileName } = req.params;

  try {
    const file = await effectivenessModel.getAttachment(logId, fileName);
    if (!file) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const fileBuffer = Buffer.from(file.data, 'base64');
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error in getAttachmentFile:', error);
    res.status(500).json({ error: 'Failed to retrieve attachment file' });
  }
};
