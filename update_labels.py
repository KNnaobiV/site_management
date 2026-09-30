import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Regex to find <label ...>...</label>
    # We want to match the opening tag, the inner content, and the closing tag
    pattern = re.compile(r'(<label[^>]*>)(.*?)(</label>)', re.DOTALL)
    
    def replacer(match):
        open_tag = match.group(1)
        inner = match.group(2)
        close_tag = match.group(3)
        
        # If it has an asterisk, it's compulsory.
        # If it doesn't have an asterisk and doesn't already have (Optional), add (Optional).
        if 'var(--brand-orange)' in inner or '*' in inner or '(Optional)' in inner:
            return open_tag + inner + close_tag
        else:
            if inner.strip() == '':
                return match.group(0) # ignore empty labels
            
            # Add (Optional) text
            optional_span = ' <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span>'
            new_inner = inner + optional_span
            return open_tag + new_inner + close_tag

    new_content, count = pattern.subn(replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath} ({count} replacements)")

def main():
    src_dir = os.path.join('frontend', 'src')
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js'):
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
