import os
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
from datetime import datetime

from .models import Shipment, IncomingShipment


# ============================================================
# HELPERY
# ============================================================

def _env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    return v if v is not None and v != "" else default


def _status_label(status: str) -> str:
    return {
        "CREATED": "Utworzona",
        "AT_RECEPTION": "Na recepcji",
        "SHIPPED": "Nadana",
        "SHIPPING_CHANGED": "Zmiana nadania",
        "CANCELLED": "Anulowana",
        "CANCELLED_AFTER_SHIPPED": "Anulowana po nadaniu",
        "PICKED_UP": "Odebrana",
    }.get(status, status)


def _safe(s: str | None) -> str:
    return (s or "").strip()


def _fmt_dt(dt: datetime | None) -> str:
    if not dt:
        return "—"
    try:
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(dt)


def _enum_to_key(v) -> str:
    """
    Normalizuje enumy do stringa: AT_RECEPTION, PICKED_UP, itd.
    Obsługuje np. ShipmentStatus.AT_RECEPTION -> AT_RECEPTION.
    """
    if v is None:
        return ""
    s = str(v)
    if "." in s:
        return s.split(".")[-1]
    return s


def _build_public_link(sh: Shipment) -> str:
    base = (_env("APP_PUBLIC_URL") or _env("APP_URL") or "").rstrip("/")
    if not base:
        return ""
    return f"{base}/shipments/{sh.internal_no}"


def _build_public_link_incoming(x: IncomingShipment) -> str:
    base = (_env("APP_PUBLIC_URL") or _env("APP_URL") or "").rstrip("/")
    if not base:
        return ""
    return f"{base}/incoming/{x.internal_no}"


# ============================================================
# SMTP
# ============================================================

def send_mail(to_addr: str, subject: str, body_text: str, body_html: str | None = None):
    host = _env("SMTP_HOST")
    port = int(_env("SMTP_PORT", "587"))
    user = _env("SMTP_USER")
    password = _env("SMTP_PASS")
    from_addr = _env("SMTP_FROM", user or "no-reply@localhost")
    use_tls = _env("SMTP_TLS", "1") == "1"

    if not host:
        raise RuntimeError("SMTP_HOST not set")

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(body_text)

    if body_html:
        logo_path = _env("MAIL_LOGO_PATH")
        logo_cid = None

        if logo_path and os.path.exists(logo_path):
            logo_cid = make_msgid(domain="sixt-mailmanager")
            body_html = body_html.replace("{{LOGO_CID}}", logo_cid[1:-1])

        msg.add_alternative(body_html, subtype="html")

        if logo_cid and logo_path:
            payload = msg.get_payload()
            html_part = payload[-1] if isinstance(payload, list) and len(payload) > 0 else None
            if html_part is not None:
                with open(logo_path, "rb") as f:
                    img = f.read()
                html_part.add_related(
                    img,
                    maintype="image",
                    subtype="png",
                    cid=logo_cid,
                    filename="sixt.png",
                    disposition="inline",
                )

    with smtplib.SMTP(host, port, timeout=20) as s:
        if use_tls:
            s.starttls()
        if user and password:
            s.login(user, password)
        s.send_message(msg)


# ============================================================
# OUTLOOK-SAFE HTML (ZERO VML)
# ============================================================

_BORDER = "#2A2F3A"
_HEADER_BORDER = "#E6E6E6"


def _button_table(link: str, label: str) -> str:
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
  <tr>
    <td bgcolor="#FFCC00" style="background:#FFCC00;padding:12px 18px;border-radius:12px;">
      <a href="{link}" style="color:#000000;text-decoration:none;font-weight:900;
                             font-family:Arial, Helvetica, sans-serif;font-size:16px;display:inline-block;">
        {label}
      </a>
    </td>
  </tr>
