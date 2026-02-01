#!/usr/bin/env python3
"""
Simple reverse proxy for Tana API.
Allows VMs/containers to access Tana Desktop API which only listens on localhost.

Usage: python3 scripts/tana-proxy.py [--port 8263]
"""

import http.server
import urllib.request
import urllib.error
import argparse
import json

TANA_API = "http://127.0.0.1:8262"

class TanaProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_request(self, method):
        # Read request body if present
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Build target URL
        target_url = f"{TANA_API}{self.path}"

        # Forward headers, fixing Host
        headers = {}
        for key, value in self.headers.items():
            if key.lower() == 'host':
                headers[key] = '127.0.0.1:8262'
            elif key.lower() not in ('connection', 'transfer-encoding'):
                headers[key] = value

        try:
            req = urllib.request.Request(target_url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=30) as response:
                self.send_response(response.status)
                for key, value in response.headers.items():
                    if key.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(key, value)
                self.end_headers()
                self.wfile.write(response.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        self.do_request('GET')

    def do_POST(self):
        self.do_request('POST')

    def do_PUT(self):
        self.do_request('PUT')

    def do_DELETE(self):
        self.do_request('DELETE')

    def log_message(self, format, *args):
        print(f"[proxy] {args[0]}")

def main():
    parser = argparse.ArgumentParser(description='Tana API Proxy')
    parser.add_argument('--port', type=int, default=8263, help='Port to listen on')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    args = parser.parse_args()

    server = http.server.HTTPServer((args.host, args.port), TanaProxyHandler)
    print(f"Tana proxy listening on {args.host}:{args.port}")
    print(f"Forwarding to {TANA_API}")
    print(f"VM can access via: http://192.168.139.1:{args.port}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()

if __name__ == '__main__':
    main()
