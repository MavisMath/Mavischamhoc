"""
Khởi động Padlet AI MathBoard Unified Server (Cổng 8080)
Phục vụ đồng thời Web giao diện, API khôi phục trạng thái & WebSocket đồng bộ thời gian thực.
"""
import subprocess
import sys

def main():
    print("==================================================")
    print("🚀 Đang khởi động hệ thống Padlet AI MathBoard...")
    print("🌐 Trang chủ & Bảng trắng: http://localhost:8080")
    print("🔄 WebSocket Sync Server:   ws://localhost:8080/ws")
    print("==================================================")

    p = subprocess.Popen([sys.executable, "collaborative_server.py"])

    try:
        p.wait()
    except KeyboardInterrupt:
        print("\nĐang dừng máy chủ...")
        p.terminate()

if __name__ == "__main__":
    main()
