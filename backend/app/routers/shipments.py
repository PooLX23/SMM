from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user
from ..crud.shipments import (
    create_shipment,
    get_by_internal_no,
    ship_shipment,
)
from ..models import Shipment

router = APIRouter(prefix="/api")

@router.post("/shipments")
def create_shipment_api(
    payload: dict,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    shipment = create_shipment(
        db,
        recipient_name=payload["recipient_name"],
        recipient_email=payload["recipient_email"],
        recipient_phone=payload["recipient_phone"],
        recipient_postal_code=payload["recipient_postal_code"],
        recipient_city=payload["recipient_city"],
        recipient_street=payload["recipient_street"],
        contents=payload["contents"],
        cost_center_id=payload["cost_center_id"],
        vin=payload.get("vin"),
        plate_no=payload.get("plate_no"),
        requested_by_upn=user.upn,
        requested_by_name=user.name,
    )
    db.commit()
    return {"internal_no": shipment.internal_no}


@router.get("/reception/shipments/{internal_no}")
def reception_get(
    internal_no: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    shipment = get_by_internal_no(db, internal_no)
    if not shipment:
        raise HTTPException(status_code=404, detail="Nie znaleziono przesyłki")
    return shipment


@router.post("/reception/shipments/{shipment_id}/ship")
def reception_ship(
    shipment_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Nie znaleziono przesyłki")

    ship_shipment(
        db,
        shipment=shipment,
        carrier_id=payload["carrier_id"],
        tracking_no=payload["tracking"],
        actor_upn=user.upn,
    )
    db.commit()
    return {"status": "OK"}
