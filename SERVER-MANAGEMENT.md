# LearnAndEarn Server Management Guide

## Overview
This guide covers managing the LearnAndEarn Node.js and SpaCy servers on macOS, including automatic startup and restart capabilities.

## Server Components

### 1. Node.js Server (Port 3000)
- Main application server
- Handles web interface, API routes, and database connections
- Configuration: `app.js`

### 2. SpaCy YouTube API Server (Port 8001)
- NLP processing and YouTube transcript extraction
- Handles text analysis and video import
- Configuration: `spacy_api_server_youtube.py`

## Installation Methods

### Method 1: LaunchD Services (Recommended for Production)
This method ensures servers start automatically at login and restart if they crash.

#### Install Services
```bash
cd /Users/thomassee/Docker/containers/LearnAndEarn
./install-services.sh
```

#### Check Service Status
```bash
launchctl list | grep learnandearn
```

#### View Logs
```bash
# Node.js logs
tail -f logs/node.log
tail -f logs/node-error.log

# SpaCy logs
tail -f logs/spacy.log
tail -f logs/spacy-error.log
```

#### Stop Services
```bash
launchctl unload ~/Library/LaunchAgents/com.learnandearn.node.plist
launchctl unload ~/Library/LaunchAgents/com.learnandearn.spacy.plist
```

#### Start Services
```bash
launchctl load ~/Library/LaunchAgents/com.learnandearn.node.plist
launchctl load ~/Library/LaunchAgents/com.learnandearn.spacy.plist
```

#### Uninstall Services
```bash
# First unload the services
launchctl unload ~/Library/LaunchAgents/com.learnandearn.node.plist
launchctl unload ~/Library/LaunchAgents/com.learnandearn.spacy.plist

# Then remove the plist files
rm ~/Library/LaunchAgents/com.learnandearn.*.plist
```

### Method 2: PM2 Process Manager (Alternative)
PM2 provides advanced process management with monitoring capabilities.

#### Install PM2
```bash
npm install -g pm2
```

#### Start Services with PM2
```bash
cd /Users/thomassee/Docker/containers/LearnAndEarn
pm2 start ecosystem.config.js
```

#### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs learnandearn-node
pm2 logs learnandearn-spacy

# Stop services
pm2 stop all

# Restart services
pm2 restart all

# Save configuration for startup
pm2 save
pm2 startup
```

### Method 3: Manual Start (Development)
For development and testing purposes.

#### Start Both Servers
```bash
cd /Users/thomassee/Docker/containers/LearnAndEarn

# Terminal 1: Node.js server
npm start

# Terminal 2: SpaCy server
source spacy_venv/bin/activate
python spacy_api_server_youtube.py
```

#### Using the Shell Scripts
```bash
# Start all services
./start-all.sh

# Start SpaCy YouTube server only
./start_spacy_youtube.sh
```

### Method 4: Docker Compose (Container-based)
For containerized deployment.

#### Build and Start
```bash
docker-compose up -d
```

#### View Logs
```bash
docker-compose logs -f learnandearn-node
docker-compose logs -f spacy
```

#### Stop Services
```bash
docker-compose down
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Find process using port 8001
lsof -i :8001

# Kill process by PID
kill -9 <PID>
```

### SpaCy Virtual Environment Issues
```bash
# Recreate virtual environment
rm -rf spacy_venv
python3 -m venv spacy_venv
source spacy_venv/bin/activate
pip install -r requirements_spacy.txt
pip install -r requirements_youtube.txt
python -m spacy download de_core_news_md
```

### Database Connection Issues
- Verify PostgreSQL is running on port 3143
- Check credentials in environment variables
- Test connection: `psql -h localhost -p 3143 -U odoo -d jetzt`

### LaunchD Service Not Starting
1. Check plist syntax:
   ```bash
   plutil ~/Library/LaunchAgents/com.learnandearn.node.plist
   ```

2. Check console logs:
   ```bash
   log show --predicate 'process == "launchd"' --last 5m | grep learnandearn
   ```

3. Verify paths in plist files are correct

## Health Checks

### Quick Health Check Script
```bash
#!/bin/bash
echo "Checking LearnAndEarn services..."

# Check Node.js server
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Node.js server is running"
else
    echo "❌ Node.js server is not responding"
fi

# Check SpaCy server
if curl -s http://localhost:8001/health > /dev/null; then
    echo "✅ SpaCy server is running"
else
    echo "❌ SpaCy server is not responding"
fi

# Check PostgreSQL
if pg_isready -h localhost -p 3143 > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not responding"
fi
```

## Monitoring

### Simple Monitoring with LaunchD
The LaunchD configuration includes:
- Automatic restart on crash (KeepAlive)
- 10-second throttle to prevent rapid restart loops
- Separate log files for stdout and stderr

### Log Rotation
Add to `/etc/newsyslog.conf`:
```
/Users/thomassee/Docker/containers/LearnAndEarn/logs/*.log    644  5  1000  *  J
```

This rotates logs when they reach 1MB, keeping 5 compressed copies.

## Best Practices

1. **Production Deployment**: Use LaunchD services for automatic management
2. **Development**: Use manual start or PM2 for flexibility
3. **Monitoring**: Regularly check logs for errors
4. **Updates**: Stop services before updating code, then restart
5. **Backup**: Keep database backups before major updates

## Environment Variables

Both servers use these environment variables:
- `DB_HOST`: localhost
- `DB_PORT`: 3143
- `DB_DATABASE` / `DB_NAME`: jetzt
- `DB_USER`: odoo
- `DB_PASSWORD`: odoo
- `NODE_ENV`: production (Node.js only)
- `PORT`: 3000 (Node.js only)