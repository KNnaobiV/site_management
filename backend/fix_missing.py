import sqlite3

def fix_db():
    conn = sqlite3.connect('db.sqlite3')
    c = conn.cursor()
    
    # Create missing M2M tables
    c.execute('''
    CREATE TABLE IF NOT EXISTS "core_workitem_photos" (
        "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
        "workitem_id" bigint NOT NULL REFERENCES "core_workitem" ("id") DEFERRABLE INITIALLY DEFERRED,
        "picture_id" integer NOT NULL REFERENCES "base_picture" ("id") DEFERRABLE INITIALLY DEFERRED
    )
    ''')
    try:
        c.execute('CREATE UNIQUE INDEX "core_workitem_photos_workitem_id_picture_id_idx" ON "core_workitem_photos" ("workitem_id", "picture_id")')
    except:
        pass
        
    c.execute('''
    CREATE TABLE IF NOT EXISTS "core_jobreport_photos" (
        "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
        "jobreport_id" bigint NOT NULL REFERENCES "core_jobreport" ("id") DEFERRABLE INITIALLY DEFERRED,
        "picture_id" integer NOT NULL REFERENCES "base_picture" ("id") DEFERRABLE INITIALLY DEFERRED
    )
    ''')
    try:
        c.execute('CREATE UNIQUE INDEX "core_jobreport_photos_jobreport_id_picture_id_idx" ON "core_jobreport_photos" ("jobreport_id", "picture_id")')
    except:
        pass

    conn.commit()
    conn.close()
    print("M2M tables created!")

def fix_views():
    views_path = "core/views.py"
    with open(views_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    content = content.replace(
        "models_Q(foreman=user) | models_Q(storekeeper=user)",
        "models_Q(foremen=user)"
    )
    
    content = content.replace(
        "models_Q(foreman=user) |",
        "models_Q(foremen=user) |"
    )
    
    with open(views_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("views.py fixed!")

if __name__ == "__main__":
    fix_db()
    fix_views()
