import pool from '../config/db.js';
import { broadcast } from '../config/websocket.js';
import { 
  createL3DecisionNotifications, 
  sendL3DecisionEmails, 
  createL3CompletionNotifications, 
  sendL3CompletionEmails,
  createL3RejectionNotifications,
  sendL3RejectionEmails
} from './l3NotificationModel.js';

export const getL3Approvals = async () => {
  const [rows] = await pool.query(
    `SELECT c.id as changeNo, 
            DATE_FORMAT(c.date, '%e %b') as date, 
            COALESCE(l1.request_by, u.name, c.requester) as requester,
            COALESCE(l1.dept, u.department) as raisedDept,
            v.status as l2Decision,
            v.remarks as l2Remarks,
            COALESCE(l.ped, 'Pending') as ped,
            COALESCE(l.quality, 'Pending') as quality,
            COALESCE(l.production, 'Pending') as production,
            COALESCE(l.maintenance, 'Pending') as maintenance,
            COALESCE(l.pcl, 'Pending') as pcl,
            COALESCE(l.materials, 'Pending') as materials,
            COALESCE(l.marketing, 'Pending') as marketing,
            COALESCE(l.hr, 'Pending') as hr,
            COALESCE(l.safety, 'Pending') as safety,
            COALESCE(l.unit_head, 'Pending') as unitHead
     FROM change_requests c
     LEFT JOIN l1_requests l1 ON c.id = l1.change_no
     LEFT JOIN users u ON c.requester = u.email
     INNER JOIN l2_validation_logs v ON c.id = v.change_no AND v.status = 'Accepted'
     LEFT JOIN l3_approvals l ON c.id = l.change_no
     ORDER BY c.created_at DESC`
  );
  return rows;
};

