"""merge content + avatar_accessory

Revision ID: 7c23d3a783ed
Revises: 0008_avatar_accessory, 0008_content
Create Date: 2026-06-01 08:49:58.942972

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c23d3a783ed'
down_revision: Union[str, Sequence[str], None] = ('0008_avatar_accessory', '0008_content')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
