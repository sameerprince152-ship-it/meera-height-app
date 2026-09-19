"""
Meera Heights Local Server Launcher
Starts a local web server and displays the mobile access URL.
"""

import http.server
import socketserver
import socket
import webbrowser
import os
import sys

HOST = '0.0.0.0'
PORT = 8000

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Select the active LAN interface without sending application data.
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for instant development and live updates
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def run():
    # Ensure current directory is the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    local_ip = get_local_ip()

    print("=" * 65)
    print("       MEERA HEIGHTS - BUILDING EXPENDITURE & RENT APP")
    print("             Co-owned by Sajida & Jeelani")
    print("=" * 65)
    print(f"\n[*] App is running locally at:")
    print(f"    -> Desktop / Laptop Browser : http://localhost:{PORT}")
    print(f"    -> Same-network mobile access: http://{local_ip}:{PORT}")
    print("    -> Server bind address: 0.0.0.0 (all local network interfaces)")
    print("\n[*] TIP: On your mobile phone, open the URL in Chrome or Safari,")
    print("    then tap 'Add to Home Screen' to install it like a mobile app!")
    print("\n[*] Press Ctrl + C in this terminal to stop the server.\n")
    print("=" * 65)

    # Open browser automatically on PC
    try:
        webbrowser.open(f"http://localhost:{PORT}")
    except Exception as e:
        pass

    class ReusableThreadingServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    with ReusableThreadingServer((HOST, PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server. Goodbye!")
            sys.exit(0)

if __name__ == '__main__':
    run()
