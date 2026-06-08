"""Static server for brain-atlas/ that disables caching, so a rebuilt brain.glb /
data.js shows up on a plain browser refresh (no port-hopping). Run from repo root:
    python scripts/serve_nocache.py 8862
"""
import http.server, os, sys
os.chdir(os.path.join(os.path.dirname(__file__), "..", "brain-atlas"))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8862

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

http.server.ThreadingHTTPServer(("", PORT), H).serve_forever()
