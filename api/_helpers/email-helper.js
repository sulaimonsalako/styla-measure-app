import nodemailer from 'nodemailer';

export async function sendEmailNotification(cartId, role, amount) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'no-reply@styla.ca';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@styla.ca';

  const subject = `[STYLA STORE] New Group Payment Received - Cart ${cartId}`;
  const textContent = `Hello Admin,

A new payment share has been received for STYLA group cart ${cartId}!

Payment Details:
- Cart ID: ${cartId}
- Share Paid: ${role.toUpperCase()}
- Amount Paid: $${Number(amount).toFixed(2)}

Please view the full order and tailoring measurements in the admin panel:
https://www.styla.ca/store/admin.html

Best regards,
STYLA Order System`;

  console.log(`[EMAIL NOTIFICATION PENDING] Sending notification email for Cart ${cartId}...`);

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from,
        to: adminEmail,
        subject,
        text: textContent
      });

      console.log(`[EMAIL NOTIFICATION SENT] SMTP Success: Message ID ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[EMAIL NOTIFICATION ERROR] SMTP failed:", err.message);
    }
  }

  // Fallback to Ethereal mock email for easy testing
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await transporter.sendMail({
      from: `"STYLA Sandbox" <${testAccount.user}>`,
      to: adminEmail,
      subject: `[SANDBOX] ${subject}`,
      text: textContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[EMAIL NOTIFICATION MOCK] Ethereal Success!`);
    console.log(`  - Preview URL: ${previewUrl}`);
    console.log(`  - Recipient: ${adminEmail}`);
    return { success: true, previewUrl };
  } catch (ethErr) {
    console.error("[EMAIL NOTIFICATION MOCK ERROR] Ethereal fallback failed:", ethErr.message);
    // Simple console logger fallback
    console.log(`--------------------------------------------------`);
    console.log(`MOCK EMAIL REPORT (Console Fallback)`);
    console.log(`Subject: ${subject}`);
    console.log(`Recipient: ${adminEmail}`);
    console.log(`Body:\n${textContent}`);
    console.log(`--------------------------------------------------`);
    return { success: true, logged: true };
  }
}


export async function sendBatchFullyPaidEmail(cart) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'no-reply@styla.ca';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@styla.ca';

  // Gather items list
  let itemsListText = '';
  const creatorItems = cart.creatorItems || [];
  const friendItems = cart.friendItems || [];
  
  creatorItems.forEach(item => {
    itemsListText += `- [Creator] ${item.quantity}x ${item.name} (${item.size}) - Bulk: $${item.bulkPrice}\n`;
  });
  friendItems.forEach(item => {
    itemsListText += `- [Friend] ${item.quantity}x ${item.name} (${item.size}) - Bulk: $${item.bulkPrice}\n`;
  });

  const subject = `[STYLA] Consolidated Shipping Started - Batch Cart #${cart.id}`;
  const textContent = `Hi there,

Exciting news! All shares for your STYLA group cart #${cart.id} have been fully paid.

Your consolidated order is now being processed by our Chinese manufacturer suppliers. The items will be packed and shipped together via China Air Cargo to minimize logistics costs and carbon footprint.

Order Details:
- Cart ID: ${cart.id}
- Items Ordered:
${itemsListText}
Shipping Status:
- Status: Fully Paid & Consolidated Shipping Initiated
- Method: China Air Cargo (Consolidated)

Thank you for shopping with STYLA!

Best regards,
STYLA Logistics Team`;

  const recipients = [];
  if (cart.creatorEmail) recipients.push(cart.creatorEmail);
  if (cart.friendEmail) recipients.push(cart.friendEmail);

  if (recipients.length === 0) {
    console.log(`[BATCH PAID EMAIL] No recipient emails found for Cart ${cart.id}. Skipping email dispatch.`);
    return { skipped: true };
  }

  console.log(`[BATCH PAID EMAIL PENDING] Sending dispatch notification to: ${recipients.join(', ')}...`);

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from,
        to: recipients.join(', '),
        subject,
        text: textContent
      });

      console.log(`[BATCH PAID EMAIL SENT] SMTP Success: Message ID ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[BATCH PAID EMAIL ERROR] SMTP failed:", err.message);
    }
  }

  // Fallback to Ethereal mock
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await transporter.sendMail({
      from: `"STYLA Sandbox" <${testAccount.user}>`,
      to: recipients.join(', '),
      subject: `[SANDBOX] ${subject}`,
      text: textContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[BATCH PAID EMAIL MOCK] Ethereal Success!`);
    console.log(`  - Preview URL: ${previewUrl}`);
    console.log(`  - Recipients: ${recipients.join(', ')}`);
    return { success: true, previewUrl };
  } catch (ethErr) {
    console.error("[BATCH PAID EMAIL MOCK ERROR] Ethereal fallback failed:", ethErr.message);
    // Console fallback
    console.log(`--------------------------------------------------`);
    console.log(`MOCK BATCH PAID EMAIL REPORT (Console Fallback)`);
    console.log(`Subject: ${subject}`);
    console.log(`Recipients: ${recipients.join(', ')}`);
    console.log(`Body:\n${textContent}`);
    console.log(`--------------------------------------------------`);
    return { success: true, logged: true };
  }
}

