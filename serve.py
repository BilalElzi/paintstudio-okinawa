#!/usr/bin/env python3
"""Serveur statique local pour le dev.
   - désactive le cache navigateur (no-store)
   - supporte les requêtes HTTP Range (indispensable pour scruber les <video>)
   Usage : python3 serve.py [port]   (défaut 5577)"""
import http.server, socketserver, os, sys, re

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5577
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Accept-Ranges", "bytes")
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def send_head(self):
        """Réponse 206 si l'en-tête Range est présent, sinon comportement normal."""
        self.range = None
        header = self.headers.get("Range")
        if header:
            m = RANGE_RE.match(header.strip())
            if m and (m.group(1) or m.group(2)):
                self.range = (m.group(1), m.group(2))
        if not self.range:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        size = os.fstat(f.fileno()).st_size
        start_s, end_s = self.range
        start = int(start_s) if start_s else size - int(end_s)
        end = int(end_s) if end_s and start_s else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            f.close()
            self.send_error(416, "Requested Range Not Satisfiable")
            return None
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._range_remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        if self.range is None:
            return super().copyfile(source, outputfile)
        remaining = self._range_remaining
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

print(f"Ryuhaku dev server → http://localhost:{PORT}  (no-cache + Range)")
ThreadingHTTPServer(("", PORT), Handler).serve_forever()
