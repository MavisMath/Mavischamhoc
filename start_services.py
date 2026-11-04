"""
Khởi động đồng thời:
1. Máy chủ Web HTTP phục vụ bảng trắng Padlet (Cổng 8080)
2. WebSocket Collaboration Server đồng bộ thời gian thực (Cổng 8765)
"""
import subprocess
import sys
import time

def main():
    print("==================================================")
    print("🚀 Đang khởi động hệ thống Padlet AI MathBoard...")
    print("🌐 Trang chủ (Google Docs Hub): http://localhost:8080")
    print("🔄 WebSocket Sync Server:       ws://localhost:8765")
    print("==================================================")

    # Khởi động WebSocket Server
    p_ws = subprocess.Popen([sys.executable, "collaborative_server.py"])
    time.sleep(0.5)

    # Khởi động HTTP Web Server (Threaded để phục vụ mượt mà nhiều client)
    p_http = subprocess.Popen([sys.executable, "scripts/run_http_server.py"])

    try:
        p_ws.wait()
        p_http.wait()
    except KeyboardInterrupt:
        print("\nĐang dừng các dịch vụ...")
        p_ws.terminate()
        p_http.terminate()

if __name__ == "__main__":
    main()
