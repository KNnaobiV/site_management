#!/bin/sh
set -e 

echo "Waiting for postgres..."
unitl pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
    sleep 1
done 

echo "Postgres is ready"

python manage.py collectstatic --noinput

echo "Running migrations..."
python manage.py migrate --noinput

echo "Starting Gunicorn..."

exec "$@"