import subprocess

git = r"C:\Users\ayube\AppData\Local\Programs\Git\cmd\git.exe"
p1 = subprocess.run([git, "add", "."], capture_output=True, text=True)
print("add:", p1.stdout, p1.stderr)

p2 = subprocess.run([git, "commit", "-m", "Fix Vercel 500: Serverless handler export and Node 20 fallback"], capture_output=True, text=True)
print("commit:", p2.stdout, p2.stderr)
