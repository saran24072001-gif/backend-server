import pool from '../config/db.js';
import { broadcast } from '../config/websocket.js';
import { createL1RequestNotifications, sendL1RequestEmails } from './l1NotificationModel.js';

const formatDateToSql = (dateStr) => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
};

export const addL1Request = async (l1Data, attachments, userEmail) => {
  const {
    changeNo, unit, requestedTime, changeIn, dept, requestBy,
    processName, processLine, machineNo, context, description,
    improvementArea, changeType, dateStart, traceFrom,
    dateClose, traceTo, riskAnalysis, sopUpdate,
    hodApproval, customerApproval, effectivenessMonitoring,
    fileDesc, fileImprovement, fileTraceFrom, fileTraceTo,
    fileRisk, fileSop, fileEffectiveness, improvementTableData
  } = l1Data;

  const status = 'Pending';
  const priority = 'High';
  const title = `[L1 Request - ${changeIn || 'General'}] ${context}`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let requesterEmail = userEmail;
    if (!requesterEmail || requesterEmail === 'unknown@cms.com') {
      const [adminRows] = await connection.query("SELECT email FROM users WHERE role = 'Admin'");
      if (adminRows.length === 0) {
        throw new Error("No admin user found in database");
      }
      requesterEmail = adminRows[0].email;
    }

    await connection.query(
      'INSERT INTO change_requests (id, title, requester, date, priority, status) VALUES (?, ?, ?, CURDATE(), ?, ?)',
      [changeNo, title, requesterEmail, priority, status]
    );

    const serializedTableData = improvementTableData ? JSON.stringify(improvementTableData) : null;

    await connection.query(
      `INSERT INTO l1_requests (
        change_no, unit, requested_time, change_in, dept, request_by, 
        process_name, process_line, machine_no, description, 
        improvement_area, change_type, date_start, trace_from, 
        date_close, trace_to, risk_analysis, sop_update, 
        hod_approval, customer_approval, effectiveness_monitoring,
        file_desc, file_improvement, file_trace_from, file_trace_to,
        file_risk, file_sop, file_effectiveness, improvement_table_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        changeNo, unit, requestedTime, changeIn || '', dept, requestBy,
        processName, processLine, machineNo, description,
        improvementArea, changeType, formatDateToSql(dateStart), traceFrom,
        formatDateToSql(dateClose), traceTo, riskAnalysis, sopUpdate,
        hodApproval, customerApproval, effectivenessMonitoring,
        fileDesc || '', fileImprovement || '', fileTraceFrom || '', fileTraceTo || '',
        fileRisk || '', fileSop || '', fileEffectiveness || '',
        serializedTableData
      ]
    );

    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        await connection.query(
          `INSERT INTO l1_attachments (change_no, field_name, file_name, file_data, file_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [changeNo, file.fieldName, file.name, file.data, file.type]
        );
      }
    }

    // Create notifications for selected HODs
    await createL1RequestNotifications(connection, changeNo, hodApproval, changeIn, requestBy, dept);

    await connection.commit();
    broadcast({ type: 'REFRESH_CHANGES' });
    broadcast({ type: 'REFRESH_NOTIFICATIONS' });

    // Send email notifications asynchronously after commit
    sendL1RequestEmails(changeNo, hodApproval, changeIn, requestBy, dept).catch(err =>
      console.error('Error sending L1 HOD notification email:', err)
    );
    return {
      id: changeNo,
      title,
      requester: userEmail,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      priority,
      status
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getNextChangeNo = async () => {
  const [rows] = await pool.query('SELECT id FROM change_requests');
  let maxNum = 0;
  for (const row of rows) {
    const match = row.id.match(/^4M-2026-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `4M-2026-${maxNum + 1}`;
};

export const getL1Details = async (changeNo) => {
  const [rows] = await pool.query(
    `SELECT cr.title, cr.requester as crRequester, DATE_FORMAT(cr.date, '%Y-%m-%d') as crDate, cr.priority, cr.status as crStatus,
            l1.*,
            DATE_FORMAT(l1.date_start, '%Y-%m-%d') as date_start,
            DATE_FORMAT(l1.date_close, '%Y-%m-%d') as date_close,
            ha.status as hodStatus,
            ha.remarks as hodRemarks,
            ha.hod_dept as hodDept
     FROM change_requests cr
     LEFT JOIN l1_requests l1 ON cr.id = l1.change_no
     LEFT JOIN (
       SELECT change_no,
              COALESCE(
                MIN(CASE WHEN status = 'Rejected' THEN 'Rejected' END),
                MAX(CASE WHEN status = 'Approved' THEN 'Approved' END),
                'Pending'
              ) as status,
              COALESCE(
                MAX(CASE WHEN status = 'Rejected' THEN remarks END),
                MAX(CASE WHEN status = 'Approved' THEN remarks END)
              ) as remarks,
              COALESCE(
                MAX(CASE WHEN status = 'Rejected' THEN hod_dept END),
                MAX(CASE WHEN status = 'Approved' THEN hod_dept END)
              ) as hod_dept
       FROM hod_approvals
       GROUP BY change_no
     ) ha ON cr.id = ha.change_no
     WHERE cr.id = ?`,
    [changeNo]
  );
  return rows.length > 0 ? rows[0] : null;
};

export const getL1Attachment = async (changeNo, fileName) => {
  const [rows] = await pool.query(
    `SELECT file_name as name, file_data as data, file_type as type 
     FROM l1_attachments 
     WHERE change_no = ? AND file_name = ?`,
    [changeNo, fileName]
  );
  return rows.length > 0 ? rows[0] : null;
};