export const addL3ApprovalLog = async (logData) => {
  const {
    changeNo, date, requester,
    ped, quality, production, maintenance, pcl, materials, marketing, hr, safety, unitHead
  } = logData;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

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
         VALUES (?, ?, ?, CURDATE(), 'Medium', 'Pending')`,
        [changeNo, `[L3 Auto] Approval for ${changeNo}`, adminEmail]
      );
    }

    // Fetch existing L3 approval before update to detect HOD decision changes
    const [existingL3Rows] = await connection.query(
      `SELECT ped, quality, production, maintenance, pcl, materials, marketing, hr, safety, unit_head as unitHead
       FROM l3_approvals WHERE change_no = ?`,
      [changeNo]
    );

    let wasAlreadyAllL3Decided = false;
    if (existingL3Rows.length > 0) {
      const dbL3 = existingL3Rows[0];
      wasAlreadyAllL3Decided = 
        dbL3.ped && dbL3.ped !== 'Pending' &&
        dbL3.quality && dbL3.quality !== 'Pending' &&
        dbL3.production && dbL3.production !== 'Pending' &&
        dbL3.maintenance && dbL3.maintenance !== 'Pending' &&
        dbL3.pcl && dbL3.pcl !== 'Pending' &&
        dbL3.materials && dbL3.materials !== 'Pending' &&
        dbL3.marketing && dbL3.marketing !== 'Pending' &&
        dbL3.hr && dbL3.hr !== 'Pending' &&
        dbL3.safety && dbL3.safety !== 'Pending' &&
        dbL3.unitHead && dbL3.unitHead !== 'Pending';
    }

    let updatedDeptField = null;
    let newDecision = null;

    if (existingL3Rows.length > 0) {
      const dbL3 = existingL3Rows[0];
      const fields = [
        { key: 'ped', db: dbL3.ped, label: 'PED' },
        { key: 'quality', db: dbL3.quality, label: 'Quality' },
        { key: 'production', db: dbL3.production, label: 'Production' },
        { key: 'maintenance', db: dbL3.maintenance, label: 'Maintenance' },
        { key: 'pcl', db: dbL3.pcl, label: 'PC & L' },
        { key: 'materials', db: dbL3.materials, label: 'Materials' },
        { key: 'marketing', db: dbL3.marketing, label: 'Marketing' },
        { key: 'hr', db: dbL3.hr, label: 'HR' },
        { key: 'safety', db: dbL3.safety, label: 'Safety' },
        { key: 'unitHead', db: dbL3.unitHead, label: 'Unit Head' }
      ];

      for (const field of fields) {
        const incomingVal = logData[field.key];
        if (incomingVal && incomingVal !== 'Pending' && incomingVal !== field.db) {
          updatedDeptField = field.label;
          newDecision = incomingVal;
          break;
        }
      }
    } else {
      const fields = [
        { key: 'ped', val: ped, label: 'PED' },
        { key: 'quality', val: quality, label: 'Quality' },
        { key: 'production', val: production, label: 'Production' },
        { key: 'maintenance', val: maintenance, label: 'Maintenance' },
        { key: 'pcl', val: pcl, label: 'PC & L' },
        { key: 'materials', val: materials, label: 'Materials' },
        { key: 'marketing', val: marketing, label: 'Marketing' },
        { key: 'hr', val: hr, label: 'HR' },
        { key: 'safety', val: safety, label: 'Safety' },
        { key: 'unitHead', val: unitHead, label: 'Unit Head' }
      ];

      for (const field of fields) {
        if (field.val && field.val !== 'Pending') {
          updatedDeptField = field.label;
          newDecision = field.val;
          break;
        }
      }
    }

    await connection.query(
      `INSERT INTO l3_approvals (
        change_no, date, requester, ped, quality, production, 
        maintenance, pcl, materials, marketing, hr, safety, unit_head
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        date = VALUES(date),
        requester = VALUES(requester),
        ped = VALUES(ped),
        quality = VALUES(quality),
        production = VALUES(production),
        maintenance = VALUES(maintenance),
        pcl = VALUES(pcl),
        materials = VALUES(materials),
        marketing = VALUES(marketing),
        hr = VALUES(hr),
        safety = VALUES(safety),
        unit_head = VALUES(unit_head)`,
      [
        changeNo, date, requester,
        ped || 'Pending', quality || 'Pending', production || 'Pending',
        maintenance || 'Pending', pcl || 'Pending', materials || 'Pending',
        marketing || 'Pending', hr || 'Pending', safety || 'Pending', unitHead || 'Pending'
      ]
    );

    // Fetch raisedDept and requesterEmail
    const [crRows] = await connection.query(
      `SELECT COALESCE(l1.dept, u.department) as raisedDept, c.requester as requesterEmail
       FROM change_requests c
       LEFT JOIN l1_requests l1 ON c.id = l1.change_no
       LEFT JOIN users u ON c.requester = u.email
       WHERE c.id = ?`,
      [changeNo]
    );
    const raisedDept = crRows.length > 0 ? crRows[0].raisedDept : '';
    const requesterEmail = crRows.length > 0 ? crRows[0].requesterEmail : '';

    const mapDbDeptToL3Dept = (dbDept) => {
      if (!dbDept) return 'Quality';
      const dept = dbDept.trim().toLowerCase();
      if (dept === 'qad' || dept === 'quality') return 'Quality';
      if (dept === 'ped') return 'PED';
      if (dept === 'production') return 'Production';
      if (dept === 'maintenance') return 'Maintenance';
      if (dept === 'pc & l' || dept === 'pcl') return 'PC & L';
      if (dept === 'materials') return 'Materials';
      if (dept === 'marketing') return 'Marketing';
      if (dept === 'hr') return 'HR';
      if (dept === 'safety') return 'Safety';
      if (dept === 'unit head' || dept === 'unit_head') return 'Unit Head';
      return 'Quality';
    };

    const mappedRaisedDept = mapDbDeptToL3Dept(raisedDept);

    const isAllL3Decided = 
      ped !== 'Pending' &&
      quality !== 'Pending' &&
      production !== 'Pending' &&
      maintenance !== 'Pending' &&
      pcl !== 'Pending' &&
      materials !== 'Pending' &&
      marketing !== 'Pending' &&
      hr !== 'Pending' &&
      safety !== 'Pending' &&
      unitHead !== 'Pending';

    // Calculate if any of the decisions is 'Rejected'
    const rejectedDepts = [];
    const labelMap = {
      ped: 'PED',
      quality: 'Quality',
      production: 'Production',
      maintenance: 'Maintenance',
      pcl: 'PC & L',
      materials: 'Materials',
      marketing: 'Marketing',
      hr: 'HR',
      safety: 'Safety',
      unitHead: 'Unit Head'
    };
    if (ped === 'Rejected') rejectedDepts.push(labelMap.ped);
    if (quality === 'Rejected') rejectedDepts.push(labelMap.quality);
    if (production === 'Rejected') rejectedDepts.push(labelMap.production);
    if (maintenance === 'Rejected') rejectedDepts.push(labelMap.maintenance);
    if (pcl === 'Rejected') rejectedDepts.push(labelMap.pcl);
    if (materials === 'Rejected') rejectedDepts.push(labelMap.materials);
    if (marketing === 'Rejected') rejectedDepts.push(labelMap.marketing);
    if (hr === 'Rejected') rejectedDepts.push(labelMap.hr);
    if (safety === 'Rejected') rejectedDepts.push(labelMap.safety);
    if (unitHead === 'Rejected') rejectedDepts.push(labelMap.unitHead);

    const hasRejection = rejectedDepts.length > 0;

    if (isAllL3Decided) {
      await connection.query(
        `UPDATE change_requests SET status = 'Completed' WHERE id = ?`,
        [changeNo]
      );

      if (!wasAlreadyAllL3Decided) {
        const [l1Rows] = await connection.query(
          `SELECT dept, change_in, request_by FROM l1_requests WHERE change_no = ?`,
          [changeNo]
        );
        const l1Dept = l1Rows.length > 0 ? l1Rows[0].dept : '';
        const changeIn = l1Rows.length > 0 ? l1Rows[0].change_in : '';
        const requestBy = l1Rows.length > 0 ? l1Rows[0].request_by : requester;

        if (hasRejection) {
          await createL3RejectionNotifications(
            connection, changeNo, changeIn, requestBy, requesterEmail, l1Dept, rejectedDepts
          );
        } else {
          await createL3CompletionNotifications(
            connection, changeNo, changeIn, requestBy, requesterEmail, l1Dept
          );
        }
      }
    } else {
      const [crRow] = await connection.query(
        `SELECT status FROM change_requests WHERE id = ?`,
        [changeNo]
      );
      if (crRow.length > 0 && crRow[0].status === 'Completed') {
        await connection.query(
          `UPDATE change_requests SET status = 'Approved' WHERE id = ?`,
          [changeNo]
        );
      }
    }

    await connection.commit();
    broadcast({ type: 'REFRESH_CHANGES' });
    broadcast({ type: 'REFRESH_NOTIFICATIONS' });

    if (isAllL3Decided && !wasAlreadyAllL3Decided) {
      if (hasRejection) {
        sendL3RejectionEmails(changeNo, requesterEmail, rejectedDepts).catch(err =>
          console.error('Error sending L3 rejection emails:', err)
        );
      } else {
        sendL3CompletionEmails(changeNo, requesterEmail).catch(err =>
          console.error('Error sending L3 completion emails:', err)
        );
      }
    }

    return logData;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
