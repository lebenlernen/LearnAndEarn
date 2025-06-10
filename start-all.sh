#!/bin/bash

# Start script for LearnAndEarn - All Services
# This script starts Node.js app, SpaCy API server, and monitors their status

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        print_warning "Killing process on port $port (PID: $pid)"
        kill -9 $pid
        sleep 1
    fi
}

# Check and create log directory
LOG_DIR="logs"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    print_status "Created log directory: $LOG_DIR"
fi

# Clean up function
cleanup() {
    print_warning "Shutting down services..."
    
    if [ ! -z "$NODE_PID" ]; then
        print_status "Stopping Node.js server (PID: $NODE_PID)..."
        kill $NODE_PID 2>/dev/null
    fi
    
    if [ ! -z "$SPACY_PID" ]; then
        print_status "Stopping SpaCy API server (PID: $SPACY_PID)..."
        kill $SPACY_PID 2>/dev/null
    fi
    
    # Kill any remaining processes on our ports
    kill_port 3000
    kill_port 8001
    
    print_status "Cleanup complete"
    exit 0
}

# Set up trap for clean exit
trap cleanup EXIT INT TERM

print_status "Starting LearnAndEarn services..."

# Check if ports are already in use
if check_port 3000; then
    print_warning "Port 3000 is already in use"
    read -p "Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 3000
    else
        print_error "Cannot start Node.js server - port 3000 is in use"
        exit 1
    fi
fi

if check_port 8001; then
    print_warning "Port 8001 is already in use"
    read -p "Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 8001
    else
        print_warning "SpaCy API server port is in use - continuing without SpaCy"
    fi
fi

# Start SpaCy API Server
print_status "Starting SpaCy API Server..."

