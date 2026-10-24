# RCA Archive Email Deliverability Guide

This guide explains how to configure high-deliverability transactional emails for the Rwanda Coding Academy Archive portal. It explains why personal accounts land in spam, provides step by step instructions for setting up transactional providers (including Brevo without DNS access and full domain setups with DNS records), and explains how to verify inbox placement.

## 1. Why Personal Gmail Accounts Land in Spam

Sending transactional emails (such as 6-digit verification codes or temporary login credentials) through a personal Gmail account with an App Password works initially for small tests, but inevitably degrades over time:

1. **Volume and Velocity Scrutiny**: Google monitors personal accounts for automated patterns. When automated emails are detected, Google's filters throttle delivery or route messages to the spam folder.
2. **Missing SPF and DKIM Alignment**: When mail is sent on behalf of "RCA Archive" using personal Gmail SMTP, receiving mail servers check SPF and DKIM signatures. If the headers do not align with the declared domain, spam filters penalize the message score.
3. **Reputation Drift**: A personal email address has no dedicated transactional reputation. If even one or two recipients mark a message as spam, all future messages from that address to any Gmail user will be flagged.

The reliable, production-grade fix is to use a transactional email provider (such as Brevo, Resend, Mailgun, or Amazon SES).

## 2. Option A: Brevo with Single Sender Verification (Works Without DNS Access)

If you do not have administrative access to your school domain DNS records, you can still achieve significantly better deliverability using Brevo's verified single sender feature.

### Step 1: Create a Free Brevo Account
1. Visit https://www.brevo.com and create a free account (includes 300 free emails per day).
2. Complete the initial registration profile.

### Step 2: Verify Your Sender Email Address
1. In the Brevo dashboard, navigate to **Senders, Domains & Dedicated IPs**.
2. Click **Senders** and choose **Add a sender**.
3. Enter your sender name (for example, "RCA Archive") and your sender email address.
4. Brevo will send a confirmation email with a verification link to that address.
5. Open the email in your inbox and click the verification link.

### Step 3: Retrieve Your API Key or SMTP Credentials
1. In the top right profile menu, click **SMTP & API**.
2. Under the **SMTP** tab, note the following settings:
   - SMTP Server: `smtp-relay.brevo.com`
   - Port: `587`
   - Login: Your Brevo login email
   - SMTP Key: Generate a new master key
3. Alternatively, under the **API Keys** tab, generate a standard API key.

### Step 4: Configure RCA Archive Environment Variables
Update your server configuration (or GitHub Actions secret `SERVER_ENV_UPDATES`):

Using SMTP:
```env
MAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_brevo_account_login@example.com
SMTP_PASS=your_brevo_smtp_key_here
EMAIL_FROM="RCA Archive" <your_verified_sender@example.com>
```

Using Brevo HTTP API:
```env
MAIL_PROVIDER=brevo
BREVO_API_KEY=your_brevo_api_key_here
EMAIL_FROM="RCA Archive" <your_verified_sender@example.com>
```

## 3. Option B: Full Custom Domain Setup with DNS Records (Maximum Deliverability)

When you have access to your organization's DNS management console (e.g. Cloudflare, Namecheap, GoDaddy, or Route 53), configuring dedicated DNS records ensures the highest possible inbox placement (SPF, DKIM, and DMARC pass 100%).

### Step 1: Add Domain to Your Email Provider
In Brevo or Resend:
1. Navigate to **Domains** and click **Add a new domain** (e.g., `rca.ac.rw` or a subdomain like `mail.rca.ac.rw`).
2. The provider will generate the exact TXT and CNAME records required.

### Step 2: Add DNS Authentication Records

#### A. SPF (Sender Policy Framework)
Authorizes the provider's mail servers to send emails on behalf of your domain:
- **Record Type**: TXT
- **Host / Name**: `@` (or `mail` if using subdomain)
- **Value**:
  - For Brevo: `v=spf1 include:spf.sendinblue.com ~all`
  - For Resend: `v=spf1 include:amazonses.com ~all`

#### B. DKIM (DomainKeys Identified Mail)
Provides cryptographic verification that the email was not tampered with in transit:
- **Record Type**: CNAME or TXT (as provided in provider console)
- **Host / Name**: `mail._domainkey` (or provider specific host)
- **Value**: Target key string supplied by the provider

#### C. DMARC (Domain-based Message Authentication, Reporting, and Conformance)
Instructs receiving servers how to handle messages that fail SPF or DKIM:
- **Record Type**: TXT
- **Host / Name**: `_dmarc` (or `_dmarc.rca.ac.rw`)
- **Initial Monitoring Value**:
  ```text
  v=DMARC1; p=none; rua=mailto:dmarc-reports@rca.ac.rw; pct=100; sp=none;
  ```
- **Strict Enforcement Value** (once SPF and DKIM pass):
  ```text
  v=DMARC1; p=reject; rua=mailto:dmarc-reports@rca.ac.rw; pct=100;
  ```

### Step 3: Verify DNS Status in Provider Console
Return to your provider dashboard and click **Check DNS records**. It may take between 5 minutes and 24 hours for DNS propagation. Once verified, your domain status will change to "Authenticated".

## 4. How to Verify Email Results in Gmail

Once an email is dispatched:

1. Send a verification code or invite email to a standard `@gmail.com` address.
2. In Gmail on desktop, open the incoming message.
3. Click the three dots icon next to the Reply button, then select **Show original**.
4. Examine the header summary box at the top of the raw message view:
   - **SPF**: Must state `PASS` with the sending IP address.
   - **DKIM**: Must state `PASS` with your domain signature.
   - **DMARC**: Must state `PASS`.
5. If all three display `PASS`, your email authentication is pristine and will avoid spam classification.

## 5. Built-in RCA Archive Deliverability Features

The RCA Archive server incorporates the following inbox placement optimizations:

1. **Lightweight HTML and Plaintext Fallback**: Multi-part MIME messages with identical clean HTML and plain text parts.
2. **No Attachments**: Email logos and icons are hosted on stable public HTTPS endpoints or kept minimal, avoiding spam triggers associated with file attachments.
3. **No Phishing Indicators**: No all-caps words, no excessive exclamation marks, no URL shorteners, and no hidden tracking pixels.
4. **Resilient Outbox Queue**: All dispatched emails are tracked in the database outbox with retry handling and non-secret audit logs accessible to system administrators.
