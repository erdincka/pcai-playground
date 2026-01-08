import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use environment variable for database URL, default to sqlite for local dev fallback if needed,
# but primarily target PostgreSQL for production.
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./playground.db")

connect_args = {}
if "sqlite" in DB_URL:
    connect_args = {"check_same_thread": False}

engine = create_engine(DB_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
