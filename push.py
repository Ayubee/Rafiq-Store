import subprocess

git = r"C:\Users\ayube\AppData\Local\Programs\Git\cmd\git.exe"
subprocess.run([git, "add", "."])
subprocess.run([git, "commit", "-m", "UX improvement: Reset admin table filters to show all macros by default"])
subprocess.run([git, "push", "origin", "main"])
