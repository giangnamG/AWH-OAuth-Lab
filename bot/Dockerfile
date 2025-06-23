FROM mcr.microsoft.com/playwright/python:v1.52.0-jammy

# Đặt các biến môi trường
ENV PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY app.py .
COPY bot_oauth.py .

EXPOSE 8888

# pwuser (đã có sẵn trong image này):
USER pwuser

CMD ["python", "app.py"]