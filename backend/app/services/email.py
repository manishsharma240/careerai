"""
CareerAI email service.
Supports SMTP (aiosmtplib) and Resend. Credentials come from env vars only.
OTP is passed in plaintext to this function — it is NEVER stored in logs.
"""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _otp_html(name: str, otp: str) -> str:
    display_name = name or "there"
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#F5F6F8;font-family:Inter,Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding:40px 16px">
          <table width="520" cellpadding="0" cellspacing="0"
                 style="background:#fff;border-radius:12px;border:1px solid #E4E6EB;max-width:520px;width:100%">
            <tr>
              <td style="padding:32px 40px 0">
                <div style="display:inline-flex;align-items:center;gap:8px">
                  <div style="width:32px;height:32px;background:#4F46E5;border-radius:8px;
                              color:#fff;font-size:18px;font-weight:700;text-align:center;line-height:32px">C</div>
                  <span style="font-size:16px;font-weight:600;color:#12141C">CareerAI</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#12141C">Verify your email</h1>
                <p style="margin:12px 0 0;font-size:15px;color:#62677A;line-height:1.6">
                  Hi {display_name}, here is your one-time verification code for CareerAI.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px">
                <div style="background:#F5F6F8;border-radius:10px;text-align:center;padding:28px">
                  <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#4F46E5">{otp}</span>
                </div>
                <p style="margin:20px 0 0;font-size:13px;color:#62677A;text-align:center">
                  This code expires in <strong>10 minutes</strong> and can only be used once.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;border-top:1px solid #E4E6EB">
                <p style="margin:24px 0 0;font-size:12px;color:#9297A8">
                  If you did not create a CareerAI account, you can safely ignore this email.
                  Do not share this code with anyone.
                </p>
                <p style="margin:8px 0 0;font-size:12px;color:#9297A8">— The CareerAI Team</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


def _reset_html(name: str, reset_url: str) -> str:
    display_name = name or "there"
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <body style="margin:0;padding:0;background:#F5F6F8;font-family:Inter,Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding:40px 16px">
          <table width="520" cellpadding="0" cellspacing="0"
                 style="background:#fff;border-radius:12px;border:1px solid #E4E6EB;max-width:520px;width:100%">
            <tr><td style="padding:40px">
              <h1 style="margin:0 0 16px;font-size:22px;color:#12141C">Reset your password</h1>
              <p style="margin:0 0 24px;color:#62677A;font-size:15px">
                Hi {display_name}, click the button below to reset your CareerAI password.
                This link expires in 30 minutes.
              </p>
              <a href="{reset_url}"
                 style="display:inline-block;background:#4F46E5;color:#fff;border-radius:8px;
                        padding:12px 28px;font-size:15px;font-weight:600;text-decoration:none">
                Reset Password
              </a>
              <p style="margin:24px 0 0;font-size:12px;color:#9297A8">
                If you didn't request this, ignore this email — your password won't change.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


async def _send_via_smtp(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USERNAME,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )


async def _send_via_resend(to: str, subject: str, html: str) -> None:
    import resend  # type: ignore
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    })


async def send_email(to: str, subject: str, html: str) -> None:
    """Route to the configured email provider. Errors are logged, not re-raised."""
    try:
        if settings.EMAIL_PROVIDER == "resend":
            await _send_via_resend(to, subject, html)
        else:
            await _send_via_smtp(to, subject, html)
        logger.info("Email sent", extra={"to_domain": to.split("@")[-1], "subject": subject})
    except Exception as exc:
        # Log the error type, never the OTP or credentials
        logger.error("Email delivery failed", extra={"error_type": type(exc).__name__})
        raise


async def send_otp_email(to: str, name: str | None, otp: str) -> None:
    html = _otp_html(name or "", otp)
    await send_email(to, "Your CareerAI verification code", html)


async def send_password_reset_email(to: str, name: str | None, reset_url: str) -> None:
    html = _reset_html(name or "", reset_url)
    await send_email(to, "Reset your CareerAI password", html)
