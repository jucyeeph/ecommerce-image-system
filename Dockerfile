FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    EIS_DATA_DIR=/data \
    EIS_PORT=8080

WORKDIR /app

COPY app ./app
COPY prompts ./prompts
COPY specs ./specs
COPY docs ./docs

RUN mkdir -p /data

EXPOSE 8080

CMD ["python", "app/server.py"]
