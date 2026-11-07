import subprocess

git = r"C:\Users\ayube\AppData\Local\Programs\Git\cmd\git.exe"
subprocess.run([git, "add", "."])
p2 = subprocess.run([git, "commit", "-m", "Fix Vercel Serverless Stateless Auth using HMAC tokens and robust admin loading"], capture_output=True, text=True)
print("COMMIT:", p2.stdout, p2.stderr)
p3 = subprocess.run([git, "push", "origin", "main"], capture_output=True, text=True)
print("PUSH:", p3.stdout, p3.stderr)
