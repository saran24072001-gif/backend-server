import pool from '../config/db.js';
import { broadcast } from '../config/websocket.js';
import { createL2Notifications, sendL2Emails } from './l2NotificationModel.js';

export const getL2ValidationLogs = async () => {
  const [rows] = await pool.query(
    `SELECT v.change_no as changeNo, v.validation_date as date, 
            COALESCE(l1.request_by, u.name, v.requester) as requester, 
            v.weld_test as weldTest, v.qa_test as qaTest, v.status, v.remarks,
            c.requester as requesterEmail
     FROM l2_validation_logs v
     LEFT JOIN l1_requests l1 ON v.change_no = l1.change_no
     LEFT JOIN change_requests c ON v.change_no = c.id
     LEFT JOIN users u ON c.requester = u.email
     ORDER BY v.created_at DESC`
  );
  return rows;
};

export const addL2ValidationLog = async (logData, attachments) => {
  const { changeNo, date, requester, weldTest, qaTest, status, remarks } = logData;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingL2] = await connection.query(
      `SELECT status FROM l2_validation_logs WHERE change_no = ?`,
      [changeNo]
    );

    if (existingL2.length > 0) {
      if (status === 'Accepted') {
        await connection.query(
          `UPDATE change_requests SET status = 'Approved' WHERE id = ?`,
          [changeNo]
        );
      } else if (status === 'Rejected' || status === 'Pending') {
        await connection.query(
          `UPDATE change_requests SET status = 'Evaluating' WHERE id = ?`,
          [changeNo]
        );
      }

      await connection.query(
        `UPDATE l2_validation_logs 
         SET validation_date = ?, 
             requester = ?, 
             weld_test = COALESCE(NULLIF(?, ''), weld_test), 
             qa_test = COALESCE(NULLIF(?, ''), qa_test), 
             status = COALESCE(NULLIF(?, ''), status), 
             remarks = COALESCE(NULLIF(?, ''), remarks)
         WHERE change_no = ?`,
        [date, requester, weldTest || '', qaTest || '', status || '', remarks || '', changeNo]
      );
    } else {
      const [existing] = await connection.query(
        `SELECT id FROM change_requests WHERE id = ?`,
        [changeNo]
      );
      if (existing.length === 0) {
        const [adminRows] = await connection.query("SELECT email FROM users WHERE role = 'Admin'");
        if (adminRows.length === 0) {
          throw new Error("No admin user found in database");
        }
        const adminEmail = adminRows[0].email;
        await connection.query(
          `INSERT INTO change_requests (id, title, requester, date, priority, status) 
           VALUES (?, ?, ?, CURDATE(), 'Medium', ?)`,
          [changeNo, `[L2 Auto] Validation for ${changeNo}`, adminEmail, status === 'Accepted' ? 'Approved' : 'Pending']
        );
      } else if (status === 'Accepted') {
        await connection.query(
          `UPDATE change_requests SET status = 'Approved' WHERE id = ?`,
          [changeNo]
        );
      } else if (status === 'Rejected' || status === 'Pending') {
        await connection.query(
          `UPDATE change_requests SET status = 'Evaluating' WHERE id = ?`,
          [changeNo]
        );
      }

      await connection.query(
        `INSERT INTO l2_validation_logs (change_no, validation_date, requester, weld_test, qa_test, status, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [changeNo, date, requester, weldTest || '', qaTest || '', status || 'Pending', remarks || '']
      );
    }

    // Save L2 attachments — bulk delete per field then insert all
    if (attachments && attachments.length > 0) {
      const fieldNames = [...new Set(attachments.map(f => f.fieldName))];
      for (const fieldName of fieldNames) {
        await connection.query(
          `DELETE FROM l2_attachments WHERE change_no = ? AND field_name = ?`,
          [changeNo, fieldName]
        );
      }
      for (const file of attachments) {
        await connection.query(
          `INSERT INTO l2_attachments (change_no, field_name, file_name, file_data, file_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [changeNo, file.fieldName, file.name, file.data, file.type]
        );
      }
    }
    // Create notifications based on validation status
    const [l1Rows] = await connection.query(
      `SELECT dept, change_in, request_by, process_name, machine_no FROM l1_requests WHERE change_no = ?`,
      [changeNo]
    );
    const l1Dept = l1Rows.length > 0 ? l1Rows[0].dept : '';
    const changeIn = l1Rows.length > 0 ? l1Rows[0].change_in : '';
    const requestBy = l1Rows.length > 0 ? l1Rows[0].request_by : requester;
    const processName = l1Rows.length > 0 ? l1Rows[0].process_name : '';
    const machineNo = l1Rows.length > 0 ? l1Rows[0].machine_no : '';

    // Fetch requester email and title of the change request
    const [crRequesterRow] = await connection.query(
      `SELECT requester, title FROM change_requests WHERE id = ?`,
      [changeNo]
    );
    const crRequesterEmail = crRequesterRow.length > 0 ? crRequesterRow[0].requester : '';
    const crTitle = crRequesterRow.length > 0 ? crRequesterRow[0].title : '';
    const [reqUserRow] = await connection.query(
      `SELECT department FROM users WHERE email = ?`,
      [crRequesterEmail]
    );
    const crRequesterDept = reqUserRow.length > 0 ? reqUserRow[0].department : '';

    const resolvedTargetUsers = await createL2Notifications(
      connection, changeNo, status, logData, l1Dept, requestBy, crTitle, crRequesterEmail, crRequesterDept, changeIn, processName, machineNo
    );

    await connection.commit();
    broadcast({ type: 'REFRESH_CHANGES' });
    broadcast({ type: 'REFRESH_NOTIFICATIONS' });

    // Send L2 emails asynchronously
    sendL2Emails(
      changeNo, status, logData, l1Dept, requestBy, crRequesterEmail, crRequesterDept, crTitle, changeIn, processName, machineNo, resolvedTargetUsers
    ).catch(err => console.error('Error sending L2 email notifications:', err));

    return logData;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getL2Details = async (changeNo) => {
  const [rows] = await pool.query(
    `SELECT v.change_no as changeNo, v.validation_date as date, 
            COALESCE(l1.request_by, u.name, v.requester) as requester, 
            v.weld_test as weldTest, v.qa_test as qaTest, v.status, v.remarks 
     FROM l2_validation_logs v
     LEFT JOIN l1_requests l1 ON v.change_no = l1.change_no
     LEFT JOIN change_requests c ON v.change_no = c.id
     LEFT JOIN users u ON c.requester = u.email
     WHERE v.change_no = ?`,
    [changeNo]
  );
  return rows.length > 0 ? rows[0] : null;
};

export const getL2Attachment = async (changeNo, fileName) => {
  const [rows] = await pool.query(
    `SELECT file_name as name, file_data as data, file_type as type 
     FROM l2_attachments 
     WHERE change_no = ? AND file_name = ?`,
    [changeNo, fileName]
  );
  return rows.length > 0 ? rows[0] : null;
};