</table>
"""


def _wrap_mail(status_pl: str, title: str, subtitle: str, inner_html: str, link: str | None) -> str:
    button_html = ""
    if link:
        button_html = f"""
          <tr>
            <td style="padding-top:18px;">
              {_button_table(link, "Otwórz w systemie")}
            </td>
          </tr>
        """

    return f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="x-apple-disable-message-reformatting" />
    <!--[if mso]>
      <style>
        body, table, td, a {{ font-family: Arial, Helvetica, sans-serif !important; }}
        table {{ border-collapse: collapse !important; }}
      </style>
    <![endif]-->
  </head>

  <body style="margin:0;padding:0;background:#0b0b0b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0b0b" style="background:#0b0b0b;">
      <tr>
        <td align="center" style="padding:28px 16px;">

          <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;">
            <tr>
              <td style="border:1px solid {_BORDER}; background:#111827;" bgcolor="#111827">

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="#ffffff" style="background:#ffffff;padding:14px 18px;border-bottom:1px solid {_HEADER_BORDER};">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="left" style="vertical-align:middle;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="padding:6px 8px;">
                                  <img src="cid:{{{{LOGO_CID}}}}" alt="SIXT" height="28"
                                       style="height:28px;display:block;border:0;outline:none;text-decoration:none;" />
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td align="right" style="vertical-align:middle;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td bgcolor="#FFCC00" style="background:#FFCC00;color:#000000;padding:7px 12px;
                                                           font-weight:900;font-size:12px;">
                                  {status_pl}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px;color:#ffffff;">
                      <div style="font-family:Arial, Helvetica, sans-serif;font-size:14px;opacity:0.85;line-height:20px;mso-line-height-rule:exactly;">
                        {subtitle}
                      </div>
                      <div style="font-family:Arial, Helvetica, sans-serif;font-size:22px;font-weight:900;margin-top:4px;line-height:28px;mso-line-height-rule:exactly;">
                        {title}
                      </div>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                             style="margin-top:16px;color:#ffffff;font-family:Arial, Helvetica, sans-serif;">
                        {inner_html}
                        {button_html}
                      </table>

                      <div style="margin-top:18px;opacity:0.65;font-size:12px;font-family:Arial, Helvetica, sans-serif;">
                        Wiadomość wygenerowana automatycznie.
                      </div>
                    </td>
                  </tr>

                </table>

              </td>
            </tr>
          </table>

          <div style="max-width:640px;color:#ffffff;opacity:0.55;font-family:Arial, Helvetica, sans-serif;
                      font-size:11px;margin-top:10px;">
            Jeśli nie widzisz obrazów, kliknij „Pobierz obrazy” w kliencie poczty.
          </div>

        </td>
      </tr>
    </table>
  </body>
</html>
"""


# ============================================================
# OUTGOING (OUT w temacie, Outgoing w subtitle, SIXT MailManager)
# ============================================================

