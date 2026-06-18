import pool from '../config/db.js';
import { broadcast } from '../config/websocket.js';
import { triggerEffectivenessQAAlert } from './effectivenessNotificationModel.js';

// Self-healing: Ensure effectiveness tables exist on load
const ensureTablesExist = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS effectiveness_logs (
        id VARCHAR(50) PRIMARY KEY,
        change_no VARCHAR(50) NOT NULL,
        req_date DATE NOT NULL,
        context VARCHAR(255) NOT NULL DEFAULT '',
        start_date DATE NOT NULL,
        month_wise VARCHAR(20) NOT NULL DEFAULT '',
        remarks TEXT,
        attachment VARCHAR(255) NOT NULL DEFAULT '',
        status VARCHAR(50) NOT NULL DEFAULT '',
        qa_approval VARCHAR(50) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (change_no) REFERENCES change_requests(id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS effectiveness_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        log_id VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_data LONGTEXT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (log_id) REFERENCES effectiveness_logs(id) ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);
  } catch (err) {
    console.error('Error ensuring and seeding effectiveness tables:', err);
  }
};

// Execute immediately when model is loaded
ensureTablesExist();


const parseToISODate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLogs = async () => {
  const [rows] = await pool.query(
    `SELECT e.id, e.change_no as changeNo, 
            DATE_FORMAT(COALESCE(c.date, e.req_date), '%Y-%m-%d') as reqDate, 
            COALESCE(c.title, e.context) as context, 
            DATE_FORMAT(COALESCE(l1.date_start, e.start_date, c.date), '%Y-%m-%d') as startDate, 
            e.month_wise as monthWise, e.remarks, e.attachment, e.status, e.qa_approval as qaApproval 
     FROM effectiveness_logs e
     LEFT JOIN change_requests c ON e.change_no = c.id
     LEFT JOIN l1_requests l1 ON e.change_no = l1.change_no
     ORDER BY e.created_at DESC`
  );
  return rows;
};

export const createLog = async (logData, attachments) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id, changeNo, reqDate, context, startDate, monthWise, remarks, attachment, status, qaApproval } = logData;
    
    const formattedReqDate = parseToISODate(reqDate) || reqDate;
    const formattedStartDate = parseToISODate(startDate) || startDate;
    
    await connection.query(
      `INSERT INTO effectiveness_logs (id, change_no, req_date, context, start_date, month_wise, remarks, attachment, status, qa_approval) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, changeNo, formattedReqDate, context, formattedStartDate, monthWise, remarks, attachment || '', status, qaApproval]
    );
    
    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        await connection.query(
          `INSERT INTO effectiveness_attachments (log_id, file_name, file_data, file_type) 
           VALUES (?, ?, ?, ?)`,
          [id, file.name, file.data, file.type]
        );
      }
    }
    
    await connection.commit();
    broadcast({ type: 'REFRESH_EFFECTIVENESS' });

    if (qaApproval === 'Approved' || qaApproval === 'Rejected') {
      triggerEffectivenessQAAlert(changeNo, qaApproval, remarks).catch(err =>
        console.error('Error triggering effectiveness QA alert in createLog:', err)
      );
    }

    return logData;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateLog = async (id, logData, attachments) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { monthWise, remarks, attachment, status, qaApproval } = logData;
    
    // 1. Update the log details
    await connection.query(
      `UPDATE effectiveness_logs 
       SET month_wise = ?, remarks = ?, attachment = ?, status = ?, qa_approval = ? 
       WHERE id = ?`,
      [monthWise, remarks, attachment || '', status, qaApproval, id]
    );
    
    // 2. Delete any attachments that are no longer in the updated attachment list
    const currentAttachments = attachment ? attachment.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (currentAttachments.length > 0) {
      await connection.query(
        `DELETE FROM effectiveness_attachments 
         WHERE log_id = ? AND file_name NOT IN (?)`,
        [id, currentAttachments]
      );
    } else {
      await connection.query(
        `DELETE FROM effectiveness_attachments WHERE log_id = ?`,
        [id]
      );
    }
    
    // 3. Insert new attachments
    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        await connection.query(
          `INSERT INTO effectiveness_attachments (log_id, file_name, file_data, file_type) 
           VALUES (?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE file_data = ?, file_type = ?`,
          [id, file.name, file.data, file.type, file.data, file.type]
        );
      }
    }
    
    // Fetch the change_no to send alerts
    const [logRows] = await connection.query(
      'SELECT change_no FROM effectiveness_logs WHERE id = ?',
      [id]
    );
    const changeNo = logRows.length > 0 ? logRows[0].change_no : null;

    await connection.commit();
    broadcast({ type: 'REFRESH_EFFECTIVENESS' });

    if ((qaApproval === 'Approved' || qaApproval === 'Rejected') && changeNo) {
      triggerEffectivenessQAAlert(changeNo, qaApproval, remarks).catch(err =>
        console.error('Error triggering effectiveness QA alert in updateLog:', err)
      );
    }
    
    const [rows] = await connection.query(
      `SELECT e.id, e.change_no as changeNo, 
              DATE_FORMAT(COALESCE(c.date, e.req_date), '%Y-%m-%d') as reqDate, 
              COALESCE(c.title, e.context) as context, 
              DATE_FORMAT(COALESCE(l1.date_start, e.start_date, c.date), '%Y-%m-%d') as startDate, 
              e.month_wise as monthWise, e.remarks, e.attachment, e.status, e.qa_approval as qaApproval 
       FROM effectiveness_logs e
       LEFT JOIN change_requests c ON e.change_no = c.id
       LEFT JOIN l1_requests l1 ON e.change_no = l1.change_no
       WHERE e.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : { id, ...logData };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const deleteLog = async (id) => {
  await pool.query('DELETE FROM effectiveness_logs WHERE id = ?', [id]);
  broadcast({ type: 'REFRESH_EFFECTIVENESS' });
  return { id };
};

export const getAttachment = async (logId, fileName) => {
  const [rows] = await pool.query(
    `SELECT file_name as name, file_data as data, file_type as type 
     FROM effectiveness_attachments 
     WHERE log_id = ? AND file_name = ?`,
    [logId, fileName]
  );
  return rows.length > 0 ? rows[0] : null;
};
