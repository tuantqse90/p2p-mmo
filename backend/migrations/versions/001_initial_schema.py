"""Initial schema — all tables, enums, indexes, constraints.

Revision ID: 001
Revises:
Create Date: 2026-02-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# --- Enum types ---
user_tier = postgresql.ENUM("new", "standard", "trusted", name="user_tier", create_type=False)
product_category = postgresql.ENUM("data", "accounts", "tools", "services", "other", name="product_category", create_type=False)
product_status = postgresql.ENUM("active", "paused", "sold_out", "deleted", name="product_status", create_type=False)
chain_type = postgresql.ENUM("bsc", "ethereum", "arbitrum", "base", name="chain_type", create_type=False)
token_type = postgresql.ENUM("USDT", "USDC", name="token_type", create_type=False)
order_status = postgresql.ENUM(
    "created", "seller_confirmed", "completed", "disputed",
    "resolved_buyer", "resolved_seller", "cancelled", "expired",
    name="order_status", create_type=False,
)
evidence_type = postgresql.ENUM("screenshot", "conversation", "product_proof", "other", name="evidence_type", create_type=False)


def upgrade() -> None:
    # --- Create enum types ---
    user_tier.create(op.get_bind(), checkfirst=True)
    product_category.create(op.get_bind(), checkfirst=True)
    product_status.create(op.get_bind(), checkfirst=True)
    chain_type.create(op.get_bind(), checkfirst=True)
    token_type.create(op.get_bind(), checkfirst=True)
    order_status.create(op.get_bind(), checkfirst=True)
    evidence_type.create(op.get_bind(), checkfirst=True)

    # --- 1. user_profiles ---
    op.create_table(
        "user_profiles",
        sa.Column("wallet", sa.String(42), primary_key=True),
        sa.Column("display_name", sa.String(50), nullable=True),
        sa.Column("public_key", sa.String(88), nullable=False),
        sa.Column("reputation_score", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("total_trades", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_as_buyer", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_as_seller", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rating", sa.Numeric(3, 2), nullable=True),
        sa.Column("tier", user_tier, nullable=False, server_default="new"),
        sa.Column("is_blacklisted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_user_profiles_tier", "user_profiles", ["tier"])
    op.create_index("ix_user_profiles_rating", "user_profiles", ["rating"])

    # --- 2. products ---
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("seller_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=False),
        sa.Column("title_preview", sa.String(100), nullable=False),
        sa.Column("description_preview", sa.String(500), nullable=True),
        sa.Column("category", product_category, nullable=False),
        sa.Column("price_usdt", sa.Numeric(18, 6), nullable=False),
        sa.Column("stock", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_sold", sa.Integer, nullable=False, server_default="0"),
        sa.Column("product_hash", sa.String(66), nullable=False),
        sa.Column("status", product_status, nullable=False, server_default="active"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_products_seller", "products", ["seller_wallet"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_status", "products", ["status"])
    op.create_index("ix_products_price", "products", ["price_usdt"])
    op.create_index("ix_products_created_at", "products", ["created_at"])

    # --- 3. orders ---
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("onchain_order_id", sa.BigInteger, nullable=True),
        sa.Column("chain", chain_type, nullable=False, server_default="bsc"),
        sa.Column("buyer_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=False),
        sa.Column("seller_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=False),
        sa.Column("arbitrator_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("token", token_type, nullable=False),
        sa.Column("amount", sa.Numeric(18, 6), nullable=False),
        sa.Column("platform_fee", sa.Numeric(18, 6), nullable=False),
        sa.Column("status", order_status, nullable=False, server_default="created"),
        sa.Column("product_key_encrypted", sa.Text, nullable=True),
        sa.Column("tx_hash_create", sa.String(66), nullable=False),
        sa.Column("tx_hash_complete", sa.String(66), nullable=True),
        sa.Column("seller_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispute_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispute_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_unique_constraint("uq_orders_chain_onchain", "orders", ["chain", "onchain_order_id"])
    op.create_index("ix_orders_buyer", "orders", ["buyer_wallet"])
    op.create_index("ix_orders_seller", "orders", ["seller_wallet"])
    op.create_index("ix_orders_arbitrator", "orders", ["arbitrator_wallet"])
    op.create_index("ix_orders_product", "orders", ["product_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_chain_status", "orders", ["chain", "status"])

    # --- 4. messages ---
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("sender_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=False),
        sa.Column("ciphertext", sa.Text, nullable=False),
        sa.Column("nonce", sa.String(44), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_messages_order_created", "messages", ["order_id", "created_at"])
    op.create_index("ix_messages_sender", "messages", ["sender_wallet"])

    # --- 5. reviews ---
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("reviewer_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=False),
        sa.Column("target_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=False),
        sa.Column("rating", sa.SmallInteger, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_unique_constraint("uq_reviews_order_reviewer", "reviews", ["order_id", "reviewer_wallet"])
    op.create_index("ix_reviews_target", "reviews", ["target_wallet"])
    op.create_index("ix_reviews_order", "reviews", ["order_id"])

    # --- 6. arbitrators ---
    op.create_table(
        "arbitrators",
        sa.Column("wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), primary_key=True),
        sa.Column("stake_amount", sa.Numeric(18, 6), nullable=False),
        sa.Column("stake_token", sa.String(42), nullable=False),
        sa.Column("reputation", sa.SmallInteger, nullable=False, server_default="50"),
        sa.Column("total_resolved", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_earned", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # --- 7. dispute_evidence ---
    op.create_table(
        "dispute_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("submitter_wallet", sa.String(42), sa.ForeignKey("user_profiles.wallet"), nullable=False),
        sa.Column("ipfs_hash", sa.String(100), nullable=False),
        sa.Column("evidence_type", evidence_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_dispute_evidence_order", "dispute_evidence", ["order_id"])

    # --- 8. blacklist ---
    op.create_table(
        "blacklist",
        sa.Column("wallet", sa.String(42), primary_key=True),
        sa.Column("reason", sa.String(200), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("added_by", sa.String(42), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # --- 9. event_sync_cursor ---
    op.create_table(
        "event_sync_cursor",
        sa.Column("chain", chain_type, primary_key=True),
        sa.Column("contract", sa.String(42), nullable=False),
        sa.Column("last_block", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # --- updated_at trigger function ---
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    # Apply trigger to tables with updated_at
    for table in ["user_profiles", "products", "orders", "arbitrators", "event_sync_cursor"]:
        op.execute(f"""
            CREATE TRIGGER update_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """)


def downgrade() -> None:
    # Drop triggers
    for table in ["user_profiles", "products", "orders", "arbitrators", "event_sync_cursor"]:
        op.execute(f"DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table};")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column();")

    # Drop tables in reverse dependency order
    op.drop_table("event_sync_cursor")
    op.drop_table("blacklist")
    op.drop_table("dispute_evidence")
    op.drop_table("arbitrators")
    op.drop_table("reviews")
    op.drop_table("messages")
    op.drop_table("orders")
    op.drop_table("products")
    op.drop_table("user_profiles")

    # Drop enum types
    evidence_type.drop(op.get_bind(), checkfirst=True)
    order_status.drop(op.get_bind(), checkfirst=True)
    token_type.drop(op.get_bind(), checkfirst=True)
    chain_type.drop(op.get_bind(), checkfirst=True)
    product_status.drop(op.get_bind(), checkfirst=True)
    product_category.drop(op.get_bind(), checkfirst=True)
    user_tier.drop(op.get_bind(), checkfirst=True)
