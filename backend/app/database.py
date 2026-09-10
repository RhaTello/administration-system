from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = f"sqlite:///{Path(__file__).resolve().parents[1] / 'systema.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 45})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
