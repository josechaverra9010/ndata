filename = "c:/Users/Victus/ndata/main.py"
search_patterns = ['class PatientCreateSchema', 'class ProfileUpdateSchema', 'class PatientResponse']

try:
    with open(filename, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            for pattern in search_patterns:
                if pattern in line:
                    print(f"Found {pattern} at line {i}: {line.strip()}")
except Exception as e:
    print(f"Error: {e}")
