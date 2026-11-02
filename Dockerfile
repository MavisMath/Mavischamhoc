# ============================================================
# Dockerfile for Padlet MathBoard & Dynamic Geometry System
# Multi-purpose container: Python Async Server + Web Whiteboard
# ============================================================
FROM python:3.11-slim

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt thư viện Python cho Collaborative Server & Gemini
RUN pip install --no-cache-dir \
    websockets \
    google-generativeai

# Sao chép mã nguồn dự án vào container
COPY . /app

# Mở các cổng mạng:
# 8080: Máy chủ Web phục vụ giao diện Padlet & React Geometry Dashboard
# 8765: WebSocket Collaborative Server cho bảng trắng thời gian thực
EXPOSE 8080 8765

# Biến môi trường mặc định
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV WS_PORT=8765

# Script khởi động đồng thời Collaborative WebSocket Server và Web HTTP Server
CMD python -c "\
import subprocess, sys;\
p1 = subprocess.Popen([sys.executable, 'collaborative_server.py']);\
p2 = subprocess.Popen([sys.executable, '-m', 'http.server', '8080']);\
p1.wait(); p2.wait()"
