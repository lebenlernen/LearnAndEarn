# LearnAndEarn Startup Guide

## Quick Start

### Option 1: Simple Start (Recommended)
```bash
./start-simple.sh
```
This starts only the Node.js server. SpaCy features (advanced vocabulary analysis) will use fallback methods.

### Option 2: Full Start (All Features)
```bash
./start-all.sh
```
This starts both Node.js and SpaCy API servers for full functionality.

## Manual Start

If you prefer to start services manually:

### 1. Start Node.js Server Only
```bash
npm start
```
The application will be available at http://localhost:3000

### 2. Start SpaCy API Server (Optional)
In a separate terminal:
```bash
# Activate Python virtual environment
source spacy_venv/bin/activate

# Start SpaCy API
python spacy_api_server.py
```
The SpaCy API will be available at http://localhost:8001

## Services Overview

- **Node.js Application** (Port 3000): Main web application
- **SpaCy API Server** (Port 8001): Natural language processing for advanced features
  - Vocabulary extraction
  - Cloze test generation
  - Sentence analysis

## Features Available Without SpaCy

All core features work without SpaCy:
- Video browsing and playback
- Transcript viewing
- Basic vocabulary learning
- Fill-in-the-blanks exercises (Lückentexte)
- Speech practice (Sprechübung)
- Progress tracking
- User profiles

## Troubleshooting

### Port Already in Use
If you see "Port 3000 is already in use":
```bash
# Kill the process on port 3000
kill -9 $(lsof -ti:3000)

# Then start again
./start-simple.sh
```

### SpaCy Model Not Found
The German language model will be downloaded automatically on first run. This may take a few minutes.

### Logs
When using start-all.sh, logs are saved in the `logs/` directory:
- `logs/node.log` - Node.js application logs
- `logs/spacy_api.log` - SpaCy API server logs

## Database Connection

Ensure PostgreSQL is running on port 3143 with:
- Database: jetzt
- User: odoo
- Password: odoo

Or set environment variables:
```bash
export DB_HOST=localhost
export DB_PORT=3143
export DB_DATABASE=jetzt
export DB_USER=odoo
export DB_PASSWORD=odoo
```