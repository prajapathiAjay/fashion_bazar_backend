// The email the shop owner gets when someone uses "Send us a message" on the Contact page.

// everything here is typed by a visitor, so make it safe to put inside HTML
const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const row = (label, value) => `
  <tr>
    <td style="padding: 6px 12px 6px 0; color: #6b6474; font-size: 13px; vertical-align: top; white-space: nowrap;">${label}</td>
    <td style="padding: 6px 0; font-size: 14px;">${value}</td>
  </tr>`;

export const contactMessageEmail = ({ name, email, orderId, topic, message }) => `
<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1b1523;">
  <h2 style="margin: 0 0 16px;">New message from the Contact page</h2>
  <table style="border-collapse: collapse; margin-bottom: 16px;">
    ${row("Name", escapeHtml(name))}
    ${row("Email", escapeHtml(email))}
    ${row("Topic", escapeHtml(topic))}
    ${orderId ? row("Order ID", escapeHtml(orderId)) : ""}
  </table>
  <div style="background: #f6f4f8; border-radius: 12px; padding: 16px; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(message)}</div>
  <p style="font-size: 12px; color: #9a94a3; margin-top: 20px;">Press Reply to answer ${escapeHtml(name)} directly.</p>
</div>`;
