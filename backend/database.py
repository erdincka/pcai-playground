import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use environment variable for database URL, default to sqlite for local dev fallback if needed,
# but primarily target PostgreSQL for production.
DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    # Try constructing from components (better for K8s secrets)
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    host = os.getenv("POSTGRES_HOST")
    port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "playground")
    
    if user and password and host:
        DB_URL = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db_name}"
    else:
        DB_URL = "sqlite:///./playground.db"

connect_args = {}
if "sqlite" in DB_URL:
    connect_args = {"check_same_thread": False}
elif "postgresql" in DB_URL:
    # Fail fast if DB is unreachable to allow K8s to handle restarts/health
    connect_args = {"connect_timeout": 5}

engine = create_engine(DB_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)