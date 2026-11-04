import os
import sys
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = Path(__file__).resolve().parent.parent
os.chdir(str(BASE_DIR))

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    server = ThreadingHTTPServer(('0.0.0.0', port), QuietHandler)
    print(f"🚀 Threading HTTP Server running on http://0.0.0.0:{port} (serving {BASE_DIR})")
    server.serve_forever()
