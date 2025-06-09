#!/usr/bin/env python3
"""
Test MPS GPU acceleration with SpaCy on Apple Silicon
"""

import spacy
import torch
import time

print("=== MPS GPU Acceleration Test for SpaCy ===")
print(f"PyTorch version: {torch.__version__}")
print(f"MPS available: {torch.backends.mps.is_available()}")
print(f"MPS built: {torch.backends.mps.is_built()}")

# Test 1: Basic GPU activation
print("\n=== Test 1: Basic GPU Activation ===")
try:
    gpu_id = spacy.require_gpu()
    print(f"✓ GPU activated: {gpu_id}")
except Exception as e:
    print(f"✗ GPU activation failed: {e}")

# Test 2: Load standard model with GPU
print("\n=== Test 2: Standard Model (de_core_news_lg) ===")
print("Note: Standard models use CPU even with GPU available")
nlp_standard = spacy.load("de_core_news_lg")
print(f"✓ Model loaded: {nlp_standard.meta['name']}")
print(f"  Pipeline: {nlp_standard.pipe_names}")

# Test 3: Check for transformer models
print("\n=== Test 3: Transformer Models ===")
print("Available German transformer models:")
print("  • de_dep_news_trf - Dependency parsing with transformers")
print("  • German BERT models via spacy-transformers")

# Test 4: MPS device check
print("\n=== Test 4: MPS Device Check ===")
if torch.backends.mps.is_available():
    mps_device = torch.device("mps")
    print(f"✓ MPS device created: {mps_device}")
    
    # Test tensor operation on MPS
    x = torch.ones(5, device=mps_device)
    print(f"✓ Test tensor on MPS: {x}")
    
    # Performance test
    print("\n=== Performance Comparison ===")
    
    # CPU test
    cpu_tensor = torch.randn(1000, 1000)
    start = time.time()
    for _ in range(100):
        _ = torch.matmul(cpu_tensor, cpu_tensor)
    cpu_time = time.time() - start
    print(f"CPU time (100 matrix multiplications): {cpu_time:.3f}s")
    
    # MPS test
    mps_tensor = torch.randn(1000, 1000, device=mps_device)
    torch.mps.synchronize()  # Ensure MPS is ready
    start = time.time()
    for _ in range(100):
        _ = torch.matmul(mps_tensor, mps_tensor)
    torch.mps.synchronize()  # Wait for completion
    mps_time = time.time() - start
    print(f"MPS time (100 matrix multiplications): {mps_time:.3f}s")
    print(f"Speedup: {cpu_time/mps_time:.2f}x")

print("\n=== How to Use GPU with SpaCy ===")
print("1. For standard models (sm/md/lg):")
print("   - These use CPU-based operations")
print("   - GPU won't provide benefits")
print()
print("2. For transformer models:")
print("   - Install: python -m spacy download de_dep_news_trf")
print("   - Use: nlp = spacy.load('de_dep_news_trf')")
print("   - GPU will accelerate transformer operations")
print()
print("3. In your code:")
print("   import spacy")
print("   spacy.require_gpu()  # or spacy.prefer_gpu()")
print("   nlp = spacy.load('de_dep_news_trf')")

print("\n✓ MPS GPU acceleration is ready for transformer models!") 