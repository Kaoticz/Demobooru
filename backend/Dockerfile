FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install the pinned dependencies only, not the project itself: the app runs
# in place from /app (compose bind-mounts the source over it), so there is no
# package to install. pip cannot consume [project.dependencies] directly, so
# extract them with stdlib tomllib and install from the generated list. The
# layer stays cached until pyproject.toml itself changes.
COPY pyproject.toml ./
RUN python -c 'import tomllib; deps = tomllib.load(open("pyproject.toml", "rb"))["project"]["dependencies"]; print("\n".join(deps))' > /tmp/deps.txt \
    && pip install --no-cache-dir -r /tmp/deps.txt

COPY . .

EXPOSE 8000

# Invoked through `sh` so the container never depends on the file's exec bit,
# which bind mounts (and some host platforms) may not preserve.
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/app"]
