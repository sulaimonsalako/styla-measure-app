# Styla — Email Templates

All emails in one place, in the Styla dark/pink style. Two groups:

- **A. Supabase Auth emails** — paste into Supabase → Authentication → Emails. Work immediately.
- **B. Product emails** — triggered by app events (payment, wedding party). Need a sender
  (Resend/Postmark) wired up before they can go out. Placeholders like `{{first_name}}` are
  filled by our own send code, NOT by Supabase.

**Shared look:** dark bg `#0b0b14`, card `#16162a`, pink CTA gradient `#e11d48 → #ff2a75`,
Georgia serif for the logo + headings. Logo loads from `https://www.styla.ca/logo.png`
(text "STYLA" shows if the image is blocked).

**Supabase variables** (leave exactly as written): `{{ .ConfirmationURL }}`, `{{ .Token }}`,
`{{ .Email }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`.

---

# A. Supabase Auth emails

## 1. Confirm signup  ✅ (final version)

**Trigger:** new account signs up. **Where:** Authentication → Emails → *Confirm signup*.

**Subject:**
```
Confirm your email to see your Styla matches
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">You're one click from your matches</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 32px;">
      Confirm your email to save your fit profile and unlock the brands cut for your proportions — with your size in each. No tape measure, no photos.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">Confirm my email</a>
    <p style="font-size: 12px; color: #8b90a0; margin-top: 28px;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="{{ .ConfirmationURL }}" style="color: #ff5c96; word-break: break-all;">{{ .ConfirmationURL }}</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    You're getting this because someone signed up for Styla with this email. If it wasn't you, just ignore it.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

---

## 2. Reset Password

**Trigger:** user requests a password reset. **Where:** Authentication → Emails → *Reset Password*.

**Subject:**
```
Reset your Styla password
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">Reset your password</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 32px;">
      We got a request to reset the password for your Styla account. Click below to choose a new one. This link expires in 60 minutes.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">Set a new password</a>
    <p style="font-size: 12px; color: #8b90a0; margin-top: 28px;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="{{ .ConfirmationURL }}" style="color: #ff5c96; word-break: break-all;">{{ .ConfirmationURL }}</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Didn't ask for this? You can safely ignore this email — your password won't change.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

---

## 3. Magic Link  *(only if you enable passwordless login)*

**Trigger:** user requests a login link instead of a password. **Where:** Authentication → Emails → *Magic Link*.

**Subject:**
```
Your Styla login link
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">Log in to Styla</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 32px;">
      Click below to log in. No password needed. This link expires in 60 minutes and only works once.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">Log in to Styla</a>
    <p style="font-size: 12px; color: #8b90a0; margin-top: 28px;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="{{ .ConfirmationURL }}" style="color: #ff5c96; word-break: break-all;">{{ .ConfirmationURL }}</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Didn't try to log in? You can ignore this email.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

---

## 4. Change Email Address

**Trigger:** user changes their account email (Supabase sends this to confirm the new address).
**Where:** Authentication → Emails → *Change Email Address*.

**Subject:**
```
Confirm your new Styla email
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">Confirm your new email</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 32px;">
      You asked to change your Styla email from <strong style="color:#ffffff;">{{ .Email }}</strong> to <strong style="color:#ffffff;">{{ .NewEmail }}</strong>. Confirm below to make the switch.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">Confirm new email</a>
    <p style="font-size: 12px; color: #8b90a0; margin-top: 28px;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="{{ .ConfirmationURL }}" style="color: #ff5c96; word-break: break-all;">{{ .ConfirmationURL }}</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Didn't request this change? Ignore this email and your address stays the same.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

---

## 5. Reauthentication (one-time code)  *(only if you use OTP for sensitive actions)*

**Trigger:** user must re-verify (e.g. before a sensitive change). Sends a 6-digit code.
**Where:** Authentication → Emails → *Reauthentication*.

