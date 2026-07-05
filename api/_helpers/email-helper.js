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
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f0c1b;
      color: #e2e8f0;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #16122c;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #ff2a75 0%, #e11d48 100%);
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .content {
      padding: 35px 25px;
    }
    .greeting {
      font-size: 20px;
      color: #ffffff;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .lead {
      font-size: 16px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 30px;
    }
    .measurements-card {
      background-color: rgba(225, 29, 72, 0.04);
      border: 1px solid rgba(225, 29, 72, 0.15);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .measurements-card h3 {
      color: #ff2a75;
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
    }
    .steps-section {
      margin-bottom: 35px;
    }
    .steps-section h3 {
      color: #ffffff;
      font-size: 17px;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 8px;
      font-weight: 700;
    }
    .step-item {
      display: flex;
      margin-bottom: 18px;
      align-items: flex-start;
    }
    .step-number {
      background: linear-gradient(135deg, #ff2a75 0%, #e11d48 100%);
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
      color: #cbd5e1;
      font-size: 14.5px;
      line-height: 1.5;
    }
    .step-text strong {
      color: #ffffff;
      font-weight: 600;
    }
    .cta-container {
      text-align: center;
      margin: 35px 0 15px;
    }
    .btn {
      background: linear-gradient(135deg, #ff2a75 0%, #e11d48 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 35px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      display: inline-block;
      box-shadow: 0 4px 15px rgba(225, 29, 72, 0.4);
    }
    .footer {
      background-color: #0c0919;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #1e193b;
    }
    .footer p {
      color: #64748b;
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
            <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#cbd5e1; font-size:14.5px;">Chest / Bust</td>
            <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#ffffff; font-weight:700; text-align:right; font-size:16px;">${chestText}</td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#cbd5e1; font-size:14.5px;">Waist</td>
            <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#ffffff; font-weight:700; text-align:right; font-size:16px;">${waistText}</td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#cbd5e1; font-size:14.5px;">Hips</td>
            <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#ffffff; font-weight:700; text-align:right; font-size:16px;">${hipsText}</td>
          </tr>
          <tr>
            <td style="padding:10px 0; color:#cbd5e1; font-size:14.5px;">Total Height</td>
            <td style="padding:10px 0; color:#ffffff; font-weight:700; text-align:right; font-size:16px;">${heightText}</td>
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