export async function sendScanCompleteEmail(email, twin, portalUrl, firstName = '') {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'no-reply@styla.ca';

  const subject = `Styla Sizing Scan Complete! 🌟 Complete your registration`;
  
  // Format core measurements for the email
  const chestText = twin.chest ? `${twin.chest}"` : 'N/A';
  const waistText = twin.waist ? `${twin.waist}"` : 'N/A';
  const hipsText = twin.hips ? `${twin.hips}"` : 'N/A';
  
  // Format height nicely
  let heightText = 'N/A';
  if (twin.height) {
    const totalInches = Math.round(parseFloat(twin.height));
    const ft = Math.floor(totalInches / 12);
    const inch = totalInches % 12;
    heightText = `${ft}ft ${inch}in`;
  }

  const textContent = `Hi ${firstName || 'there'},

Your AI sizing scan is complete! 🌟

We've successfully processed your scan and calculated your measurements:
- Chest: ${chestText}
- Waist: ${waistText}
- Hips: ${hipsText}
- Height: ${heightText}

To access your Styla dashboard, view all 80+ AI measurements, use the sizing widget on online stores, or share your measurements with a tailor, please complete your registration by setting a password:

${portalUrl}/index.html?action=signup&email=${encodeURIComponent(email)}

Best regards,
The Styla Team`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #e11d48 0%, #ff2a75 100%);
      padding: 35px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .content {
      padding: 35px 25px;
    }
    .greeting {
      font-size: 20px;
      color: #0f172a;
      font-weight: 700;
      margin-bottom: 15px;
    }
    .lead {
      font-size: 15.5px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 25px;
    }
    .measurements-card {
      background-color: rgba(225, 29, 72, 0.03);
      border: 1px solid rgba(225, 29, 72, 0.12);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .measurements-card h3 {
      color: #ff2a75;
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 13.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
    }
    .steps-section {
      margin-bottom: 35px;
    }
    .steps-section h3 {
      color: #0f172a;
      font-size: 16.5px;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      padding-bottom: 8px;
      font-weight: 700;
    }
    .step-item {
      display: flex;
      margin-bottom: 18px;
      align-items: flex-start;
    }
    .step-number {
      background: linear-gradient(135deg, #e11d48 0%, #ff2a75 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .step-text {
      color: #475569;
      font-size: 14.5px;
      line-height: 1.5;
    }
    .step-text strong {
      color: #0f172a;
      font-weight: 600;
    }
    .cta-container {
      text-align: center;
      margin: 35px 0 15px;
    }
    .btn {
      background: linear-gradient(135deg, #e11d48 0%, #ff2a75 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 35px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      display: inline-block;
      box-shadow: 0 4px 15px rgba(225, 29, 72, 0.25);
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px;
      text-align: center;
      border-top: 1px solid rgba(0, 0, 0, 0.04);
    }
    .footer p {
      color: #94a3b8;
      font-size: 12px;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Styla Measure</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${firstName || 'there'},</div>
      <div class="lead">Your AI sizing scan is complete! 🌟 We've successfully calculated your tailor-grade measurements.</div>
      
      <div class="measurements-card">
        <h3>Core Measurements</h3>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); color:#64748b; font-size:14.5px;">Chest / Bust</td>
            <td style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); color:#0f172a; font-weight:700; text-align:right; font-size:16px;">${chestText}</td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); color:#64748b; font-size:14.5px;">Waist</td>
            <td style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); color:#0f172a; font-weight:700; text-align:right; font-size:16px;">${waistText}</td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); color:#64748b; font-size:14.5px;">Hips</td>
            <td style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); color:#0f172a; font-weight:700; text-align:right; font-size:16px;">${hipsText}</td>
          </tr>
          <tr>
            <td style="padding:10px 0; color:#64748b; font-size:14.5px;">Total Height</td>
            <td style="padding:10px 0; color:#0f172a; font-weight:700; text-align:right; font-size:16px;">${heightText}</td>
          </tr>
        </table>
      </div>

      <div class="steps-section">
        <h3>Your Next Steps</h3>
        
        <div class="step-item">
          <div class="step-number">1</div>
          <div class="step-text">
            <strong>Complete your sign up:</strong> Click the button below to set your account password. This gives you instant access to your Styla dashboard to view all 80+ calculated measurements.
          </div>
        </div>

        <div class="step-item">
          <div class="step-number">2</div>
          <div class="step-text">
            <strong>Add the Styla Bookmarklet:</strong> Install the Sizing Bookmarklet on your Chrome, Edge, or Brave desktop browser to find your perfect size automatically on any retail clothing website.
          </div>
        </div>

        <div class="step-item">
          <div class="step-number">3</div>
          <div class="step-text">
            <strong>Safari Extension:</strong> We are actively building our Safari mobile & desktop extension, which will be released very soon!
          </div>
        </div>

        <div class="step-item">
          <div class="step-number">4</div>
          <div class="step-text">
            <strong>Email or Export to Tailor:</strong> Download a clean PDF export of your measurements or email them directly to your custom tailor or designer.
          </div>
        </div>
      </div>

      <div class="cta-container">
        <a href="${portalUrl}/index.html?action=signup&email=${encodeURIComponent(email)}" class="btn">Complete Sign Up</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Styla. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  console.log(`[SCAN COMPLETE EMAIL PENDING] Sending confirmation to ${email}...`);

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from: `"Styla Measure" <${from}>`,
        to: email,
        subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[SCAN COMPLETE EMAIL SENT] Success: Message ID ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[SCAN COMPLETE EMAIL ERROR] SMTP failed:", err.message);
    }
  }

  // Fallback to Ethereal mock
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await transporter.sendMail({
      from: `"Styla Measure" <${testAccount.user}>`,
      to: email,
      subject: `[SANDBOX] ${subject}`,
      text: textContent,
      html: htmlContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[SCAN COMPLETE EMAIL MOCK] Ethereal Success! Preview: ${previewUrl}`);
    return { success: true, previewUrl };
  } catch (ethErr) {
    console.error("[SCAN COMPLETE EMAIL MOCK ERROR] Ethereal failed:", ethErr.message);
    return { success: true, logged: true };
  }
}

// ---------------------------------------------------------------------------
// Styla product emails (new questionnaire / brand-match model)
// Shared dark-theme builder + a single transport, so every product email is
// consistent and we don't repeat the HTML. Sends via SendGrid SMTP when the
// SMTP_* env vars are set; falls back to an Ethereal preview in dev.
// ---------------------------------------------------------------------------

const STYLA_SITE = process.env.SITE_URL || 'https://www.styla.ca';
const STYLA_LOGO = `${STYLA_SITE}/logo.png`;

function buildStylaEmail({ heading, bodyHtml, ctaText, ctaUrl, receiptHtml = '', footerNote = '' }) {
  const cta = ctaText && ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block; background:linear-gradient(135deg,#e11d48,#ff2a75); color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; padding:14px 36px; border-radius:100px;">${ctaText}</a>`
    : '';
  const receipt = receiptHtml
    ? `<div style="margin-top:32px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.08); text-align:left; font-size:13px; color:#8b90a0;">${receiptHtml}</div>`
    : '';
  const footer = footerNote
    ? `<p style="text-align:center; font-size:12px; color:#5a5f70; margin-top:24px;">${footerNote}</p>`
    : '';
  return `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#0b0b14; color:#ffffff; padding:40px 20px; max-width:600px; margin:0 auto; border-radius:8px;">
  <div style="text-align:center; margin-bottom:30px;">
    <img src="${STYLA_LOGO}" alt="Styla" width="40" height="40" style="border-radius:50%; vertical-align:middle; margin-right:10px;" />
    <span style="color:#ffffff; font-size:30px; letter-spacing:3px; font-weight:bold; font-family:Georgia,'Times New Roman',serif; vertical-align:middle;">STYLA</span>
  </div>
  <div style="background-color:#16162a; padding:40px; border-radius:12px; text-align:center; border:1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size:22px; margin-top:0; margin-bottom:15px; color:#ffffff; font-family:Georgia,'Times New Roman',serif;">${heading}</h2>
    <div style="font-size:16px; line-height:1.6; color:#cbd5e1; margin-bottom:28px;">${bodyHtml}</div>
    ${cta}
    ${receipt}
  </div>
  ${footer}
  <p style="text-align:center; font-size:12px; color:#5a5f70; margin-top:6px;">&copy; Styla &middot; Your body. Your size. Everywhere.</p>
</div>`;
}

async function sendStylaMail(to, subject, html, text) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'contact@styla.ca';

  if (!to) {
    console.log('[STYLA EMAIL] No recipient — skipping.');
    return { skipped: true };
  }

  console.log(`[STYLA EMAIL PENDING] "${subject}" -> ${to}`);

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host, port, secure: port === 465, auth: { user, pass }
      });
      const info = await transporter.sendMail({
        from: `"Styla" <${from}>`, to, subject, text, html
      });
      console.log(`[STYLA EMAIL SENT] ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[STYLA EMAIL ERROR] SMTP failed:', err.message);
    }
  }

  // Dev fallback: Ethereal preview
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587, secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    const info = await transporter.sendMail({
      from: `"Styla Sandbox" <${testAccount.user}>`, to, subject: `[SANDBOX] ${subject}`, text, html
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[STYLA EMAIL MOCK] Preview: ${previewUrl}`);
    return { success: true, previewUrl };
  } catch (ethErr) {
    console.error('[STYLA EMAIL MOCK ERROR]', ethErr.message);
    return { success: true, logged: true };
  }
}

