#!/bin/bash

# Development setup script for Picksy API Gateway

echo "Setting up Picksy API Gateway for development..."

# Create logs directory
mkdir -p logs

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file with your configuration before starting the server"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database and Redis configuration"
echo "2. Set up PostgreSQL database and run: psql -U postgres -d picksy -f src/database/schema.sql"
echo "3. Start Redis server"
echo "4. Run 'npm run dev' to start the development server"