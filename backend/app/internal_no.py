from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session


def next_outgoing_internal_no(db: Session) -> str:
    year = datetime.utcnow().year
    n = db.execute(text("SELECT nextval('shipments_outgoing_internal_seq')")).scalar_one()
    return f"WKR-{year}-{int(n):06d}"


def next_incoming_internal_no(db: Session) -> str:
    year = datetime.utcnow().year
    n = db.execute(text("SELECT nextval('shipments_incoming_internal_seq')")).scalar_one()
    return f"PKR-{year}-{int(n):06d}"