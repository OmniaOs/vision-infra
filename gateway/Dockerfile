# Gateway LiteLLM con la config horneada (evita bind-mount de archivo, que
# Coolify convierte en directorio → IsADirectoryError).
FROM ghcr.io/berriai/litellm:main-latest
COPY litellm-config.yaml /app/config.yaml
CMD ["--config", "/app/config.yaml", "--port", "4000"]
