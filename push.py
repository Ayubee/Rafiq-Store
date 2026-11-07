import subprocess

git = r"C:\Users\ayube\AppData\Local\Programs\Git\cmd\git.exe"

p1 = subprocess.run([git, "add", "."], capture_output=True, text=True)
print("ADD:", p1.stdout, p1.stderr)

p2 = subprocess.run([git, "commit", "-m", "Fix Vercel 500: Dedicated serverless API and root static assets"], capture_output=True, text=True)
print("COMMIT:", p2.stdout, p2.stderr)

p3 = subprocess.run([git, "push", "origin", "main"], capture_output=True, text=True)
print("PUSH:", p3.stdout, p3.stderr)