def notify_status_change(sh: Shipment, new_status: str):
    to_addr = sh.requested_by_upn

    status_key = _enum_to_key(new_status)
    status_pl = _status_label(status_key)

    link = _build_public_link(sh)

    # OUT w temacie
    subject = f"[SIXT MailManager] OUT • {sh.internal_no} • {status_pl}"

    cc_code = _safe(getattr(sh, "cost_center_code", None))
    cc_name = _safe(getattr(sh, "cost_center_name", None))

    vin = _safe(getattr(sh, "vin", None))
    rej = _safe(getattr(sh, "plate_no", None))

    # TEXT
    lines = [
        f"Przesyłka: {sh.internal_no}",
        f"Status: {status_pl}",
        "",
        f"Zlecający: {_safe(getattr(sh, 'requested_by_name', None))} ({_safe(getattr(sh, 'requested_by_upn', None))})",
        f"Adresat: {_safe(sh.recipient_name)} ({_safe(sh.recipient_email)}, {_safe(sh.recipient_phone)})",
        f"Adres: {_safe(sh.recipient_street)}, {_safe(sh.recipient_postal_code)} {_safe(sh.recipient_city)}, {_safe(sh.recipient_country)}",
    ]

    if cc_code or cc_name:
        lines.append(f"Centrum kosztowe: {cc_code} — {cc_name}".strip(" —"))
    else:
        lines.append(f"Centrum kosztowe ID: {getattr(sh, 'cost_center_id', '')}")

    if vin or rej:
        parts = []
        if vin:
            parts.append(f"VIN: {vin}")
        if rej:
            parts.append(f"REJ: {rej}")
        lines.append(" • ".join(parts))

    carrier_name = ""
    if getattr(sh, "carrier_tracking_no", None):
        try:
            carrier = getattr(sh, "carrier", None)
            carrier_name = getattr(carrier, "name", "") if carrier else ""
        except Exception:
            carrier_name = ""
        lines.append(f"Kurier: {carrier_name} / nr: {sh.carrier_tracking_no}".strip())

    lines.append("")
    lines.append("Zawartość:")
    lines.append(_safe(getattr(sh, "contents", None)))

    lines.append("")
    lines.append("Czasy:")
    lines.append(f"  Utworzono: {_fmt_dt(getattr(sh, 'created_at', None))}")
    lines.append(f"  Przyjęto:  {_fmt_dt(getattr(sh, 'received_at', None))}")
    lines.append(f"  Nadano:    {_fmt_dt(getattr(sh, 'shipped_at', None))}")

    if link:
        lines.append("")
        lines.append(f"Otwórz w systemie: {link}")

    lines.append("")
    lines.append("Wiadomość wygenerowana automatycznie.")
    body_text = "\n".join(lines)

    carrier_line_html = ""
    if getattr(sh, "carrier_tracking_no", None):
        carrier_line_html = f"""
          <tr>
            <td style="padding:10px 0;border-top:1px solid {_BORDER};">
              <div style="opacity:0.85;font-size:12px;">Kurier</div>
              <div style="font-weight:800;">{carrier_name} • {sh.carrier_tracking_no}</div>
            </td>
          </tr>
        """

    cc_line_html = ""
    if cc_code or cc_name:
        cc_line_html = f"""
          <tr>
            <td style="padding:10px 0;border-top:1px solid {_BORDER};">
              <div style="opacity:0.85;font-size:12px;">Centrum kosztowe</div>
              <div style="font-weight:800;">{cc_code} — {cc_name}</div>
            </td>
          </tr>
        """

    vin_rej_line_html = ""
    if vin or rej:
        parts = []
        if vin:
            parts.append(f"VIN: {vin}")
        if rej:
            parts.append(f"REJ: {rej}")
        vin_rej_line_html = f"""
          <tr>
            <td style="padding:10px 0;border-top:1px solid {_BORDER};">
              <div style="opacity:0.85;font-size:12px;">Dane pojazdu (opcjonalnie)</div>
              <div style="font-weight:800;">{" • ".join(parts)}</div>
            </td>
          </tr>
        """

    times_line_html = f"""
      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Czasy</div>
          <div style="font-weight:700;line-height:1.6;mso-line-height-rule:exactly;">
            Utworzono: {_fmt_dt(getattr(sh, 'created_at', None))}<br/>
            Przyjęto: {_fmt_dt(getattr(sh, 'received_at', None))}<br/>
            Nadano: {_fmt_dt(getattr(sh, 'shipped_at', None))}
          </div>
        </td>
      </tr>
    """

    inner_html = f"""
      <tr>
        <td style="padding:10px 0;">
          <div style="opacity:0.85;font-size:12px;">Zlecający</div>
          <div style="font-weight:800;">
            {_safe(getattr(sh, 'requested_by_name', None))} • {_safe(getattr(sh, 'requested_by_upn', None))}
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Adresat</div>
          <div style="font-weight:800;">{_safe(sh.recipient_name)}</div>
          <div style="opacity:0.9;">{_safe(sh.recipient_email)} • {_safe(sh.recipient_phone)}</div>
        </td>
      </tr>

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Adres</div>
          <div style="font-weight:700;">
            {_safe(sh.recipient_street)}, {_safe(sh.recipient_postal_code)} {_safe(sh.recipient_city)}, {_safe(sh.recipient_country)}
          </div>
        </td>
      </tr>

      {cc_line_html}
      {vin_rej_line_html}
      {carrier_line_html}

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Zawartość</div>
          <div style="font-weight:700;white-space:pre-wrap;">{_safe(sh.contents)}</div>
        </td>
      </tr>

      {times_line_html}
    """

    body_html = _wrap_mail(
        status_pl=status_pl,
        title=sh.internal_no,
        subtitle="SIXT MailManager • Outgoing",
        inner_html=inner_html,
        link=link,
    )

    send_mail(to_addr, subject, body_text, body_html)


