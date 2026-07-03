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

export async function sendScanCompleteEmail(email, twin, portalUrl) {
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
  const heightText = twin.height ? `${twin.height}"` : 'N/A';

  const textContent = `Hi there,

Your AI sizing scan is complete! 🌟

We've successfully processed your scan and calculated your measurements:
- Chest: ${chestText}
- Waist: ${waistText}
- Hips: ${hipsText}
- Height: ${heightText}

To access your Styla dashboard, view all 80+ AI measurements, use the sizing widget on any online store, or share your measurements with a tailor, please complete your registration by setting a password:

${portalUrl}/index.html?action=signup&email=${encodeURIComponent(email)}

Best regards,
The Styla Team`;

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
        from,
        to: email,
        subject,
        text: textContent
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
      from: `"Styla Sandbox" <${testAccount.user}>`,
      to: email,
      subject: `[SANDBOX] ${subject}`,
      text: textContent
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