// #7 — Match unlock receipt ($9.99)
export async function sendMatchUnlockEmail(email, firstName, { amount = '$9.99', orderId = '', purchaseDate = '', dashboardUrl } = {}) {
  const url = dashboardUrl || `${STYLA_SITE}/dashboard.html`;
  const name = firstName || 'there';
  const html = buildStylaEmail({
    heading: "You're all unlocked 🎉",
    bodyHtml: `Thanks, ${name}. Your full list of matching brands &mdash; with your size in each &mdash; is now open on your dashboard.`,
    ctaText: 'See all my matches',
    ctaUrl: url,
    receiptHtml: `<strong style="color:#cbd5e1;">Receipt</strong><br/>Full brand-match unlock &mdash; ${amount}<br/>${[purchaseDate, orderId && `Order ${orderId}`].filter(Boolean).join(' &middot; ')}`,
    footerNote: "Need help? Reply to this email and we'll sort it out."
  });
  const text = `Thanks, ${name}. Your full list of matching brands is unlocked: ${url}\n\nReceipt: Full brand-match unlock — ${amount} ${orderId ? `(Order ${orderId})` : ''}`;
  return sendStylaMail(email, 'Your full brand-match list is unlocked', html, text);
}

// #10 — Wedding party report ready ($29.99)
export async function sendWeddingReportEmail(email, firstName, { amount = '$29.99', orderId = '', purchaseDate = '', partyName = 'your party', reportUrl } = {}) {
  const url = reportUrl || `${STYLA_SITE}/dashboard.html`;
  const name = firstName || 'there';
  const html = buildStylaEmail({
    heading: "The whole party's matches are unlocked 🎉",
    bodyHtml: `Thanks, ${name}. Your Brand Fit Match Report for <strong style="color:#ffffff;">${partyName}</strong> is ready &mdash; the styles that fit everyone, with each person's size listed.`,
    ctaText: 'Open the report',
    ctaUrl: url,
    receiptHtml: `<strong style="color:#cbd5e1;">Receipt</strong><br/>Wedding-party fit report &mdash; ${amount}<br/>${[purchaseDate, orderId && `Order ${orderId}`].filter(Boolean).join(' &middot; ')}`,
    footerNote: 'Need a hand? Reply to this email.'
  });
  const text = `Thanks, ${name}. Your wedding-party fit report for ${partyName} is ready: ${url}\n\nReceipt: Wedding-party fit report — ${amount} ${orderId ? `(Order ${orderId})` : ''}`;
  return sendStylaMail(email, 'Your wedding-party fit report is ready', html, text);
}

