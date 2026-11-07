import os
for f in ["check_vercel.py", "export_seed.js", "export_seed.py", "push.py", "test_check.py", "test_simple.py"]:
    if os.path.exists(f):
        try: os.remove(f)
        except: pass
