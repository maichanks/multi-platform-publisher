#!/bin/sh
set -e

# Wait for PostgreSQL to be ready
host="$1"
shift
cmd="$@"

until nc -z "$host" 5432; do
  echo "Waiting for PostgreSQL at $host:5432..."
  sleep 1
done

echo "PostgreSQL is up - executing command"

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Execute the main command
exec $cmd