// #6 — Welcome (call after signup/confirmation when you have a trigger)
export async function sendStylaWelcomeEmail(email, firstName, { dashboardUrl } = {}) {
  const url = dashboardUrl || `${STYLA_SITE}/dashboard.html`;
  const name = firstName || 'there';
  const html = buildStylaEmail({
    heading: `Welcome to Styla, ${name}`,
    bodyHtml: `Your fit profile is saved. Here's what you can do now:<br/><br/>
      <span style="display:inline-block; text-align:left; max-width:420px;">
      &#10003;&nbsp; See the brands cut for your body, ranked by fit<br/>
      &#10003;&nbsp; Get your recommended size in each one<br/>
      &#10003;&nbsp; Add the free bookmarklet to check your size on any site<br/>
      &#10003;&nbsp; Edit your profile any time &mdash; matches update instantly
      </span>`,
    ctaText: 'Open my dashboard',
    ctaUrl: url,
    footerNote: 'Questions? Just reply to this email.'
  });
  const text = `Welcome to Styla, ${name}. Your fit profile is saved — open your dashboard: ${url}`;
  return sendStylaMail(email, `You're in, ${name} — here are your brand matches`, html, text);
}

// #8 — Wedding party invite (call when a coordinator invites a member)
export async function sendWeddingInviteEmail(email, { coordinatorName = 'A friend', partyName = 'their wedding party', inviteUrl } = {}) {
  const html = buildStylaEmail({
    heading: `You're invited to "${partyName}"`,
    bodyHtml: `${coordinatorName} is using Styla to find one style that fits everyone in the party &mdash; with each person in their own correct size. Answer a few quick questions to add your fit. No measuring, no photos, and it's private to the group.`,
    ctaText: 'Add my fit',
    ctaUrl: inviteUrl || STYLA_SITE,
    footerNote: "Not expecting this? You can ignore it — nothing was shared about you."
  });
  const text = `${coordinatorName} invited you to "${partyName}" on Styla. Add your fit: ${inviteUrl || STYLA_SITE}`;
  return sendStylaMail(email, `${coordinatorName} invited you to their wedding party on Styla`, html, text);
}

