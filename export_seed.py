import urllib.request
import json

req = urllib.request.Request("http://localhost:3001/api/macros")
with urllib.request.urlopen(req) as res:
    macros = json.loads(res.read().decode())

req2 = urllib.request.Request("http://localhost:3001/api/categories")
with urllib.request.urlopen(req2) as res:
    cats = json.loads(res.read().decode())

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump({"categories": cats, "macros": macros}, f, ensure_ascii=False, indent=2)

print("Exported seed.json with", len(macros), "macros and", len(cats), "categories")