# ============================================================
# INCOMING (IN w temacie, Incoming w subtitle, brak przycisku/linku)
# ============================================================

def _incoming_carrier_line(x: IncomingShipment) -> tuple[str, str]:
    carrier_name = ""
    try:
        carrier = getattr(x, "carrier", None)
        carrier_name = getattr(carrier, "name", "") if carrier else ""
    except Exception:
        carrier_name = ""

    tracking = _safe(getattr(x, "carrier_tracking_no", None))
    text_line = ""
    html_block = ""

    if tracking:
        text_line = f"Kurier: {carrier_name} / nr: {tracking}".strip()
        html_block = f"""
          <tr>
            <td style="padding:10px 0;border-top:1px solid {_BORDER};">
              <div style="opacity:0.85;font-size:12px;">Kurier</div>
              <div style="font-weight:800;">{carrier_name} • {tracking}</div>
            </td>
          </tr>
        """

    return text_line, html_block


def notify_incoming_registered(x: IncomingShipment):
    to_addr = x.recipient_upn

    status_key = _enum_to_key(getattr(x, "status", "AT_RECEPTION"))
    status_pl = _status_label(status_key)

    subject = f"[SIXT MailManager] IN • {x.internal_no} • {status_pl}"

    carrier_text, carrier_html = _incoming_carrier_line(x)

    # TEXT (bez linka / przycisku)
    lines = [
        f"Paczka przychodząca: {x.internal_no}",
        f"Status: {status_pl}",
        "",
        f"Odbiorca: {_safe(getattr(x, 'recipient_name', None))} ({_safe(getattr(x, 'recipient_upn', None))})",
        f"Nadawca: {_safe(getattr(x, 'sender_name', None))}",
    ]
    if carrier_text:
        lines.append(carrier_text)

    lines.append("")
    lines.append("Zawartość:")
    lines.append(_safe(getattr(x, "contents", None)))

    lines.append("")
    lines.append("Czasy:")
    lines.append(f"  Utworzono: {_fmt_dt(getattr(x, 'created_at', None))}")
    lines.append(f"  Przyjęto:  {_fmt_dt(getattr(x, 'received_at', None))}")
    lines.append(f"  Odebrano:  {_fmt_dt(getattr(x, 'picked_up_at', None))}")

    lines.append("")
    lines.append("Wiadomość wygenerowana automatycznie.")
    body_text = "\n".join(lines)

    times_line_html = f"""
      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Czasy</div>
          <div style="font-weight:700;line-height:1.6;mso-line-height-rule:exactly;">
            Utworzono: {_fmt_dt(getattr(x, 'created_at', None))}<br/>
            Przyjęto: {_fmt_dt(getattr(x, 'received_at', None))}<br/>
            Odebrano: {_fmt_dt(getattr(x, 'picked_up_at', None))}
          </div>
        </td>
      </tr>
    """

    inner_html = f"""
      <tr>
        <td style="padding:10px 0;">
          <div style="opacity:0.85;font-size:12px;">Odbiorca</div>
          <div style="font-weight:800;">
            {_safe(getattr(x, 'recipient_name', None))} • {_safe(getattr(x, 'recipient_upn', None))}
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Nadawca</div>
          <div style="font-weight:800;">{_safe(getattr(x, 'sender_name', None))}</div>
        </td>
      </tr>

      {carrier_html}

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Zawartość</div>
          <div style="font-weight:700;white-space:pre-wrap;">{_safe(getattr(x, 'contents', None))}</div>
        </td>
      </tr>

      {times_line_html}
    """

    # brak linka/przycisku dla incoming:
    body_html = _wrap_mail(
        status_pl=status_pl,
        title=x.internal_no,
        subtitle="SIXT MailManager • Incoming",
        inner_html=inner_html,
        link=None,
    )

    send_mail(to_addr, subject, body_text, body_html)


