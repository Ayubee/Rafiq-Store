import urllib.request
import re

urls = [
    "https://rafiqstore.vercel.app",
    "https://rafiq-store.vercel.app",
    "https://rafiq-support.vercel.app",
    "https://rafiqstore.vercel.app/api/macros"
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            html = res.read().decode('utf-8', errors='ignore')
            title = re.findall(r'<title>(.*?)</title>', html)
            print(f"[{res.status}] {url} -> Title: {title}")
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {url} -> HTTPError: {e.reason}")
    except Exception as e:
        print(f"[ERR] {url} -> {e}")
