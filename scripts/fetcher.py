import sys
import time
import gzip
import subprocess
import urllib.request
import urllib.error

if len(sys.argv) < 2:
    sys.stderr.write("URL is required\n")
    sys.exit(1)

url = sys.argv[1]
headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'close',
}

last_error = None
max_retries = 3

for attempt in range(1, max_retries + 1):
    try:
        timeout = 15 + (attempt * 5)  # 20s, 25s, 30s
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            encoding = resp.info().get('Content-Encoding', '').lower()
            if 'gzip' in encoding:
                data = gzip.decompress(raw)
            else:
                data = raw

            if len(data) > 300:
                try:
                    sys.stdout.buffer.write(data)
                    sys.stdout.buffer.flush()
                except (BrokenPipeError, IOError):
                    pass
                sys.exit(0)
    except Exception as e:
        last_error = e
        if attempt < max_retries:
            time.sleep(attempt * 1.0)

# Fallback to curl if urllib failed
try:
    curl_cmd = [
        'curl', '-s', '-L',
        '--max-time', '25',
        '-H', f"User-Agent: {headers['User-Agent']}",
        '-H', f"Accept: {headers['Accept']}",
        '-H', f"Accept-Language: {headers['Accept-Language']}",
        '--compressed',
        url
    ]
    res = subprocess.run(curl_cmd, capture_output=True, timeout=30)
    if res.returncode == 0 and len(res.stdout) > 300:
        try:
            sys.stdout.buffer.write(res.stdout)
            sys.stdout.buffer.flush()
        except (BrokenPipeError, IOError):
            pass
        sys.exit(0)
except Exception as ce:
    last_error = ce

if not isinstance(last_error, (BrokenPipeError, IOError)):
    sys.stderr.write(f"Fetch failed: {str(last_error)}\n")
sys.exit(1)
