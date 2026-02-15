"""
Snowflake data source: fetch earthquake or other data from configured Snowflake tables.
Requires SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT in .env.
"""
from typing import Any

from app.settings import settings


def _get_connection():
    """Create Snowflake connection from settings. Returns None if not configured."""
    if not all([settings.snowflake_user, settings.snowflake_password, settings.snowflake_account]):
        return None
    import snowflake.connector
    return snowflake.connector.connect(
        user=settings.snowflake_user,
        password=settings.snowflake_password,
        account=settings.snowflake_account,
        warehouse=settings.snowflake_warehouse,
        database=settings.snowflake_database,
        schema=settings.snowflake_schema,
    )


def fetch_table(table_name: str, limit: int = 100) -> tuple[list[dict[str, Any]], str | None]:
    """
    Fetch rows from a Snowflake table. Returns (list of row dicts, error_message).
    If not configured or query fails, returns ([], error_message).
    """
    conn = None
    try:
        conn = _get_connection()
        if conn is None:
            return [], "Snowflake not configured. Set SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT in .env."

        cursor = conn.cursor()
        # Use identifier quoting to handle mixed-case/special table names
        safe_table = f'"{table_name}"' if not table_name.isupper() else table_name
        query = f"SELECT * FROM {safe_table} LIMIT {limit}"
        cursor.execute(query)

        columns = [col[0] for col in cursor.description]
        rows = []
        for row in cursor:
            rows.append(dict(zip(columns, row)))

        return rows, None
    except Exception as e:
        return [], str(e)
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def list_tables() -> tuple[list[str], str | None]:
    """
    List tables in the configured schema. Returns (list of table names, error_message).
    """
    conn = None
    try:
        conn = _get_connection()
        if conn is None:
            return [], "Snowflake not configured. Set SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT in .env."

        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        columns = [col[0] for col in cursor.description]
        name_idx = columns.index("name") if "name" in columns else 1
        tables = [row[name_idx] for row in cursor]
        return tables, None
    except Exception as e:
        return [], str(e)
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def is_configured() -> bool:
    """Return True if Snowflake credentials are set."""
    return bool(
        settings.snowflake_user
        and settings.snowflake_password
        and settings.snowflake_account
    )
