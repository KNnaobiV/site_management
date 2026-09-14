import os

files_to_fix = [
    r"c:\Users\Chike\Ekene\site_management\backend\core\views.py",
    r"c:\Users\Chike\Ekene\site_management\backend\finance\views.py"
]

for file_path in files_to_fix:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace occurrences
        new_content = content.replace('__foreman=user', '__foremen=user')
        new_content = new_content.replace('__storekeeper=user', '__foremen=user')
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed {file_path}")
        else:
            print(f"No changes needed for {file_path}")
    else:
        print(f"File not found: {file_path}")
