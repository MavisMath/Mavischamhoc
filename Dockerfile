# ============================================================
# Dockerfile for Padlet MathBoard & Dynamic Geometry System
# Unified Single-Port Architecture: aiohttp Web + WebSockets + REST
# ============================================================
FROM python:3.11-slim

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt thư viện Python từ requirements.txt
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Sao chép toàn bộ mã nguồn vào container
COPY . /app

# Cổng mạng phục vụ dịch vụ duy nhất (Mặc định 8080 hoặc do Render cấp qua $PORT)
EXPOSE 8080

# Biến môi trường
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Chạy máy chủ hợp nhất (phục vụ đồng thời Static files, REST API & WebSocket /ws)
CMD ["python", "collaborative_server.py"]
