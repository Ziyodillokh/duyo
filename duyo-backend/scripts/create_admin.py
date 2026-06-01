"""Create (or update) an admin user — there is no admin self-signup.

Usage:
    .venv/bin/python scripts/create_admin.py <email> <password> <role>

role ∈ super_admin|admin|safety_officer|content_manager|support_agent|
       finance_manager|school_admin|analyst
"""

import asyncio
import sys

from sqlalchemy import select

from duyo.core.admin_security import hash_password
from duyo.core.database import get_session_factory
from duyo.models.admin import AdminRole, AdminUser


async def main(email: str, password: str, role: str) -> None:
    role_enum = AdminRole(role)  # raises ValueError on bad role
    email = email.lower()
    sf = get_session_factory()
    async with sf() as s:
        admin = await s.scalar(select(AdminUser).where(AdminUser.email == email))
        if admin is None:
            admin = AdminUser(email=email, password_hash=hash_password(password), role=role_enum)
            s.add(admin)
            action = "created"
        else:
            admin.password_hash = hash_password(password)
            admin.role = role_enum
            admin.is_active = True
            action = "updated"
        await s.commit()
    print(f"Admin {action}: {email} ({role_enum.value})")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
