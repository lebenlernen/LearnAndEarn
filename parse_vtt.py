#!/usr/bin/env python3
"""Parse VTT subtitle files and convert to transcript format"""

import re
import webvtt
from pathlib import Path

def parse_vtt_file(vtt_path):
    """Parse VTT file and extract transcript entries"""
    entries = []
    
    # Read the VTT file
    vtt = webvtt.read(vtt_path)
    
    for caption in vtt:
        # Extract clean text (remove tags and timestamps)
        text = re.sub(r'<[^>]+>', '', caption.text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        if text and text != ' ':  # Skip empty entries
            entries.append({
                'text': text,
                'start': caption.start_in_seconds,
                'duration': caption.end_in_seconds - caption.start_in_seconds
            })
    
    return entries

def parse_vtt_manual(vtt_path):
    """Manual VTT parser as fallback"""
    entries = []
    
    with open(vtt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split into blocks
    blocks = content.split('\n\n')
    
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) >= 2 and '-->' in lines[0]:
            # Parse timestamp
            timestamp_line = lines[0]
            match = re.match(r'(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})', timestamp_line)
            if match:
                start_str, end_str = match.groups()
                
                # Convert to seconds
                def time_to_seconds(time_str):
                    parts = time_str.split(':')
                    hours = int(parts[0])
                    minutes = int(parts[1])
                    seconds = float(parts[2])
                    return hours * 3600 + minutes * 60 + seconds
                
                start = time_to_seconds(start_str)
                end = time_to_seconds(end_str)
                
                # Extract text (join all lines after timestamp)
                text_lines = []
                for line in lines[1:]:
                    # Remove tags
                    clean_line = re.sub(r'<[^>]+>', '', line)
                    clean_line = clean_line.strip()
                    if clean_line and clean_line != ' ':
                        text_lines.append(clean_line)
                
                if text_lines:
                    text = ' '.join(text_lines)
                    entries.append({
                        'text': text,
                        'start': start,
                        'duration': end - start
                    })
    
    return entries

# Test with the downloaded file
if __name__ == "__main__":
    vtt_file = "Marijas legendärer Crashkurs Wortschatz B2+ [Video aus dem Archiv] Deutsch mit Marija [g3thGb6SaS0].de.vtt"
    
    try:
        # Try webvtt library first
        import webvtt
        entries = parse_vtt_file(vtt_file)
        print(f"Parsed with webvtt library: {len(entries)} entries")
    except:
        # Fallback to manual parser
        entries = parse_vtt_manual(vtt_file)
        print(f"Parsed manually: {len(entries)} entries")
    
    # Show first 5 entries
    print("\nFirst 5 entries:")
    for i, entry in enumerate(entries[:5]):
        print(f"{i+1}. [{entry['start']:.2f}s] {entry['text']}")