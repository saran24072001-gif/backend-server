import * as allRequestsModel from '../models/allRequestsModel.js';


export const createChange = async (req, res) => {
  const { title, requester, priority } = req.body;
  if (!title || !requester) {
    return res.status(400).json({ error: 'Title and Requester are required fields.' });
  }
  try {
    const newChange = await allRequestsModel.addChange(title, requester, priority);
    res.status(201).json({ message: 'Change request created successfully', change: newChange });
  } catch (error) {
    console.error('Error in createChange:', error);
    res.status(500).json({ error: 'Failed to create change request' });
  }
};

export const updateChangeStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }
  try {
    const updated = await allRequestsModel.updateChangeStatus(id, status);
    res.status(200).json({ message: 'Change request status updated successfully', change: updated });
  } catch (error) {
    console.error('Error in updateChangeStatus:', error);
    res.status(500).json({ error: 'Failed to update change request status' });
  }
};

export const updateChangeDetails = async (req, res) => {
  const { id } = req.params;
  const { level } = req.query; // 'l1', 'l2', 'l3'
  const { updateData } = req.body;

  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admins can update change request data directly.' });
  }

  if (!level || !updateData) {
    return res.status(400).json({ error: 'Level and updateData are required.' });
  }

  try {
    await allRequestsModel.updateChangeDetails(id, level, updateData);
    res.status(200).json({ message: `${level.toUpperCase()} details updated successfully.` });
  } catch (error) {
    console.error('Error in updateChangeDetails:', error);
    res.status(500).json({ error: 'Failed to update change details.' });
  }
};
