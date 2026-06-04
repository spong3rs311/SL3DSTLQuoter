const nodemailer = require('nodemailer');
const { ownerNotificationTemplate } = require('./templates/owner-notification');
const { customerConfirmationTemplate } = require('./templates/customer-confirmation');

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendOwnerNotification(order) {
  const transport = createTransport();
  await transport.sendMail({
    from: `"Saguaro Labs 3D" <${process.env.GMAIL_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: `New 3D Print Order — ${order.stl_filename}`,
    html: ownerNotificationTemplate(order),
  });
}

async function sendCustomerConfirmation(customerEmail, order) {
  const transport = createTransport();
  await transport.sendMail({
    from: `"Saguaro Labs 3D" <${process.env.GMAIL_USER}>`,
    to: customerEmail,
    subject: 'Your Saguaro Labs 3D order is confirmed',
    html: customerConfirmationTemplate(order),
  });
}

async function sendOwnerManualQuoteAlert(customerInfo, driveLink) {
  const transport = createTransport();
  const { name, email, notes, filename } = customerInfo;
  await transport.sendMail({
    from: `"Saguaro Labs 3D" <${process.env.GMAIL_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: `Manual Quote Request — ${filename || 'unknown file'}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0D1117;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1A1F2E;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#0D1117;padding:24px 32px;border-bottom:2px solid #00E5FF;">
            <span style="font-size:22px;font-weight:700;color:#00E5FF;letter-spacing:1px;">SL|3D</span>
            <span style="font-size:14px;color:#FFFFFF;margin-left:12px;">Manual Quote Request</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:18px;color:#FFFFFF;font-weight:700;">
              Manual quote requested — review required
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;width:140px;">Customer</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${esc(name)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">Email</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;font-size:13px;">
                  <a href="mailto:${esc(email)}" style="color:#00E5FF;text-decoration:none;">${esc(email)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">File</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${esc(filename || '—')}</td>
              </tr>
              ${notes ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">Notes</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${esc(notes)}</td>
              </tr>` : ''}
            </table>
            ${driveLink ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr>
                <td style="background:#0D1117;border-radius:6px;padding:16px;">
                  <p style="margin:0 0 8px;color:#8B95A5;font-size:12px;text-transform:uppercase;letter-spacing:1px;">STL File (Google Drive)</p>
                  <a href="${esc(driveLink)}" style="color:#00E5FF;font-size:13px;word-break:break-all;">${esc(driveLink)}</a>
                </td>
              </tr>
            </table>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#0D1117;border-top:1px solid #2A3040;">
            <p style="margin:0;font-size:12px;color:#4A5568;">Saguaro Labs 3D · info@saguarolabs3d.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { sendOwnerNotification, sendCustomerConfirmation, sendOwnerManualQuoteAlert };
