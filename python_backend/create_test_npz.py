#!/usr/bin/env python3
"""
Create a test NPZ file with sample video frames for testing
"""

import numpy as np
import cv2
import os

def create_test_npz():
    """Create a test NPZ file with synthetic echocardiography-like frames"""
    
    # Create synthetic frames (30 frames, 200x200, grayscale)
    num_frames = 30
    height, width = 200, 200
    
    frames = []
    
    for i in range(num_frames):
        # Create a frame with a moving circle (simulating heart movement)
        frame = np.zeros((height, width), dtype=np.uint8)
        
        # Background noise
        noise = np.random.normal(50, 20, (height, width))
        frame = np.clip(noise, 0, 255).astype(np.uint8)
        
        # Moving circle (simulating heart chamber)
        center_x = width // 2 + int(10 * np.sin(i * 0.3))
        center_y = height // 2 + int(5 * np.cos(i * 0.3))
        radius = 30 + int(10 * np.sin(i * 0.4))
        
        cv2.circle(frame, (center_x, center_y), radius, 150, -1)
        
        # Inner circle (simulating inner chamber)
        inner_radius = max(5, radius - 15)
        cv2.circle(frame, (center_x, center_y), inner_radius, 80, -1)
        
        # Add some texture lines
        for j in range(5):
            x1 = np.random.randint(0, width)
            y1 = np.random.randint(0, height)
            x2 = np.random.randint(0, width)
            y2 = np.random.randint(0, height)
            cv2.line(frame, (x1, y1), (x2, y2), 200, 1)
        
        frames.append(frame)
    
    # Convert to numpy array
    frames_array = np.array(frames)
    print(f"Created frames array with shape: {frames_array.shape}")
    
    # Create test directory structure
    test_dir = "../26409027/2020-07-14"
    os.makedirs(test_dir, exist_ok=True)
    
    # Save as NPZ file
    npz_path = os.path.join(test_dir, "26409027(5).dcm.npz")
    np.savez_compressed(npz_path, frames=frames_array)
    
    print(f"Test NPZ file created: {npz_path}")
    print(f"Absolute path: {os.path.abspath(npz_path)}")
    
    return os.path.abspath(npz_path)

if __name__ == "__main__":
    test_path = create_test_npz()
    
    # Verify the file
    with np.load(test_path) as data:
        print(f"NPZ file contains keys: {list(data.keys())}")
        frames = data['frames']
        print(f"Frames shape: {frames.shape}")
        print(f"Frames dtype: {frames.dtype}")
        print(f"Frames min/max: {frames.min()}/{frames.max()}")