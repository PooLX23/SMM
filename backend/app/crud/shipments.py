from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Shipment, ShipmentEvent, ShipmentStatus, Direction
from ..services.counter import next_internal_no

def create_shipment(
    db: Session,
    *,
    recipient_name: str,
    recipient_email: str,
    recipient_phone: str,
    recipient_postal_code: str,
    recipient_city: str,
    recipient_street: str,
    contents: str,
    cost_center_id,
    requested_by_upn: str,
    requested_by_name: str,
    vin: str | None = None,
    plate_no: str | None = None,
) -> Shipment:

    internal_no = next_internal_no(db)

    shipment = Shipment(
        internal_no=internal_no,
        direction=Direction.OUTGOING,
        status=ShipmentStatus.CREATED,

        recipient_name=recipient_name,
        recipient_email=recipient_email,
        recipient_phone=recipient_phone,
        recipient_postal_code=recipient_postal_code,
        recipient_city=recipient_city,
        recipient_street=recipient_street,

        contents=contents,
        vin=vin,
        plate_no=plate_no,

        requested_by_upn=requested_by_upn,
        requested_by_name=requested_by_name,

        cost_center_id=cost_center_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(shipment)
    db.flush()

    db.add(
        ShipmentEvent(
            shipment_id=shipment.id,
            event_type="CREATED",
            payload_json="{}",
            created_by_upn=requested_by_upn,
        )
    )

    return shipment

def get_by_internal_no(db: Session, internal_no: str) -> Shipment | None:
    return db.query(Shipment).filter(Shipment.internal_no == internal_no).one_or_none()


def ship_shipment(
    db: Session,
    *,
    shipment: Shipment,
    carrier_id,
    tracking_no: str,
    actor_upn: str,
):
    shipment.carrier_id = carrier_id
    shipment.carrier_tracking_no = tracking_no
    shipment.status = ShipmentStatus.SHIPPED
    shipment.shipped_at = datetime.utcnow()
    shipment.updated_at = datetime.utcnow()

    db.add(
        ShipmentEvent(
            shipment_id=shipment.id,
            event_type="SHIPPED",
            payload_json=f'{{"tracking":"{tracking_no}"}}',
            created_by_upn=actor_upn,
        )
    )

    db.flush()