# Check if virtual environment exists
if [ ! -d "spacy_venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv spacy_venv
fi

# Create SpaCy API starter script if it doesn't exist
if [ ! -f "spacy_api_server.py" ]; then
    print_warning "SpaCy API server not found. Creating a basic version..."
    cat > spacy_api_server.py << 'EOF'
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import spacy
import uvicorn
from typing import List, Dict, Any
import random

app = FastAPI(title="SpaCy API for LearnAndEarn")

# Load German language model
try:
    nlp = spacy.load("de_core_news_md")
    print("Loaded German language model successfully")
except:
    print("Warning: Could not load de_core_news_md model")
    nlp = None

class VideoRequest(BaseModel):
    video_id: str

class TextRequest(BaseModel):
    text: str
    video_id: str

@app.get("/")
async def root():
    return {"message": "SpaCy API Server is running", "model_loaded": nlp is not None}

@app.post("/process_video")
async def process_video(request: VideoRequest):
    # This is a placeholder - actual implementation would process video subtitles
    return {"status": "processed", "video_id": request.video_id}

@app.post("/extract_sentences")
async def extract_sentences(request: TextRequest):
    if not nlp:
        raise HTTPException(status_code=503, detail="SpaCy model not loaded")
    
    doc = nlp(request.text)
    sentences = [sent.text.strip() for sent in doc.sents]
    return {"sentences": sentences, "count": len(sentences)}

@app.get("/vocabulary/{video_id}")
async def get_vocabulary(video_id: str, limit: int = 50):
    # Placeholder vocabulary
    return {
        "vocabulary": [],
        "video_id": video_id,
        "count": 0
    }

@app.get("/cloze_tests/{video_id}")
async def get_cloze_tests(video_id: str, count: int = 5):
    # Generate simple cloze tests as fallback
    if not nlp:
        raise HTTPException(status_code=503, detail="SpaCy model not loaded")
    
    # This would normally fetch sentences from database
    sample_sentences = [
        "Der Mann geht in die Stadt.",
        "Sie liest ein interessantes Buch.",
        "Das Wetter ist heute sehr schön.",
        "Wir lernen Deutsch mit Videos.",
        "Die Kinder spielen im Garten."
    ]
    
    cloze_tests = []
    for i, sentence in enumerate(sample_sentences[:count]):
        doc = nlp(sentence)
        words = [token for token in doc if not token.is_punct and not token.is_space]
        if words:
            # Pick a random word to blank out
            target = random.choice(words)
            blanked = sentence.replace(target.text, "_____")
            cloze_tests.append({
                "sentence_id": i,
                "sentence": blanked,
                "cloze_word": target.text,
                "pos": target.pos_,
                "lemma": target.lemma_
            })
    
    return {"cloze_tests": cloze_tests, "count": len(cloze_tests)}

@app.get("/word_context/{video_id}/{word}")
async def get_word_context(video_id: str, word: str):
    return {
        "word": word,
        "contexts": [],
        "video_id": video_id
    }

@app.get("/similar_words/{word}")
async def get_similar_words(word: str, limit: int = 10):
    return {
        "word": word,
        "similar_words": []
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
EOF
fi

# Activate virtual environment and start SpaCy in background
(
    source spacy_venv/bin/activate 2>/dev/null || {
        print_error "Failed to activate Python virtual environment"
        exit 1
    }
    
    # Install basic requirements
    print_status "Installing Python requirements..."
    pip install fastapi uvicorn spacy pydantic > "$LOG_DIR/spacy_install.log" 2>&1
    
    # Try to download SpaCy model
    print_status "Checking SpaCy German model..."
    python -c "import spacy; spacy.load('de_core_news_md')" 2>/dev/null || {
        print_warning "German model not found, downloading (this may take a few minutes)..."
        python -m spacy download de_core_news_md > "$LOG_DIR/spacy_model_download.log" 2>&1 || {
            print_warning "Failed to download SpaCy model - continuing without it"
        }
    }
    
    # Start SpaCy API server
    print_status "Starting SpaCy API server on port 8001..."
    python spacy_api_server.py > "$LOG_DIR/spacy_api.log" 2>&1 &
    SPACY_PID=$!
    echo $SPACY_PID > "$LOG_DIR/spacy.pid"
) &

# Give SpaCy server time to start
sleep 3

# Check if SpaCy started successfully
if check_port 8001; then
    print_status "SpaCy API server started successfully"
else
    print_warning "SpaCy API server failed to start - continuing without it"
fi

# Start Node.js server
print_status "Starting Node.js server..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing Node.js dependencies..."
    npm install > "$LOG_DIR/npm_install.log" 2>&1
fi

# Start Node.js server
print_status "Starting Node.js application on port 3000..."
npm start > "$LOG_DIR/node.log" 2>&1 &
NODE_PID=$!
echo $NODE_PID > "$LOG_DIR/node.pid"

# Wait for Node.js to start
sleep 3

# Check if Node.js started successfully
if check_port 3000; then
    print_status "Node.js server started successfully"
else
    print_error "Node.js server failed to start"
    exit 1
fi

# Display status
echo
print_status "=========================================="
print_status "LearnAndEarn services are running!"
print_status "=========================================="
print_status "Node.js app: http://localhost:3000"
print_status "SpaCy API: http://localhost:8001"
print_status "Logs: $LOG_DIR/"
echo
print_status "Press Ctrl+C to stop all services"
echo

# Monitor services
while true; do
    # Check if Node.js is still running
    if ! kill -0 $NODE_PID 2>/dev/null; then
        print_error "Node.js server crashed! Restarting..."
        npm start > "$LOG_DIR/node.log" 2>&1 &
        NODE_PID=$!
        echo $NODE_PID > "$LOG_DIR/node.pid"
    fi
    
    # Check if SpaCy should be running and restart if needed
    if [ ! -z "$SPACY_PID" ] && ! kill -0 $SPACY_PID 2>/dev/null; then
        print_warning "SpaCy API server crashed! Restarting..."
        (
            source spacy_venv/bin/activate 2>/dev/null
            python spacy_api_server.py > "$LOG_DIR/spacy_api.log" 2>&1 &
            SPACY_PID=$!
            echo $SPACY_PID > "$LOG_DIR/spacy.pid"
        )
    fi
    
    sleep 5
done