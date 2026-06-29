from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "carriers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_carriers_name", "carriers", ["name"], unique=True)

    op.create_table(
        "cost_centers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_cost_centers_code", "cost_centers", ["code"], unique=True)

    op.create_table(
        "counters",
        sa.Column("key", sa.String(length=32), primary_key=True),
        sa.Column("value", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "shipments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("internal_no", sa.String(length=32), nullable=False),
        sa.Column("direction", sa.Enum("OUTGOING", "INCOMING", name="direction"), nullable=False),
        sa.Column("status", sa.Enum("CREATED", "AT_RECEPTION", "SHIPPED", "CANCELLED", name="shipmentstatus"), nullable=False),

        sa.Column("recipient_name", sa.String(length=200), nullable=False),
        sa.Column("recipient_email", sa.String(length=254), nullable=False),
        sa.Column("recipient_phone", sa.String(length=50), nullable=False),
        sa.Column("recipient_postal_code", sa.String(length=32), nullable=False),
        sa.Column("recipient_city", sa.String(length=120), nullable=False),
        sa.Column("recipient_country", sa.String(length=2), nullable=False, server_default="PL"),
        sa.Column("recipient_street", sa.String(length=200), nullable=False),

        sa.Column("contents", sa.Text(), nullable=False),
        sa.Column("vin", sa.String(length=32), nullable=True),
        sa.Column("plate_no", sa.String(length=32), nullable=True),

        sa.Column("requested_by_upn", sa.String(length=254), nullable=False),
        sa.Column("requested_by_name", sa.String(length=200), nullable=False),

        sa.Column("cost_center_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cost_centers.id"), nullable=False),
        sa.Column("carrier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("carriers.id"), nullable=True),
        sa.Column("carrier_tracking_no", sa.String(length=120), nullable=True),

        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_shipments_internal_no", "shipments", ["internal_no"], unique=True)
    op.create_index("ix_shipments_status_created_at", "shipments", ["status", "created_at"], unique=False)

    op.create_table(
        "shipment_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shipment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shipments.id"), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_upn", sa.String(length=254), nullable=False),
    )
    op.create_index("ix_shipment_events_shipment_id", "shipment_events", ["shipment_id"], unique=False)

def downgrade():
    op.drop_index("ix_shipment_events_shipment_id", table_name="shipment_events")
    op.drop_table("shipment_events")
    op.drop_index("ix_shipments_status_created_at", table_name="shipments")
    op.drop_index("ix_shipments_internal_no", table_name="shipments")
    op.drop_table("shipments")
    op.drop_table("counters")
    op.drop_index("ix_cost_centers_code", table_name="cost_centers")
    op.drop_table("cost_centers")
    op.drop_index("ix_carriers_name", table_name="carriers")
    op.drop_table("carriers")
    op.execute("DROP TYPE IF EXISTS shipmentstatus")
    op.execute("DROP TYPE IF EXISTS direction")