def notify_incoming_picked_up(x: IncomingShipment):
    to_addr = x.recipient_upn

    status_pl = _status_label("PICKED_UP")
    subject = f"[SIXT MailManager] IN • {x.internal_no} • {status_pl}"

    carrier_text, carrier_html = _incoming_carrier_line(x)

    # TEXT (bez linka / przycisku)
    lines = [
        f"Paczka przychodząca: {x.internal_no}",
        f"Status: {status_pl}",
        "",
        f"Odbiorca: {_safe(getattr(x, 'recipient_name', None))} ({_safe(getattr(x, 'recipient_upn', None))})",
        f"Nadawca: {_safe(getattr(x, 'sender_name', None))}",
    ]
    if carrier_text:
        lines.append(carrier_text)

    lines.append("")
    lines.append("Zawartość:")
    lines.append(_safe(getattr(x, "contents", None)))

    lines.append("")
    lines.append("Czasy:")
    lines.append(f"  Utworzono: {_fmt_dt(getattr(x, 'created_at', None))}")
    lines.append(f"  Przyjęto:  {_fmt_dt(getattr(x, 'received_at', None))}")
    lines.append(f"  Odebrano:  {_fmt_dt(getattr(x, 'picked_up_at', None))}")

    lines.append("")
    lines.append("Wiadomość wygenerowana automatycznie.")
    body_text = "\n".join(lines)

    times_line_html = f"""
      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Czasy</div>
          <div style="font-weight:700;line-height:1.6;mso-line-height-rule:exactly;">
            Utworzono: {_fmt_dt(getattr(x, 'created_at', None))}<br/>
            Przyjęto: {_fmt_dt(getattr(x, 'received_at', None))}<br/>
            Odebrano: {_fmt_dt(getattr(x, 'picked_up_at', None))}
          </div>
        </td>
      </tr>
    """

    inner_html = f"""
      <tr>
        <td style="padding:10px 0;">
          <div style="opacity:0.85;font-size:12px;">Odbiorca</div>
          <div style="font-weight:800;">
            {_safe(getattr(x, 'recipient_name', None))} • {_safe(getattr(x, 'recipient_upn', None))}
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Nadawca</div>
          <div style="font-weight:800;">{_safe(getattr(x, 'sender_name', None))}</div>
        </td>
      </tr>

      {carrier_html}

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Zawartość</div>
          <div style="font-weight:700;white-space:pre-wrap;">{_safe(getattr(x, 'contents', None))}</div>
        </td>
      </tr>

      {times_line_html}
    """

    body_html = _wrap_mail(
        status_pl=status_pl,
        title=x.internal_no,
        subtitle="SIXT MailManager • Incoming",
        inner_html=inner_html,
        link=None,  # brak linka/przycisku
    )

    send_mail(to_addr, subject, body_text, body_html)


