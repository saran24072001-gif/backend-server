import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import dns from 'dns';

// Force IPv4 for Nodemailer to fix Railway ENETUNREACH error with Gmail
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

let transporter;

const useSMTP = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

if (useSMTP) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP Verify Error:', error);
    } else {
      console.log('SMTP Server Ready');
    }
  });
} else {
  console.log('SMTP configuration not fully set in .env. Email notifications will be logged to console.');
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('\n==================================================');
      console.log('MOCK EMAIL NOTIFICATION SENDING:');
      console.log(`From: ${mailOptions.from}`);
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log('Content (HTML):');
      console.log(mailOptions.html);
      console.log('==================================================\n');
      return { messageId: 'mock-email-id-' + Date.now() };
    }
  };
}

export const sendMail = async ({ to, bcc, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Change Management System" <noreply@cms.com>',
      to,
      ...(bcc ? { bcc } : {}),
      subject,
      text: text || '',
      html,
    });
    console.log(`Email successfully sent to ${to}${bcc ? ` (+ BCC: ${bcc})` : ''}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    // Silent catch so SMTP failure does not crash requests/transactions
  }
};
