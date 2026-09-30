import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Clean all labels by removing existing asterisks and optional tags.
    def clean_label(match):
        open_tag = match.group(1)
        inner = match.group(2)
        close_tag = match.group(3)

        # Remove various forms of (Optional)
        inner = re.sub(r'<span[^>]*>\(Optional\)</span>', '', inner, flags=re.IGNORECASE)
        inner = re.sub(r'<span[^>]*>\(optional\)</span>', '', inner, flags=re.IGNORECASE)
        inner = re.sub(r'\s*\(Optional\)\s*', '', inner, flags=re.IGNORECASE)
        inner = re.sub(r'\s*\(optional\)\s*', '', inner, flags=re.IGNORECASE)

        # Remove various forms of *
        inner = re.sub(r'<span[^>]*>\*</span>', '', inner)
        inner = inner.replace('*', '')

        return open_tag + inner.strip() + close_tag

    pattern = re.compile(r'(<label[^>]*>)(.*?)(</label>)', re.DOTALL)
    cleaned_content = pattern.sub(clean_label, content)

    # Step 2: Identify if required and append proper tag
    # We will search for all <label>...</label> and then look at the characters immediately following it.
    
    def replace_with_annotations():
        result = []
        last_idx = 0
        for match in pattern.finditer(cleaned_content):
            open_tag = match.group(1)
            inner = match.group(2)
            close_tag = match.group(3)
            
            # append text before label
            result.append(cleaned_content[last_idx:match.start()])
            last_idx = match.end()
            
            if inner.strip() == '':
                result.append(match.group(0))
                continue
                
            # extract up to 400 characters after the label to find the input
            rest_of_file = cleaned_content[match.end():match.end()+400]
            
            # find first tag that is an input/select/textarea
            input_match = re.search(r'<(input|select|textarea|ImageUploader)([^>]*)>', rest_of_file)
            
            is_required = False
            
            if input_match:
                attrs = input_match.group(2)
                # Check for 'required' or 'required={true}'
                if re.search(r'\brequired(\s*=|[\s/]|$)', attrs):
                    is_required = True
                    
                # Some fields might be custom components where required isn't explicit, 
                # but usually we've put required in native elements.
            
            # Heuristics based on label name if input isn't clear
            lower_inner = inner.lower()
            always_required = ['first name', 'last name', 'title', 'role', 'email', 'password', 'date', 'amount', 'category']
            always_optional = ['notes', 'issues', 'comments', 'video link', 'description', 'message', 'gps coordinates', 'export scope', 'from', 'to', 'work', 'job']
            
            if not is_required:
                if any(req in lower_inner for req in always_required) and not any(opt in lower_inner for opt in always_optional):
                    is_required = True
                
                # Check explicit always optional
                if any(opt in lower_inner for opt in always_optional):
                    is_required = False

            if is_required:
                asterisk = ' <span style={{ color: "var(--brand-orange)" }}>*</span>'
                new_inner = inner + asterisk
                result.append(open_tag + new_inner + close_tag)
            else:
                optional_span = ' <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span>'
                new_inner = inner + optional_span
                result.append(open_tag + new_inner + close_tag)
                
        result.append(cleaned_content[last_idx:])
        return "".join(result)

    final_content = replace_with_annotations()
    
    if final_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(final_content)
        print(f"Updated {filepath}")

def main():
    src_dir = os.path.join('frontend', 'src')
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js'):
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
