# IONOS VPS Deployment Guide (Ubuntu)

## 1. Initial Setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm nginx postgresql git curl -y
sudo npm install -g pm2
```

## 2. Database Setup
```bash
sudo -u postgres psql
CREATE DATABASE qcv;
CREATE USER qcv_user WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE qcv TO qcv_user;
\q
```

## 3. App Deployment
```bash
git clone <your-repo> /var/www/qcv
cd /var/www/qcv
npm install

# Setup env
cat << 'EOF' > .env
DATABASE_URL="postgresql://qcv_user:strong_password_here@localhost:5432/qcv"
JWT_SECRET="generate_a_secure_random_string_here"
NODE_ENV="production"
EOF

# Build & Prisma
npx prisma db push
npx prisma generate
npm run build

# Start with PM2
pm2 start dist/server.cjs --name "qcv-backend"
pm2 save
pm2 startup
```

## 4. NGINX Reverse Proxy
Create `/etc/nginx/sites-available/qcv`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/qcv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. SSL with Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```
