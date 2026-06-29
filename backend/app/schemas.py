import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# =========================
# OUTGOING (Twoje istniejące)
# =========================

class ShipmentCreate(BaseModel):
    recipient_name: str
    recipient_email: EmailStr
    recipient_phone: str
    recipient_postal_code: str
    recipient_city: str
    recipient_country: str = Field(default="PL", min_length=2, max_length=2)
    recipient_street: str

    contents: str
    vin: str | None = None
    plate_no: str | None = None

    cost_center_id: uuid.UUID


class ShipmentShip(BaseModel):
    carrier_id: uuid.UUID
    carrier_tracking_no: str


class ShipmentOut(BaseModel):
    id: uuid.UUID
    internal_no: str
    status: str
    direction: str

    recipient_name: str
    recipient_email: str
    recipient_phone: str
    recipient_postal_code: str
    recipient_city: str
    recipient_country: str
    recipient_street: str

    contents: str
    vin: str | None
    plate_no: str | None

    requested_by_upn: str
    requested_by_name: str

    cost_center_id: uuid.UUID
    cost_center_code: str | None = None
    cost_center_name: str | None = None

    carrier_id: uuid.UUID | None
    carrier_tracking_no: str | None

    received_at: datetime | None
    shipped_at: datetime | None
    created_at: datetime
    updated_at: datetime

    cancelled_at: datetime | None = None
    cancelled_after_shipped_at: datetime | None = None
    shipping_changed_at: datetime | None = None

    class Config:
        from_attributes = True


class CostCenterOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    active: bool

    class Config:
        from_attributes = True


class SimpleDictItem(BaseModel):
    id: uuid.UUID
    name: str

    class Config:
        from_attributes = True


# =========================
# INCOMING (Nowe: paczki przychodzące)
# =========================

class IncomingShipmentCreate(BaseModel):
    """
    Rejestracja paczki przychodzącej przez recepcję.
    Wymagania z Twojego opisu:
      - tracking number (wymagane)
      - wybór kuriera (opcjonalnie, ale raczej będzie)
      - nadawca (tekst, wymagany)
      - zawartość (opcjonalnie)
      - wybór osoby, dla której paczka jest (UPN + name)
    """
    carrier_tracking_no: str = Field(min_length=3, max_length=120)

    carrier_id: uuid.UUID | None = None

    sender_name: str = Field(min_length=2, max_length=200)
    contents: str | None = None

    recipient_upn: str = Field(min_length=3, max_length=254)
    recipient_name: str = Field(min_length=2, max_length=200)


class IncomingShipmentOut(BaseModel):
    id: uuid.UUID
    internal_no: str
    direction: str
    status: str

    carrier_id: uuid.UUID | None
    carrier_tracking_no: str

    sender_name: str
    contents: str | None

    recipient_upn: str
    recipient_name: str

    received_at: datetime | None
    picked_up_at: datetime | None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IncomingShipmentPickUp(BaseModel):
    """
    Na teraz nic nie musisz przesyłać z frontu (akcja 'Odebrana'),
    ale trzymamy model dla spójności i ewentualnych komentarzy w przyszłości.
    """
    note: str | None = None
