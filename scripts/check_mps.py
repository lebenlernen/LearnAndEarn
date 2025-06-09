#!/usr/bin/env python3
"""
Check PyTorch and MPS (Metal Performance Shaders) availability
"""

print("=== Checking PyTorch and MPS Support ===")

try:
    import torch
    print(f"✓ PyTorch version: {torch.__version__}")
    print(f"✓ MPS available: {torch.backends.mps.is_available()}")
    print(f"✓ MPS built: {torch.backends.mps.is_built()}")
    
    if torch.backends.mps.is_available():
        print("\n✓ MPS GPU acceleration is available!")
        print("  You can use GPU acceleration with transformer models")
    else:
        print("\n✗ MPS is not available on this system")
        
except ImportError:
    print("✗ PyTorch is NOT installed")
    print("\nTo enable GPU acceleration for transformer models, install PyTorch:")
    print("pip install torch torchvision torchaudio")

print("\n=== Checking spacy-transformers ===")
try:
    import spacy_transformers
    print(f"✓ spacy-transformers version: {spacy_transformers.__version__}")
except ImportError:
    print("✗ spacy-transformers is NOT installed")
    print("To use transformer models, install:")
    print("pip install spacy-transformers")

print("\n=== Current SpaCy GPU Status ===")
import spacy
try:
    gpu_available = spacy.require_gpu()
    print(f"✓ GPU required and available: {gpu_available}")
except Exception as e:
    print(f"✗ GPU not available: {e}") 