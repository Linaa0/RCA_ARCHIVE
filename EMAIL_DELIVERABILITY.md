# RCA Archive Email Deliverability Guide

This guide explains how to configure high-deliverability transactional emails for the Rwanda Coding Academy Archive portal (rca-archive). It addresses common spam issues, explains DNS authentication records, and provides steps to achieve reliable inbox delivery.

## 1. Why Personal Gmail Accounts Land in Spam

When sending transactional emails (such as 6-digit verification codes or account setup invitations) through a personal `@gmail.com` account or raw SMTP relay:

1. **DMARC Alignment Failure**: Google's DMARC policy for `gmail.com` states `p=reject` or `p=quarantine` when emails claim to originate from `@gmail.com` but are dispatched from arbitrary servers or cloud hosting IPs.
2. **Shared IP Reputation**: Free Gmail SMTP servers are heavily rate-limited (approximately 100 to 500 emails per day) and scrutinized for automated mass dispatch.
3. **Missing Authentication on Custom Domains**: If the portal attempts to send with `From: RCA Archive <noreply@rca.ac.rw>` using a third-party relay without DNS records, receiving mail servers will immediately flag or drop the messages.

## 2. The Recommended Solution: Transactional Email Provider

The proper industry standard solution is to send from a dedicated subdomain (such as `mail.rca.ac.rw` or `rca.ac.rw`) via an established transactional email provider:

- **Resend** (Recommended for simplicity and modern developer experience)
- **Brevo** (Formerly Sendinblue, generous free tier of 300 emails per day)
- **Amazon SES** (Extremely cost-effective at scale)
- **Mailgun** or **Postmark** (Industry-leading deliverability tracking)

### Switching Providers in RCA Archive

The RCA Archive server is designed so that switching providers requires only updating `.env` variables without changing application code:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_your_api_key_here
EMAIL_FROM=RCA Archive <noreply@rca.ac.rw>
```

## 3. Required DNS Records (SPF, DKIM, DMARC)

Add the following DNS records to the domain hosting the sender address (for example `rca.ac.rw` or `mail.rca.ac.rw`):

### A. SPF (Sender Policy Framework)
SPF identifies which mail servers are authorized to send email on behalf of your domain.

- **Record Type**: TXT
- **Host / Name**: `@` (or `mail` if using a subdomain)
- **Value**:
  - For Resend: `v=spf1 include:amazonses.com ~all`
  - For Brevo: `v=spf1 include:spf.sendinblue.com ~all`
  - For Google Workspace (if authorized): `v=spf1 include:_spf.google.com ~all`
  - Example combined SPF record:
    ```
    v=spf1 include:amazonses.com include:_spf.google.com ~all
    ```

### B. DKIM (DomainKeys Identified Mail)
DKIM provides a cryptographic signature verifying that the email was not tampered with in transit.

Your transactional provider will generate two or three CNAME records. For example:
- **Record Type**: CNAME
- **Host / Name**: `resend._domainkey.rca.ac.rw`
- **Value**: `dkim.resend.com`

### C. DMARC (Domain-based Message Authentication, Reporting, and Conformance)
DMARC instructs receiving mail servers how to handle emails that fail SPF or DKIM checks, and collects delivery reports.

- **Record Type**: TXT
- **Host / Name**: `_dmarc` (or `_dmarc.rca.ac.rw`)
- **Initial Monitoring Value** (collect reports without blocking):
  ```
  v=DMARC1; p=none; rua=mailto:dmarc-reports@rca.ac.rw; pct=100; sp=none;
  ```
- **Strict Enforcement Value** (once SPF and DKIM pass consistently):
  ```
  v=DMARC1; p=reject; rua=mailto:dmarc-reports@rca.ac.rw; pct=100;
  ```

### D. MX Records (for the sending subdomain)
If sending from a subdomain like `mail.rca.ac.rw`, add MX records provided by your email service so receiving servers can send bounce notifications.

- **Record Type**: MX
- **Host / Name**: `mail`
- **Priority**: `10`
- **Value**: `feedback-smtp.us-east-1.amazonses.com` (or provider equivalent)

## 4. How to Verify Email Deliverability

### Verification Method 1: Google Mail "Show Original"
1. Send a verification email to a test Gmail address.
2. In Gmail, open the received email.
3. Click the three dots menu (More options) next to Reply, then select **Show original**.
4. Check the authentication summary table at the top. It must display:
   - **SPF**: `PASS` with your domain IP
   - **DKIM**: `PASS` with your domain signature
   - **DMARC**: `PASS`

### Verification Method 2: Mail-Tester
1. Visit https://www.mail-tester.com/
2. Copy the temporary test email address provided.
3. Trigger an email from RCA Archive to that address.
4. Click **Check your score**.
5. Aim for a score of 9/10 or 10/10. Review any warnings on headers or reverse DNS.

## 5. Security and Header Best Practices Implemented

The RCA Archive mailer implements the following safeguards:
- **Branded Layout**: Table-based responsive HTML with fallback plaintext alternative.
- **Embedded Logo via CID**: No external image trackers that trigger spam filters.
- **Auto-Submitted Header**: Sets `Auto-Submitted: auto-generated` and `X-Auto-Response-Suppress: All` to avoid vacation auto-responders.
- **Unique Message-ID**: Automatically generated with cryptographic entropy on the sender domain.
- **Expiry Warnings**: Clear plain text stating single-use time limits (15 minutes for sign-up codes, 60 minutes for password resets).
