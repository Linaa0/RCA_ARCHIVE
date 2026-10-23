/**
 * RCA Archive Branded Email Templates
 *
 * Professional table-based HTML layout with inline CSS, bgcolor attributes for dark mode email clients,
 * inline CID logo attachment, and clean non-spammy copy without emojis or em dashes.
 */

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function baseLayout({ title, previewText, contentHtml }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(title)}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #EEF0F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1B2142; }
    .email-code-box { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #232C6B; background-color: #F4F6FD; border: 2px dashed #3F4FA8; border-radius: 8px; padding: 18px 24px; text-align: center; }
    .btn-action { display: inline-block; background-color: #3F4FA8; color: #FFFFFF !important; font-weight: 700; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 999px; }
  </style>
</head>
<body bgcolor="#EEF0F6" style="margin: 0; padding: 0; background-color: #EEF0F6; color: #1B2142;">
  <!-- Preview Text Spacing Hack -->
  <div style="display: none; font-size: 1px; color: #EEF0F6; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(previewText || title)}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#EEF0F6" style="background-color: #EEF0F6;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Main Email Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(35, 44, 107, 0.08);">
          <!-- Header Band -->
          <tr>
            <td bgcolor="#232C6B" style="background-color: #232C6B; padding: 24px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="48" valign="middle">
                    <img src="cid:rcalogo" alt="RCA" width="44" height="44" style="display: block; width: 44px; height: 44px; object-fit: contain;" />
                  </td>
                  <td valign="middle" style="padding-left: 14px;">
                    <span style="font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">RCA Archive</span>
                    <br />
                    <span style="font-size: 12px; color: #C7D2FE; font-weight: 500;">Academic Knowledge Portal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td bgcolor="#FFFFFF" style="background-color: #FFFFFF; padding: 36px 32px 28px 32px; font-size: 15px; line-height: 1.6; color: #1B2142;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer Divider -->
          <tr>
            <td bgcolor="#FFFFFF" style="padding: 0 32px;">
              <div style="border-top: 1px solid #E4E8F2; height: 1px;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#FFFFFF" style="background-color: #FFFFFF; padding: 24px 32px 32px 32px; font-size: 12px; line-height: 1.5; color: #6A7399; text-align: center;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #343D68;">Rwanda Coding Academy</p>
              <p style="margin: 0 0 8px 0;">Nyabihu Campus, Western Province, Rwanda</p>
              <p style="margin: 0; color: #8E98BF;">This message was generated automatically by the RCA Archive portal. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getSignupVerificationTemplate({ code, expiryMinutes = 15 }) {
  const subject = `RCA Archive: your verification code is ${code}`;
  const text = `RCA Archive

Your single-use verification code is: ${code}

This code is valid for ${expiryMinutes} minutes.

Enter this code in your browser to complete your account registration.

If you did not request this verification code, please disregard this email.

Rwanda Coding Academy, Nyabihu Campus, Western Province, Rwanda.`;

  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1B2142;">Verify your email address</h2>
    <p style="margin: 0 0 20px 0; color: #343D68;">Welcome to RCA Archive. Use the single-use verification code below to complete your registration:</p>

    <div style="margin: 24px 0; text-align: center;">
      <div class="email-code-box" style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #232C6B; background-color: #F4F6FD; border: 2px dashed #3F4FA8; border-radius: 8px; padding: 18px 24px; display: inline-block;">
        ${escapeHtml(code)}
      </div>
    </div>

    <p style="margin: 0 0 16px 0; font-size: 14px; color: #343D68;">
      <strong>Note:</strong> This code is valid for ${expiryMinutes} minutes and can only be used once.
    </p>

    <p style="margin: 0; font-size: 13px; color: #6A7399; line-height: 1.5;">
      If you did not initiate this request, no action is required and your email has not been registered.
    </p>
  `;

  return {
    subject,
    text,
    html: baseLayout({ title: subject, previewText: `Your verification code is ${code}`, contentHtml }),
  };
}

function getInvitationTemplate({ name, role, setupUrl, temporaryPassword }) {
  const roleLabel = role === "admin" ? "administrator" : role === "teacher" ? "teacher" : "student";
  const subject = `RCA Archive: set up your ${roleLabel} account`;
  const text = `Hello ${name || "there"},

An RCA Archive ${roleLabel} account has been created for you.

Please complete your profile and set your password using the secure link below:
${setupUrl}

${temporaryPassword ? `Temporary password: ${temporaryPassword}\n\n` : ""}This setup link is valid for 24 hours.

Rwanda Coding Academy, Nyabihu Campus, Western Province, Rwanda.`;

  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1B2142;">Set up your ${escapeHtml(roleLabel)} account</h2>
    <p style="margin: 0 0 16px 0; color: #343D68;">Hello <strong>${escapeHtml(name || "there")}</strong>,</p>
    <p style="margin: 0 0 24px 0; color: #343D68;">
      An official RCA Archive account has been provisioned for you with the <strong>${escapeHtml(roleLabel)}</strong> role. Please set your account password to begin accessing syllabus past papers and teaching materials:
    </p>

    <div style="margin: 28px 0; text-align: center;">
      <a href="${escapeHtml(setupUrl)}" class="btn-action" style="display: inline-block; background-color: #3F4FA8; color: #FFFFFF !important; font-weight: 700; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 999px;">
        Set Account Password
      </a>
    </div>

    ${
      temporaryPassword
        ? `<div style="margin: 20px 0; padding: 12px 18px; background-color: #F8F9FD; border: 1px solid #E4E8F2; border-radius: 8px;">
            <span style="font-size: 13px; color: #6A7399;">Temporary Password:</span>
            <code style="display: block; font-size: 15px; font-weight: 700; color: #232C6B; margin-top: 4px;">${escapeHtml(temporaryPassword)}</code>
          </div>`
        : ""
    }

    <p style="margin: 20px 0 8px 0; font-size: 13px; color: #6A7399;">
      Or copy and paste this link into your browser:
      <br />
      <a href="${escapeHtml(setupUrl)}" style="color: #4B62CE; word-break: break-all;">${escapeHtml(setupUrl)}</a>
    </p>

    <p style="margin: 16px 0 0 0; font-size: 13px; color: #6A7399;">
      This link is valid for 24 hours.
    </p>
  `;

  return {
    subject,
    text,
    html: baseLayout({ title: subject, previewText: `Set up your ${roleLabel} account on RCA Archive`, contentHtml }),
  };
}

function getPasswordResetTemplate({ name, resetUrl, code }) {
  const subject = "RCA Archive: reset your password";
  const text = `Hello ${name || "there"},

We received a request to reset your RCA Archive account password.

Click the link below or enter your reset code to choose a new password:
${resetUrl}

${code ? `Verification code: ${code}\n\n` : ""}This password reset link is valid for 60 minutes.

If you did not request a password reset, please ignore this email. Your current password remains secure.

Rwanda Coding Academy, Nyabihu Campus, Western Province, Rwanda.`;

  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1B2142;">Password Reset Request</h2>
    <p style="margin: 0 0 16px 0; color: #343D68;">Hello <strong>${escapeHtml(name || "there")}</strong>,</p>
    <p style="margin: 0 0 24px 0; color: #343D68;">
      We received a request to reset your RCA Archive password. Use the secure button below to set a new password for your account:
    </p>

    <div style="margin: 28px 0; text-align: center;">
      <a href="${escapeHtml(resetUrl)}" class="btn-action" style="display: inline-block; background-color: #3F4FA8; color: #FFFFFF !important; font-weight: 700; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 999px;">
        Reset Password
      </a>
    </div>

    ${
      code
        ? `<div style="margin: 20px 0; text-align: center;">
            <span style="font-size: 13px; color: #6A7399;">Or enter this code on the reset page:</span>
            <div class="email-code-box" style="margin-top: 8px; font-family: monospace; font-size: 24px; letter-spacing: 4px; font-weight: 700; color: #232C6B; background-color: #F4F6FD; padding: 10px 18px; border-radius: 6px; display: inline-block;">${escapeHtml(code)}</div>
          </div>`
        : ""
    }

    <p style="margin: 20px 0 8px 0; font-size: 13px; color: #6A7399;">
      Or open this link directly:
      <br />
      <a href="${escapeHtml(resetUrl)}" style="color: #4B62CE; word-break: break-all;">${escapeHtml(resetUrl)}</a>
    </p>

    <p style="margin: 16px 0 0 0; font-size: 13px; color: #6A7399;">
      This link is valid for 60 minutes. If you did not request this, you can safely disregard this message.
    </p>
  `;

  return {
    subject,
    text,
    html: baseLayout({ title: subject, previewText: "Reset your RCA Archive account password", contentHtml }),
  };
}

function getDeletionDecisionTemplate({ name, paperTitle, status, notes }) {
  const approved = status === "Approved";
  const decisionText = approved ? "Approved" : "Rejected";
  const subject = `RCA Archive: deletion request ${decisionText.toLowerCase()}`;
  const paperName = paperTitle || "Academic past paper";

  const text = `Hello ${name || "there"},

Your deletion request for the resource "${paperName}" has been ${decisionText.toLowerCase()}.

${approved ? "The resource has been permanently removed from the archive." : "The resource remains archived. Reason: " + (notes || "Content complies with archival guidelines.")}

Rwanda Coding Academy, Nyabihu Campus, Western Province, Rwanda.`;

  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1B2142;">Deletion Request Update</h2>
    <p style="margin: 0 0 16px 0; color: #343D68;">Hello <strong>${escapeHtml(name || "there")}</strong>,</p>
    <p style="margin: 0 0 20px 0; color: #343D68;">
      An administrator has reviewed your content deletion request regarding:
    </p>

    <div style="margin: 20px 0; padding: 16px 20px; background-color: #F8F9FD; border-left: 4px solid ${approved ? "#10B981" : "#EF4444"}; border-radius: 6px;">
      <strong style="display: block; font-size: 15px; color: #1B2142; margin-bottom: 4px;">${escapeHtml(paperName)}</strong>
      <span style="font-size: 13px; font-weight: 700; color: ${approved ? "#10B981" : "#EF4444"}; text-transform: uppercase;">
        Status: ${escapeHtml(decisionText)}
      </span>
      ${notes ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #6A7399;">${escapeHtml(notes)}</p>` : ""}
    </div>

    <p style="margin: 0; font-size: 13px; color: #6A7399;">
      ${approved ? "The document and its associated records have been cleared from the repository." : "The document remains available in accordance with RCA syllabus documentation policies."}
    </p>
  `;

  return {
    subject,
    text,
    html: baseLayout({ title: subject, previewText: `Deletion request update for ${paperName}`, contentHtml }),
  };
}

function getGenericNotificationTemplate({ name, title, message, actionUrl, actionText }) {
  const subject = `RCA Archive: ${title}`;
  const text = `Hello ${name || "there"},

${message}

${actionUrl ? `${actionText || "View details"}: ${actionUrl}\n\n` : ""}Rwanda Coding Academy, Nyabihu Campus, Western Province, Rwanda.`;

  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1B2142;">${escapeHtml(title)}</h2>
    <p style="margin: 0 0 16px 0; color: #343D68;">Hello <strong>${escapeHtml(name || "there")}</strong>,</p>
    <p style="margin: 0 0 24px 0; color: #343D68; line-height: 1.6;">${escapeHtml(message)}</p>

    ${
      actionUrl
        ? `<div style="margin: 24px 0; text-align: center;">
            <a href="${escapeHtml(actionUrl)}" class="btn-action" style="display: inline-block; background-color: #3F4FA8; color: #FFFFFF !important; font-weight: 700; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 999px;">
              ${escapeHtml(actionText || "View Details")}
            </a>
          </div>`
        : ""
    }
  `;

  return {
    subject,
    text,
    html: baseLayout({ title: subject, previewText: title, contentHtml }),
  };
}

module.exports = {
  getSignupVerificationTemplate,
  getInvitationTemplate,
  getPasswordResetTemplate,
  getDeletionDecisionTemplate,
  getGenericNotificationTemplate,
  baseLayout,
};
