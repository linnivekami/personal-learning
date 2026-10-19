FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-impress fonts-noto-cjk fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home converter
COPY main.py .
USER converter
ENV PORT=8080
CMD ["sh","-c","uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
