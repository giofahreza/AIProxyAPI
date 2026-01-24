#!/bin/bash
set -e

# Configuration
SERVER_HOST="134.98.143.25"
SERVER_USER="ubuntu"
SSH_KEY="/root/oracle.key"
REMOTE_DIR="/home/ubuntu/AIProxyAPI"
SERVICE_NAME="aiproxyapi.service"
LOCAL_BINARY="aiproxyapi"

echo "🚀 Deploying to Oracle server ($SERVER_HOST)..."

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build binary locally
echo "🔨 Building binary locally..."
GOOS=linux GOARCH=amd64 go build -o "$LOCAL_BINARY" cmd/server/main.go

echo "📦 Copying binary to server..."
scp -i "$SSH_KEY" "$LOCAL_BINARY" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/aiproxyapi.new"

# SSH into server and deploy
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e

cd /home/ubuntu/AIProxyAPI

echo "📡 Updating git remote..."
git remote set-url giofahreza git@github.com:giofahreza/AIProxyAPI.git 2>/dev/null || git remote add giofahreza git@github.com:giofahreza/AIProxyAPI.git

echo "📥 Pulling latest code..."
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no" git fetch giofahreza
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no" git pull giofahreza main

echo "🔄 Replacing binary..."
# Backup current binary
if [ -f aiproxyapi ]; then
    cp aiproxyapi aiproxyapi.backup.$(date +%Y%m%d_%H%M%S)
fi

# Replace with new binary
mv aiproxyapi.new aiproxyapi
chmod +x aiproxyapi

echo "🔄 Restarting service..."
sudo systemctl restart aiproxyapi.service

echo "⏳ Waiting for service to start..."
sleep 2

echo "✅ Checking service status..."
sudo systemctl status aiproxyapi.service --no-pager | head -15

ENDSSH

# Cleanup local binary
rm -f "$LOCAL_BINARY"

echo ""
echo "✅ Deployment complete!"
echo "🔗 Service should be running at http://$SERVER_HOST"