def notify_incoming_recipient_changed(
    x: IncomingShipment,
    *,
    old_recipient_upn: str | None,
    old_recipient_name: str | None,
    new_recipient_upn: str,
    new_recipient_name: str,
    changed_by_upn: str | None = None,
):
    """
    Powiadomienie do NOWEGO odbiorcy, że przypisano mu paczkę przychodzącą
    (zmiana odbiorcy wykonana przez recepcję).
    """
    to_addr = new_recipient_upn

    status_key = _enum_to_key(getattr(x, "status", "AT_RECEPTION"))
    status_pl = _status_label(status_key)

    subject = f"[SIXT MailManager] IN • {x.internal_no} • {status_pl}"

    carrier_text, carrier_html = _incoming_carrier_line(x)

    old_label = " • ".join([p for p in [_safe(old_recipient_name), _safe(old_recipient_upn)] if p])
    new_label = " • ".join([p for p in [_safe(new_recipient_name), _safe(new_recipient_upn)] if p])

    # TEXT (bez linka/przycisku)
    lines = [
        f"Paczka przychodząca: {x.internal_no}",
        f"Status: {status_pl}",
        "",
        "Recepcja zmieniła odbiorcę przesyłki i została ona przypisana do Ciebie.",
        "",
        f"Nowy odbiorca: {new_label}",
    ]
    if old_label:
        lines.append(f"Poprzedni odbiorca: {old_label}")
    if changed_by_upn:
        lines.append(f"Zmiana wykonana przez: {_safe(changed_by_upn)}")

    lines.extend([
        "",
        f"Nadawca: {_safe(getattr(x, 'sender_name', None))}",
    ])

    if carrier_text:
        lines.append(carrier_text)

    lines.append("")
    lines.append("Zawartość:")
    lines.append(_safe(getattr(x, "contents", None)))

    lines.append("")
    lines.append("Czasy:")
    lines.append(f"  Utworzono: {_fmt_dt(getattr(x, 'created_at', None))}")
    lines.append(f"  Przyjęto:  {_fmt_dt(getattr(x, 'received_at', None))}")
    lines.append(f"  Odebrano:  {_fmt_dt(getattr(x, 'picked_up_at', None))}")

    lines.append("")
    lines.append("Wiadomość wygenerowana automatycznie.")
    body_text = "\n".join(lines)

    times_line_html = f"""
      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Czasy</div>
          <div style="font-weight:700;line-height:1.6;mso-line-height-rule:exactly;">
            Utworzono: {_fmt_dt(getattr(x, 'created_at', None))}<br/>
            Przyjęto: {_fmt_dt(getattr(x, 'received_at', None))}<br/>
            Odebrano: {_fmt_dt(getattr(x, 'picked_up_at', None))}
          </div>
        </td>
      </tr>
    """

    change_block_html = f"""
      <tr>
        <td style="padding:10px 0;">
          <div style="opacity:0.85;font-size:12px;">Zmiana odbiorcy</div>
          <div style="font-weight:800;">Nowy odbiorca: {_safe(new_recipient_name)} • {_safe(new_recipient_upn)}</div>
          {"<div style='opacity:0.85;margin-top:4px;'>Poprzedni odbiorca: " + _safe(old_recipient_name) + " • " + _safe(old_recipient_upn) + "</div>" if old_label else ""}
          {"<div style='opacity:0.75;margin-top:6px;font-size:12px;'>Zmiana wykonana przez: " + _safe(changed_by_upn) + "</div>" if _safe(changed_by_upn) else ""}
        </td>
      </tr>
    """

    inner_html = f"""
      {change_block_html}

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Nadawca</div>
          <div style="font-weight:800;">{_safe(getattr(x, 'sender_name', None))}</div>
        </td>
      </tr>

      {carrier_html}

      <tr>
        <td style="padding:10px 0;border-top:1px solid {_BORDER};">
          <div style="opacity:0.85;font-size:12px;">Zawartość</div>
          <div style="font-weight:700;white-space:pre-wrap;">{_safe(getattr(x, 'contents', None))}</div>
        </td>
      </tr>

      {times_line_html}
    """

    body_html = _wrap_mail(
        status_pl=status_pl,
        title=x.internal_no,
        subtitle="SIXT MailManager • Incoming",
        inner_html=inner_html,
        link=None,  # bez linka/przycisku (tak jak reszta incoming)
    )

    send_mail(to_addr, subject, body_text, body_html)