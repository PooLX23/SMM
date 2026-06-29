from __future__ import annotations

import os
from datetime import date, datetime
from typing import Dict, Tuple

import pyodbc
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import CostCenter


def _mssql_conn() -> pyodbc.Connection:
    """
    Wymagane ENV:
      MSSQL_HOST=192.168.10.11
      MSSQL_DB=EURORENT
      MSSQL_USER=
      MSSQL_PASSWORD=

    Opcjonalne:
      MSSQL_DRIVER=ODBC Driver 18 for SQL Server
      MSSQL_ENCRYPT=no
      MSSQL_TRUST_CERT=yes
    """
    host = os.getenv("MSSQL_HOST", "192.168.10.11")
    db = os.getenv("MSSQL_DB", "EURORENT")
    user = os.getenv("MSSQL_USER", "")
    pwd = os.getenv("MSSQL_PASSWORD", "")

    driver = os.getenv("MSSQL_DRIVER", "ODBC Driver 18 for SQL Server")
    encrypt = os.getenv("MSSQL_ENCRYPT", "no")
    trust = os.getenv("MSSQL_TRUST_CERT", "yes")

    if not user or not pwd:
        raise RuntimeError("Brak MSSQL_USER/MSSQL_PASSWORD w env.")

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={host};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={pwd};"
        f"Encrypt={encrypt};"
        f"TrustServerCertificate={trust};"
        "Connection Timeout=15;"
    )
    return pyodbc.connect(conn_str)


def fetch_active_cost_centers_from_mssql(today: date) -> Dict[str, str]:
    """
    Zwraca dict: code -> name
    Filtr: ObowiazujeDoDnia >= dzisiaj (zgodnie z Twoim wymaganiem).
    """
    sql = """
    SELECT
        CAST(ID AS varchar(50)) AS code,
        CAST(NAZWA AS varchar(100)) AS name
    FROM dbo.StrukturaFirmy
    WHERE ObowiazujeDoDnia >= ?
    """

    out: Dict[str, str] = {}
    with _mssql_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, today)
        for code, name in cur.fetchall():
            code = (code or "").strip()
            name = (name or "").strip()
            if not code:
                continue
            out[code] = name or code
    return out


def sync_cost_centers() -> Tuple[int, int, int]:
    """
    Upsert do lokalnej tabeli cost_centers:
      - rekordy z MSSQL: active=True, aktualizuje name
      - rekordy których nie ma w MSSQL: active=False (dezaktywacja)
    Zwraca (inserted, updated, deactivated).
    """
    today = date.today()
    remote = fetch_active_cost_centers_from_mssql(today)
    remote_codes = set(remote.keys())

    inserted = 0
    updated = 0
    deactivated = 0

    db: Session = SessionLocal()
    try:
        existing = db.execute(select(CostCenter)).scalars().all()
        by_code = {str(c.code): c for c in existing}

        # insert/update
        for code, name in remote.items():
            cc = by_code.get(code)
            if cc:
                changed = False
                if (cc.name or "") != name:
                    cc.name = name
                    changed = True
                if getattr(cc, "active", True) is not True:
                    cc.active = True
                    changed = True
                if changed:
                    updated += 1
            else:
                db.add(CostCenter(code=code, name=name, active=True))
                inserted += 1

        # deactivate missing
        for cc in existing:
            code = str(cc.code)
            if code not in remote_codes and getattr(cc, "active", True) is True:
                cc.active = False
                deactivated += 1

        db.commit()
        return inserted, updated, deactivated

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    started = datetime.utcnow()
    ins, upd, deact = sync_cost_centers()
    ended = datetime.utcnow()
    print(
        f"[sync_cost_centers] inserted={ins} updated={upd} deactivated={deact} "
        f"duration={(ended - started).total_seconds():.2f}s"
    )


if __name__ == "__main__":
    main()