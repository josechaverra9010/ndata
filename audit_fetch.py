import os
import re

ROOT_DIR = r"C:\Users\Victus\ndata\src"
FETCH_RE = re.compile(r'fetch\(`?\$\{API_URL\}/[^`\)]+`?(,\s*\{)?')
AUTH_RE = re.compile(r'Authorization', re.IGNORECASE)

def audit_files():
    vulnerable_files = {}
    
    for root, dirs, files in os.walk(ROOT_DIR):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Find all fetch calls
                fetch_calls = list(re.finditer(r'fetch\((.*?)\)', content, re.DOTALL))
                
                vulnerabilities = []
                for match in fetch_calls:
                    call_content = match.group(1)
                    if 'API_URL' in call_content and 'Authorization' not in call_content:
                        # Double check if it's a simple fetch without options object
                        # fetch(url) or fetch(url, { headers: { ... } })
                        vulnerabilities.append(call_content.split(',')[0].strip())
                
                if vulnerabilities:
                    vulnerable_files[path] = vulnerabilities
                    
    return vulnerable_files

if __name__ == "__main__":
    vulnerabilities = audit_files()
    with open("audit_results.txt", "w", encoding="utf-8") as out:
        if not vulnerabilities:
            out.write("No vulnerable fetch calls found.\n")
        else:
            out.write(f"Found {len(vulnerabilities)} vulnerable files:\n")
            for path, calls in vulnerabilities.items():
                out.write(f"\nFile: {path}\n")
                for call in calls:
                    out.write(f"  - {call}\n")
    print(f"Audit complete. Found {len(vulnerabilities)} vulnerable files. Results written to audit_results.txt.")
