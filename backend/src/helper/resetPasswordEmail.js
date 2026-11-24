// The email sent when someone clicks "Forgot password".

// the first name is typed by the user, so make it safe to put inside HTML
const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const resetPasswordEmail = (firstName, link) => {
  const name = firstName ? escapeHtml(firstName) : "there";
  return `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1b1523;">
  <h2 style="margin: 0 0 16px;">Reset your password</h2>
  <p>Hi ${name},</p>
  <p>We got a request to reset your Fashion Bazar password. Click the button below to choose a new one.</p>
  <p style="margin: 28px 0;">
    <a href="${link}" style="background: #1b1523; color: #ffffff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">
      Reset password
    </a>
  </p>
  <p style="font-size: 13px; color: #6b6474;">This link expires in 15 minutes and can be used only once.</p>
  <p style="font-size: 13px; color: #6b6474;">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
  <p style="font-size: 12px; color: #9a94a3; word-break: break-all;">Button not working? Copy this link: ${link}</p>
</div>`;
};
