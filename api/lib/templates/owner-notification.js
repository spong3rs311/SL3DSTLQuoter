function ownerNotificationTemplate(order) {
  const price = (order.price_cents / 100).toFixed(2);
  const filament = (order.filament_id || '').toUpperCase();
  const preset = order.strength_preset
    ? order.strength_preset.charAt(0).toUpperCase() + order.strength_preset.slice(1)
    : '—';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Order</title></head>
<body style="margin:0;padding:0;background:#0D1117;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1A1F2E;border-radius:8px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#0D1117;padding:24px 32px;border-bottom:2px solid #00E5FF;">
            <span style="font-size:22px;font-weight:700;color:#00E5FF;letter-spacing:1px;">SL|3D</span>
            <span style="font-size:14px;color:#FFFFFF;margin-left:12px;">New Order Notification</span>
          </td>
        </tr>

        <!-- Order summary -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:18px;color:#FFFFFF;font-weight:700;">
              New print order received — action required
            </p>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;width:140px;">Customer</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${esc(order.customer_name)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">Email</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;font-size:13px;">
                  <a href="mailto:${esc(order.customer_email)}" style="color:#00E5FF;text-decoration:none;">${esc(order.customer_email)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">File</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${esc(order.stl_filename)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">Filament</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${filament}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">Strength</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${preset}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">Weight</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${order.weight_g}g</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#8B95A5;font-size:13px;">Est. Print Time</td>
                <td style="padding:8px 0;border-bottom:1px solid #2A3040;color:#FFFFFF;font-size:13px;">${order.print_time_hours}h</td>
              </tr>
              <tr>
                <td style="padding:12px 0 0;color:#8B95A5;font-size:13px;">Order Total</td>
                <td style="padding:12px 0 0;color:#FF6D00;font-size:20px;font-weight:700;">$${price}</td>
              </tr>
            </table>

            <!-- Drive link -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr>
                <td style="background:#0D1117;border-radius:6px;padding:16px;">
                  <p style="margin:0 0 8px;color:#8B95A5;font-size:12px;text-transform:uppercase;letter-spacing:1px;">STL File (Google Drive)</p>
                  <a href="${esc(order.drive_link)}" style="color:#00E5FF;font-size:13px;word-break:break-all;">${esc(order.drive_link)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#0D1117;border-top:1px solid #2A3040;">
            <p style="margin:0;font-size:12px;color:#4A5568;">Saguaro Labs 3D · info@saguarolabs3d.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { ownerNotificationTemplate };
