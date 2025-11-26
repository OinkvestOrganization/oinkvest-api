#!/bin/sh
set -e

# If the first argument is 'start', then run migrations and start the app
if [ "$1" = "start" ]; then
  echo "Running Database Migrations..."
  npm run db:migrate

  echo "Generating Prisma Client..."
  npm run prisma:generate

  echo "Starting application..."
  exec npm run start:dev
else
  # Otherwise, execute the command passed to the script
  exec "$@"
fi
