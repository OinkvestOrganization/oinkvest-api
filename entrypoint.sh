#!/bin/sh
set -e

# If the first argument is 'start', then run migrations and start the app
if [ "$1" = "start" ]; then
  if [ "$NODE_ENV" = "production" ]; then
    echo "Running Production Database Migrations..."
    npm run db:deploy

    echo "Generating Prisma Client..."
    npm run prisma:generate

    echo "Starting application in production mode..."
    exec npm run start:prod
  else
    echo "Running Development Database Migrations..."
    npm run db:migrate

    echo "Generating Prisma Client..."
    npm run prisma:generate

    echo "Starting application in development mode..."
    exec npm run start:dev
  fi
else
  # Otherwise, execute the command passed to the script
  exec "$@"
fi
