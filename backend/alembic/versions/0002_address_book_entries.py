from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_address_book_entries"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "address_book_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("recipient_name", sa.String(length=200), nullable=False),
        sa.Column("recipient_email", sa.String(length=254), nullable=False),
        sa.Column("recipient_phone", sa.String(length=50), nullable=False),
        sa.Column("recipient_street", sa.String(length=200), nullable=False),
        sa.Column("recipient_country", sa.String(length=2), nullable=False, server_default="PL"),
        sa.Column("recipient_postal_code", sa.String(length=32), nullable=False),
        sa.Column("recipient_city", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_address_book_entries_recipient_email", "address_book_entries", ["recipient_email"], unique=False)
    op.create_index("ix_address_book_entries_recipient_country", "address_book_entries", ["recipient_country"], unique=False)
    op.create_index("ix_address_book_entries_recipient_postal_code", "address_book_entries", ["recipient_postal_code"], unique=False)
    op.create_index("ix_address_book_entries_recipient_city", "address_book_entries", ["recipient_city"], unique=False)
    op.create_index("ix_address_book_name_city", "address_book_entries", ["recipient_name", "recipient_city"], unique=False)


def downgrade():
    op.drop_index("ix_address_book_name_city", table_name="address_book_entries")
    op.drop_index("ix_address_book_entries_recipient_city", table_name="address_book_entries")
    op.drop_index("ix_address_book_entries_recipient_postal_code", table_name="address_book_entries")
    op.drop_index("ix_address_book_entries_recipient_country", table_name="address_book_entries")
    op.drop_index("ix_address_book_entries_recipient_email", table_name="address_book_entries")
    op.drop_table("address_book_entries")
