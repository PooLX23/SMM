from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
from ..models import Counter

COUNTER_KEY = "SHIPMENT_OUTGOING"

def next_internal_no(db: Session) -> str:
    """
    KR-2026-000123
    """
    year = datetime.utcnow().year

    row = db.execute(
        select(Counter).where(Counter.key == COUNTER_KEY)
    ).scalar_one_or_none()

    if row is None:
        row = Counter(key=COUNTER_KEY, value=0)
        db.add(row)
        db.flush()

    row.value += 1
    db.flush()

    return f"KR-{year}-{row.value:06d}"
