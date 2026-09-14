import sqlite3

conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()

tables = [
    'core_constructionproject',
    'core_constructionplot',
    'core_workitem',
    'core_jobitem'
]

for table in tables:
    try:
        c.execute(f"UPDATE {table} SET manual_progress = NULL WHERE manual_progress = ''")
        print(f"Updated {table}")
    except Exception as e:
        print(f"Failed on {table}: {e}")
        
conn.commit()
conn.close()
print("Done!")
