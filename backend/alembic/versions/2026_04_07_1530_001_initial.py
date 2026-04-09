"""Initial migration - captures existing database schema

Revision ID: 001_initial
Revises:
Create Date: 2026-04-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This is an initial migration for an existing database.
    # The actual schema is created by Base.metadata.create_all() in main.py.
    # This migration serves as a baseline for future migrations.
    #
    # To generate a proper initial migration from current models, run:
    #   alembic revision --autogenerate -m "initial_schema"
    #
    # For now, we assume the database already exists with the current schema.
    pass


def downgrade() -> None:
    # Do not drop tables on downgrade for safety
    pass
