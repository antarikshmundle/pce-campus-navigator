from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.db.session import Base


class AdminUser(Base):
    """Staff/admin account that can log into the admin panel to manage locations."""
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