// #9 — Party member joined (notify the coordinator)
export async function sendPartyMemberJoinedEmail(email, { memberName = 'Someone', partyName = 'your party', filledCount, totalCount, partyUrl } = {}) {
  const progress = (filledCount != null && totalCount != null)
    ? `${filledCount} of ${totalCount} people in <strong style="color:#ffffff;">${partyName}</strong> have added their fit. Once everyone's in, you can unlock the styles that fit the whole party.`
    : `${memberName} added their fit to <strong style="color:#ffffff;">${partyName}</strong>.`;
  const html = buildStylaEmail({
    heading: `${memberName} is in ✅`,
    bodyHtml: progress,
    ctaText: 'View the party',
    ctaUrl: partyUrl || `${STYLA_SITE}/dashboard.html`
  });
  const text = `${memberName} added their fit to ${partyName}. View the party: ${partyUrl || `${STYLA_SITE}/dashboard.html`}`;
  return sendStylaMail(email, `${memberName} just added their fit to ${partyName}`, html, text);
}

export async function sendScanAbandonedEmail(email, portalUrl) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'no-reply@styla.ca';

  const subject = `Finish your Styla 3D body scan ⚡`;
  const textContent = `Hi there,

It looks like you started setting up your Styla profile but didn't complete your 3D body scan.

With Styla, you can scan in just 30 seconds using your phone camera to instantly find your size on any online store, export your measurements, or share them with a tailor.

Click here to complete your scan and get your sizing profile:
${portalUrl}/index.html?email=${encodeURIComponent(email)}

Best regards,
The Styla Team`;

  console.log(`[SCAN ABANDONED EMAIL PENDING] Sending reminder to ${email}...`);

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from,
        to: email,
        subject,
        text: textContent
      });

      console.log(`[SCAN ABANDONED EMAIL SENT] Success: Message ID ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[SCAN ABANDONED EMAIL ERROR] SMTP failed:", err.message);
    }
  }

  // Fallback to Ethereal mock
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await transporter.sendMail({
      from: `"Styla Sandbox" <${testAccount.user}>`,
      to: email,
      subject: `[SANDBOX] ${subject}`,
      text: textContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[SCAN ABANDONED EMAIL MOCK] Ethereal Success! Preview: ${previewUrl}`);
    return { success: true, previewUrl };
  } catch (ethErr) {
    console.error("[SCAN ABANDONED EMAIL MOCK ERROR] Ethereal failed:", ethErr.message);
    return { success: true, logged: true };
  }
}
