"""seed goal_catalog: a starter curated list, so matching has something to match on

`goal_catalog` shipped in 0016_child_goals with a review workflow but no rows
and no admin route to add them — every child's goal has always had
`match_key=None`, so goal_signal and goal_mates could never surface a match no
matter what two children typed, even the literal same book title. This seeds
a first batch of common Uzbek-context goals (books, textbooks, exam prep,
skills, habits), all pre-reviewed and `matchable=True`, so matching works out
of the box. A human can add more later; nothing here is personal or
unmoderated — every title is a fixed, curated string, never child free-text.

Revision ID: 0022_seed_goal_catalog
Revises: 0021_signup_profile
Create Date: 2026-08-05
"""

import json
from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0022_seed_goal_catalog"
down_revision: str | None = "0021_signup_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (match_key, kind, title, target_ref, age_min, age_max)
_SEED: list[tuple[str, str, str, dict | None, int, int]] = [
    # -- books --
    ("book_otkan_kunlar", "book", "Abdulla Qodiriy — O'tkan Kunlar", None, 12, 16),
    ("book_mehrobdan_chayon", "book", "Abdulla Qodiriy — Mehrobdan Chayon", None, 13, 16),
    ("book_kecha_va_kunduz", "book", "Cho'lpon — Kecha va Kunduz", None, 13, 16),
    ("book_ikki_eshik_orasi", "book", "Said Ahmad — Ikki Eshik Orasi", None, 12, 16),
    ("book_dunyoning_ishlari", "book", "O'tkir Hoshimov — Dunyoning Ishlari", None, 12, 16),
    ("book_yulduzli_tunlar", "book", "Pirimqul Qodirov — Yulduzli Tunlar", None, 13, 16),
    # -- textbooks --
    ("textbook_matematika_5", "textbook", "5-sinf matematika darsligi", {"subject": "matematika", "grade": 5}, 10, 11),
    ("textbook_matematika_6", "textbook", "6-sinf matematika darsligi", {"subject": "matematika", "grade": 6}, 11, 12),
    ("textbook_matematika_7", "textbook", "7-sinf matematika darsligi", {"subject": "matematika", "grade": 7}, 12, 13),
    ("textbook_matematika_8", "textbook", "8-sinf matematika darsligi", {"subject": "matematika", "grade": 8}, 13, 14),
    ("textbook_matematika_9", "textbook", "9-sinf matematika darsligi", {"subject": "matematika", "grade": 9}, 14, 15),
    ("textbook_fizika_7", "textbook", "7-sinf fizika darsligi", {"subject": "fizika", "grade": 7}, 12, 13),
    ("textbook_fizika_8", "textbook", "8-sinf fizika darsligi", {"subject": "fizika", "grade": 8}, 13, 14),
    ("textbook_fizika_9", "textbook", "9-sinf fizika darsligi", {"subject": "fizika", "grade": 9}, 14, 15),
    ("textbook_ingliz_5", "textbook", "5-sinf ingliz tili darsligi", {"subject": "ingliz tili", "grade": 5}, 10, 11),
    ("textbook_ingliz_6", "textbook", "6-sinf ingliz tili darsligi", {"subject": "ingliz tili", "grade": 6}, 11, 12),
    ("textbook_kimyo_8", "textbook", "8-sinf kimyo darsligi", {"subject": "kimyo", "grade": 8}, 13, 14),
    # -- skills --
    ("skill_ingliz_gapirish", "skill", "Ingliz tilida erkin gaplashish", None, 7, 16),
    ("skill_dasturlash", "skill", "Dasturlashni o'rganish", None, 10, 16),
    ("skill_chizish", "skill", "Chizishni o'rganish", None, 7, 16),
    ("skill_gitara", "skill", "Gitara chalishni o'rganish", None, 9, 16),
    # -- exam prep --
    ("exam_dtm_matematika", "exam", "DTM: Matematikaga tayyorgarlik", None, 14, 16),
    ("exam_dtm_ingliz", "exam", "DTM: Ingliz tiliga tayyorgarlik", None, 14, 16),
    ("exam_ielts", "exam", "IELTS imtihoniga tayyorgarlik", None, 14, 16),
    # -- habits --
    ("habit_har_kuni_kitob", "habit", "Har kuni kitob o'qish", None, 7, 16),
    ("habit_har_kuni_sport", "habit", "Har kuni sport qilish", None, 7, 16),
    ("habit_erta_turish", "habit", "Erta turishni odat qilish", None, 7, 16),
]

# Explicit ::goal_kind cast — goal_catalog.kind is a Postgres enum, and a bare
# bound parameter would leave the driver guessing its type.
_INSERT = sa.text(
    """
    INSERT INTO goal_catalog
        (id, match_key, kind, title, target_ref, age_min, age_max, active, matchable)
    VALUES
        (:id, :match_key, CAST(:kind AS goal_kind), :title, CAST(:target_ref AS jsonb),
         :age_min, :age_max, true, true)
    """
)

_DELETE = sa.text("DELETE FROM goal_catalog WHERE match_key = ANY(:keys)")


def upgrade() -> None:
    conn = op.get_bind()
    for match_key, kind, title, target_ref, age_min, age_max in _SEED:
        conn.execute(
            _INSERT,
            {
                "id": uuid4(),
                "match_key": match_key,
                "kind": kind,
                "title": title,
                "target_ref": json.dumps(target_ref) if target_ref else None,
                "age_min": age_min,
                "age_max": age_max,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(_DELETE, {"keys": [row[0] for row in _SEED]})
