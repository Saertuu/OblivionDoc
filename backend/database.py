"""The Windows application always uses its own persistent SQLite database."""
from sqlalchemy import URL, create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from .paths import DATA_DIR

DATABASE_FILE = DATA_DIR / "obliviondoc.db"
engine = create_engine(
    URL.create("sqlite", database=str(DATABASE_FILE)),
    connect_args={"check_same_thread": False, "timeout": 30},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def configure_sqlite(connection, _):
    cursor = connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    with SessionLocal() as db:
        yield db
