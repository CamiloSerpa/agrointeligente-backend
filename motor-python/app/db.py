import os
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool as pgpool

_pool = None


def get_pool():
    global _pool
    if _pool is None:
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            _pool = pgpool.SimpleConnectionPool(
                minconn=1,
                maxconn=5,
                dsn=database_url,
            )
        else:
            _pool = pgpool.SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                host=os.getenv("DB_HOST", "localhost"),
                port=int(os.getenv("DB_PORT", "5432")),
                user=os.getenv("DB_USER", "agro"),
                password=os.getenv("DB_PASSWORD", "agro_pass_dev"),
                dbname=os.getenv("DB_NAME", "agrointeligente"),
            )
    return _pool


def query(sql: str, params: tuple = ()):
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        pool.putconn(conn)


def execute(sql: str, params: tuple = ()):
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            if cur.description:
                rows = cur.fetchall()
                conn.commit()
                return rows
            conn.commit()
            return []
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
