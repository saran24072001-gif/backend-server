import * as dashboardModel from '../models/dashboardModel.js';

export const getDashboardChanges = async (req, res) => {
  try {
    const list = await dashboardModel.getDashboardChanges();
    res.status(200).json(list);
  } catch (error) {
    console.error('Error in getDashboardChanges:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard changes' });
  }
};
