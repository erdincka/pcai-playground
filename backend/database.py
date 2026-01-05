from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

DB_URL = "sqlite:///./playground.db"  # In production use postgresql+asyncpg
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)