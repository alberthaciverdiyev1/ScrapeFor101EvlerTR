import sys
import urllib.request

if len(sys.argv) < 2:
    sys.stderr.write("URL is required\n")
    sys.exit(1)

url = sys.argv[1]
req = urllib.request.Request(
    url,
    headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    }
)

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        sys.stdout.buffer.write(resp.read())
except Exception as e:
    sys.stderr.write(f"Fetch failed: {str(e)}\n")
    sys.exit(1)
