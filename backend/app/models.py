import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Text, DateTime, Enum, ForeignKey, Boolean, Integer, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class Direction(str, enum.Enum):
    OUTGOING = "OUTGOING"
    INCOMING = "INCOMING"


class ShipmentStatus(str, enum.Enum):
    CREATED = "CREATED"
    AT_RECEPTION = "AT_RECEPTION"
    SHIPPED = "SHIPPED"
    SHIPPING_CHANGED = "SHIPPING_CHANGED"
    CANCELLED = "CANCELLED"
    CANCELLED_AFTER_SHIPPED = "CANCELLED_AFTER_SHIPPED"

    # INCOMING only (po odebraniu paczki przez pracownika)
    PICKED_UP = "PICKED_UP"


class CostCenter(Base):
    __tablename__ = "cost_centers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Carrier(Base):
    __tablename__ = "carriers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Counter(Base):
    __tablename__ = "counters"
    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0)


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    internal_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    direction: Mapped[Direction] = mapped_column(Enum(Direction), default=Direction.OUTGOING)
    status: Mapped[ShipmentStatus] = mapped_column(Enum(ShipmentStatus), default=ShipmentStatus.CREATED)

    recipient_name: Mapped[str] = mapped_column(String(200))
    recipient_email: Mapped[str] = mapped_column(String(254))
    recipient_phone: Mapped[str] = mapped_column(String(50))
    recipient_postal_code: Mapped[str] = mapped_column(String(32))
    recipient_city: Mapped[str] = mapped_column(String(120))
    recipient_country: Mapped[str] = mapped_column(String(2), default="PL")
    recipient_street: Mapped[str] = mapped_column(String(200))

    contents: Mapped[str] = mapped_column(Text)
    vin: Mapped[str | None] = mapped_column(String(32), nullable=True)
    plate_no: Mapped[str | None] = mapped_column(String(32), nullable=True)

    requested_by_upn: Mapped[str] = mapped_column(String(254), index=True)
    requested_by_name: Mapped[str] = mapped_column(String(200))

    cost_center_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id"))
    cost_center = relationship("CostCenter")

    carrier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("carriers.id"), nullable=True)
    carrier = relationship("Carrier")
    carrier_tracking_no: Mapped[str | None] = mapped_column(String(120), nullable=True)

    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("ix_shipments_status_created_at", "status", "created_at"),
    )


class IncomingShipment(Base):
    """
    Paczki PRZYCHODZĄCE (rejestrowane przez recepcję).

    Flow:
      - rejestracja: status = AT_RECEPTION, received_at = now
      - odebranie przez pracownika: status = PICKED_UP, picked_up_at = now
    """
    __tablename__ = "incoming_shipments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    internal_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    direction: Mapped[Direction] = mapped_column(Enum(Direction), default=Direction.INCOMING)
    status: Mapped[ShipmentStatus] = mapped_column(Enum(ShipmentStatus), default=ShipmentStatus.AT_RECEPTION)

    # dane paczki
    sender_name: Mapped[str] = mapped_column(String(200))
    contents: Mapped[str | None] = mapped_column(Text, nullable=True)

    # kurier + tracking
    carrier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("carriers.id"))
    carrier = relationship("Carrier")
    carrier_tracking_no: Mapped[str] = mapped_column(String(120), index=True)

    # do kogo przyszło
    recipient_upn: Mapped[str] = mapped_column(String(254), index=True)
    recipient_name: Mapped[str] = mapped_column(String(200))

    # czasy
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("ix_incoming_status_created_at", "status", "created_at"),
        Index("ix_incoming_recipient_status", "recipient_upn", "status"),
    )


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shipments.id"), index=True)

    event_type: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by_upn: Mapped[str] = mapped_column(String(254))
