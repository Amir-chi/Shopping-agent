FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && groupadd --system app && useradd --system --create-home --gid app app
COPY --chown=app:app manage.py server.py gunicorn.conf.py ./
COPY --chown=app:app nazdika ./nazdika
COPY --chown=app:app catalog ./catalog
COPY --chown=app:app index.html ui.css catalog.js shopping.js reviews.js seller.js market-guide.json sw.js manifest.webmanifest ./
COPY --chown=app:app assets ./assets
COPY --chown=app:app docker ./docker
RUN mkdir /app/staticfiles && chown app:app /app/staticfiles
USER app
EXPOSE 8000
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
CMD ["gunicorn", "--config", "gunicorn.conf.py", "nazdika.wsgi:application"]
