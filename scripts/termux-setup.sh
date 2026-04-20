#!/data/data/com.termux/files/usr/bin/bash

# Quantum Credentials Vault - Termux Auto-Setup Script
# ====================================================

echo "Starting Quantum Vault Initialization..."
pkg update -y && pkg upgrade -y
pkg install nodejs git postgresql build-essential python -y

echo "Initializing local database..."
mkdir -p ~/pgsql
initdb ~/pgsql
pg_ctl -D ~/pgsql start
createuser --superuser qcv_admin
createdb -O qcv_admin qcv

echo "Cloning Repository (Requires user input if private)..."
read -p "Enter GitHub Repo URL (or press enter to init locally): " REPO_URL

if [ -z "$REPO_URL" ]; then
  mkdir -p ~/qcv && cd ~/qcv
  git init
else
  git clone $REPO_URL ~/qcv && cd ~/qcv
fi

echo "Installing Dependencies..."
npm install

echo "Writing Environment Variables..."
cat << 'EOF' > .env
DATABASE_URL="postgresql://qcv_admin@localhost:5432/qcv"
JWT_SECRET="$(openssl rand -hex 32)"
EOF

echo "Generating Prisma Client..."
npx prisma db push
npx prisma generate

echo "Building Application..."
npm run build

echo "Setup Complete! To start the server, run:"
echo "cd ~/qcv && npm run start"
