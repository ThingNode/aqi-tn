FROM python:3.12-slim
WORKDIR /app
COPY services/simulator /app/services/simulator
COPY config /app/config
RUN pip install --no-cache-dir /app/services/simulator
ENV STATION_REGISTRY=/app/config/stations.yaml
CMD ["aqi-simulator"]

