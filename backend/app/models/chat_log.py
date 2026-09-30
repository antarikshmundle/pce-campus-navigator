from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from app.db.session import Base


class ChatLog(Base):
    """
    Every chatbot query, for admin analytics (see: most-asked locations,
    queries that had no match so the location list can be improved).
    """
    __tablename__ = "chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    query_text = Column(Text, nullable=False)
    matched_location = Column(String(150), nullable=True)
    match_score = Column(Integer, nullable=True)  # rapidfuzz score 0-100
    was_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
