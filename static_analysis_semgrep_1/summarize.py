import json
import glob
import os
import sys
from collections import Counter, defaultdict

BASE = os.path.dirname(__file__)
RAW = os.path.join(BASE, "raw")
RESULTS = os.path.join(BASE, "results")


def load_results():
    merged = []
    seen = set()
    for path in sorted(glob.glob(os.path.join(RAW, "*.json"))):
        if "important" in os.path.basename(path):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        for r in data.get("results", []):
            key = (
                r.get("check_id"),
                r.get("path"),
                r.get("start", {}).get("line"),
                r.get("end", {}).get("line"),
            )
            if key in seen:
                continue
            seen.add(key)
            r["_source_file"] = os.path.basename(path)
            merged.append(r)
    return merged


def main():
    results = load_results()
    print(f"Total unique findings: {len(results)}\n")

    by_sev = Counter(r.get("extra", {}).get("severity", "?") for r in results)
    print("By severity:", dict(by_sev))

    by_file = Counter(r.get("path", "?") for r in results)
    print("\nBy file (top 10):")
    for path, count in by_file.most_common(10):
        print(f"  {count}x {path}")

    print("\n=== Findings ===")
    for r in sorted(results, key=lambda x: (x.get("path", ""), x.get("start", {}).get("line", 0))):
        extra = r.get("extra", {})
        meta = extra.get("metadata", {})
        sev = extra.get("severity", "?")
        line = r.get("start", {}).get("line", "?")
        cwe = meta.get("cwe", meta.get("owasp", ""))
        msg = extra.get("message", "").replace("\n", " ")[:120]
        print(f"\n[{sev}] {r.get('check_id')}")
        print(f"  {r.get('path')}:{line}")
        if cwe:
            print(f"  CWE/OWASP: {cwe}")
        print(f"  {msg}")

    os.makedirs(RESULTS, exist_ok=True)
    out_path = os.path.join(RESULTS, "findings-summary.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"count": len(results), "findings": results}, f, indent=2, ensure_ascii=False)
    print(f"\nWritten: {out_path}")


if __name__ == "__main__":
    main()
