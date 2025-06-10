# Sprechübung (Speaking Practice) - Mobile User Guide

## How to Select Text for Practice on Smartphones

The "Sprechübung" feature allows you to practice speaking specific parts of sentences. Here's how it works on mobile devices:

### Text Selection Methods

#### Method 1: Direct Text Selection (Standard)
1. **Long press** on the first word you want to select
2. **Drag the selection handles** to include the desired phrase
3. The selected text will be highlighted in blue
4. A confirmation box shows: `Ausgewählt: "your selected text"`
5. Press "Audio abspielen" to hear only the selected part
6. Press "Sprechen beginnen" to practice only the selected part

#### Method 2: Touch Selection (iOS/Android)
- **iOS**: Long press, then drag the magnifying glass
- **Android**: Long press, then drag the selection markers

### Visual Feedback
- **Blue highlight**: Shows your current selection
- **Light blue background**: Indicates text is selected
- **Selection info box**: Confirms what you've selected

### Practice Options

1. **Full Sentence** (no selection)
   - Plays and practices the entire sentence
   
2. **Partial Selection**
   - Select any phrase or words
   - Only the selected part will be played and checked

### Button Functions
- **"Audio abspielen"**: Plays selected text (or full sentence if nothing selected)
- **"Langsam abspielen"**: Plays at slower speed for better understanding
- **"Sprechen beginnen"**: Starts microphone for dictation practice

### Tips for Mobile Users
1. **Zoom in** if text is too small: Pinch to zoom for easier selection
2. **Landscape mode**: Rotate phone for larger text display
3. **Clear selection**: Tap outside the text to deselect

### Troubleshooting
- **Can't select text?**: Ensure JavaScript is enabled
- **Selection not working?**: Try refreshing the page
- **Audio not playing?**: Check device volume and permissions

## Current Implementation

The mobile interface has been optimized with:
- Touch event support (`touchend` events)
- Selection change detection
- Visual feedback for selected text
- Larger touch targets for buttons
- Responsive font sizes