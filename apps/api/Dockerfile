FROM python:3.12-slim
WORKDIR /app
COPY packages /app/packages
COPY services /app/services
COPY config /app/config
COPY apps/api /app/apps/api
RUN pip install --no-cache-dir /app/packages/aqi-core -r /app/apps/api/requirements.txt
ENV PYTHONPATH=/app/packages/schemas/src:/app
CMD ["uvicorn", "apps.api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
