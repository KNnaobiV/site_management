import sqlite3
import os

db_path = r"c:\Users\Chike\Ekene\site_management\backend\db.sqlite3"
if not os.path.exists(db_path):
    print("Database not found at", db_path)
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    queries = [
        "ALTER TABLE finance_expense ADD COLUMN is_deleted integer DEFAULT 0 NOT NULL;",
        "ALTER TABLE finance_expense ADD COLUMN deletion_reason text DEFAULT '' NOT NULL;",
        "ALTER TABLE finance_expense ADD COLUMN deleted_by_id integer NULL;",
        "ALTER TABLE finance_expense ADD COLUMN deleted_at datetime NULL;"
    ]
    
    for q in queries:
        try:
            cursor.execute(q)
            print(f"Executed: {q}")
        except Exception as e:
            print(f"Error on '{q}': {e}")
    
    conn.commit()
    conn.close()
    print("Done applying fixes to finance_expense.")
