import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Iterable

logger = logging.getLogger(__name__)


def send_email_alerts(recipients: Iterable[str], subject: str, body: str) -> bool:
    recipients = [recipient for recipient in recipients if recipient]
    if not recipients:
        return False

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

    if not smtp_host or not smtp_from:
        logger.warning("Configuração SMTP incompleta; e-mail de alertas não enviado.")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
            if smtp_use_tls:
                smtp.starttls()
            if smtp_user and smtp_password:
                smtp.login(smtp_user, smtp_password)
            smtp.send_message(message)
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail de alertas")
        return False