**Subject:**
```
Your Styla verification code
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">Your verification code</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px;">
      Enter this code to confirm it's you. It expires in 10 minutes.
    </p>
    <div style="font-size: 34px; font-weight: 700; letter-spacing: 10px; color: #ffffff; background: rgba(255,42,117,0.12); border: 1px solid rgba(255,42,117,0.35); border-radius: 10px; padding: 18px 0;">{{ .Token }}</div>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Didn't request this? You can ignore this email.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

---

# B. Product emails  *(need Resend/Postmark wired up first)*

These fire from **app events**, not auth. Placeholders (`{{first_name}}`, `{{amount}}`,
`{{dashboard_url}}`, etc.) are filled by our own send code. Send from something like
`hello@styla.ca` with a matching reply-to.

## 6. Welcome  *(after email is confirmed)*

**Trigger:** account confirmed / first login.

**Subject:**
```
You're in, {{first_name}} — here are your brand matches
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">Welcome to Styla, {{first_name}}</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">
      Your fit profile is saved. Here's what you can do now:
    </p>
    <p style="font-size: 15px; line-height: 1.7; color: #cbd5e1; text-align: left; margin: 0 auto 28px; max-width: 420px;">
      &#10003;&nbsp; See the brands cut for your body, ranked by fit<br/>
      &#10003;&nbsp; Get your recommended size in each one<br/>
      &#10003;&nbsp; Add the free bookmarklet to check your size on any site<br/>
      &#10003;&nbsp; Edit your profile any time — matches update instantly
    </p>
    <a href="{{dashboard_url}}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">Open my dashboard</a>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Questions? Just reply to this email.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

## 7. Match unlock receipt  *($9.99)*

**Trigger:** successful Stripe `checkout.session.completed` for `match_unlock_payment`.

**Subject:**
```
Your full brand-match list is unlocked
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">You're all unlocked 🎉</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 28px;">
      Thanks, {{first_name}}. Your full list of matching brands — with your size in each — is now open on your dashboard.
    </p>
    <a href="{{dashboard_url}}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">See all my matches</a>
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); text-align: left; font-size: 13px; color: #8b90a0;">
      <strong style="color:#cbd5e1;">Receipt</strong><br/>
      Full brand-match unlock — {{amount}}<br/>
      {{purchase_date}} · Order {{order_id}}
    </div>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Need help? Reply to this email and we'll sort it out.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

## 8. Wedding party invite  *(coordinator invites a member)*

**Trigger:** coordinator adds a member to a party and sends invites.

**Subject:**
```
{{coordinator_name}} invited you to their wedding party on Styla
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">You're invited to "{{party_name}}"</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 28px;">
      {{coordinator_name}} is using Styla to find one style that fits everyone in the party — with each person in their own correct size. Answer a few quick questions to add your fit. No measuring, no photos, and it's private to the group.
    </p>
    <a href="{{invite_url}}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">Add my fit</a>
    <p style="font-size: 12px; color: #8b90a0; margin-top: 28px;">
      Takes about 2 minutes. If the button doesn't work, paste this link:<br/>
      <a href="{{invite_url}}" style="color: #ff5c96; word-break: break-all;">{{invite_url}}</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Not expecting this? You can ignore it — nothing was shared about you.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

## 9. Wedding party — member joined  *(notify the coordinator)*

**Trigger:** an invited member finishes their fit profile.

**Subject:**
```
{{member_name}} just added their fit to {{party_name}}
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">{{member_name}} is in ✅</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 28px;">
      {{filled_count}} of {{total_count}} people in <strong style="color:#ffffff;">{{party_name}}</strong> have added their fit. Once everyone's in, you can unlock the styles that fit the whole party.
    </p>
    <a href="{{party_url}}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">View the party</a>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```

## 10. Wedding party report ready  *($29.99 unlocked)*

**Trigger:** coordinator pays the $29.99 group unlock (`bridesmaid_report_payment`).

**Subject:**
```
Your wedding-party fit report is ready
```

**Body:**
```html
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b14; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://www.styla.ca/logo.png" alt="Styla" width="40" height="40" style="border-radius: 50%; vertical-align: middle; margin-right: 10px;" />
    <span style="color: #ffffff; font-size: 30px; letter-spacing: 3px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif; vertical-align: middle;">STYLA</span>
  </div>
  <div style="background-color: #16162a; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
    <h2 style="font-size: 22px; margin-top: 0; margin-bottom: 15px; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">The whole party's matches are unlocked 🎉</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 28px;">
      Thanks, {{first_name}}. Your Brand Fit Match Report for <strong style="color:#ffffff;">{{party_name}}</strong> is ready — the styles that fit everyone, with each person's size listed.
    </p>
    <a href="{{report_url}}" style="display: inline-block; background: linear-gradient(135deg, #e11d48, #ff2a75); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 100px;">Open the report</a>
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); text-align: left; font-size: 13px; color: #8b90a0;">
      <strong style="color:#cbd5e1;">Receipt</strong><br/>
      Wedding-party fit report — {{amount}}<br/>
      {{purchase_date}} · Order {{order_id}}
    </div>
  </div>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 24px;">
    Need a hand? Reply to this email.
  </p>
  <p style="text-align: center; font-size: 12px; color: #5a5f70; margin-top: 6px;">© Styla · Your body. Your size. Everywhere.</p>
</div>
```
