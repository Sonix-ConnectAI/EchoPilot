/**
 * Enhanced video processing utilities for NPZ file display
 */

const BACKEND_URL = 'http://localhost:5000';

// Get video path from exam data
export const getVideoPathFromExam = (examData) => {
  // Return NPZ path if available, fallback to MP4
  if (examData?.npz_path) {
    return examData.npz_path;
  }
  return "/videos/26409027(1).dcm.mp4";
};

// Method 1: Video Frames Sequence (Recommended for smooth playback)
export const npzToVideoFrames = async (npzPath, options = {}) => {
  try {
    console.log('🎬 Getting video frames for:', npzPath);
    
    const requestBody = {
      path: npzPath,
      options: {
        format: 'video_frames',
        fps: options.fps || 20,
        max_frames: options.maxFrames || 30,
        resize: options.resize || [224, 224],
        quality: options.quality || 85,
        denoise: options.denoise || null,
        contrast: options.contrast || 1.0,
        brightness: options.brightness || 0.0,
        ...options
      }
    };

    const response = await fetch(`${BACKEND_URL}/api/preprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Video frames received:', data.video_info);
    
    return {
      frames: data.frames,
      videoInfo: data.video_info,
      playbackInfo: data.playback_info,
      frameTimings: data.frame_timings
    };
  } catch (error) {
    console.error('❌ Error getting video frames:', error);
    throw error;
  }
};

// Method 2: MP4 Blob (For traditional video element)
export const npzToVideoBlob = async (npzPath, options = {}) => {
  try {
    console.log('🎬 Getting video blob for:', npzPath);
    
    const requestBody = {
      path: npzPath,
      options: {
        format: 'mp4_blob',
        fps: options.fps || 20,
        max_frames: options.maxFrames || 50,
        resize: options.resize || [224, 224],
        ...options
      }
    };

    const response = await fetch(`${BACKEND_URL}/api/preprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Video blob received');
    
    return data.video_blob;
  } catch (error) {
    console.error('❌ Error getting video blob:', error);
    throw error;
  }
};

// Method 3: Real-time Stream URL (For live streaming)
export const npzToStreamUrl = (npzPath, options = {}) => {
  const params = new URLSearchParams({
    path: npzPath,
    fps: options.fps || 20,
    quality: options.quality || 85,
    ...(options.resize && { resize: `${options.resize[0]}x${options.resize[1]}` })
  });
  
  return `${BACKEND_URL}/api/stream-video?${params}`;
};

// Enhanced npzToVideoUrl with multiple methods support
export const npzToVideoUrl = async (videoPath, method = 'frames', options = {}) => {
  try {

    // If it's already an MP4 path, return directly
    if (videoPath.endsWith('.mp4')) {
      return videoPath;
    }
    
    switch (method) {
      case 'frames':
        const frameData = await npzToVideoFrames(videoPath, options);
        return frameData; // Returns frame sequence data
      
      case 'blob':
        return await npzToVideoBlob(videoPath, options);
      
      case 'stream':
        return npzToStreamUrl(videoPath, options);
      
      default:
        // Fallback to frames method
        return await npzToVideoFrames(videoPath, options);
    }
    
  } catch (error) {
    console.error('❌ Error getting video URL:', error);
    // Fallback to default MP4
    return "/videos/26409027(1).dcm.mp4";
  }
};

// Frame-based video player utility
export class FramePlayer {
  constructor(containerElement, frames, options = {}) {
    this.container = containerElement;
    this.frames = frames;
    this.options = {
      fps: 20,
      loop: true,
      autoplay: true,
      ...options
    };
    
    this.currentFrame = 0;
    this.isPlaying = false;
    this.intervalId = null;
    
    this.init();
  }
  
  init() {
    this.img = document.createElement('img');
    this.img.style.width = '100%';
    this.img.style.height = '100%';
    this.img.style.objectFit = 'contain';
    this.container.appendChild(this.img);
    
    if (this.frames.length > 0) {
      this.img.src = this.frames[0];
    }
    
    if (this.options.autoplay) {
      this.play();
    }
  }
  
  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    const interval = 1000 / this.options.fps;
    
    this.intervalId = setInterval(() => {
      this.nextFrame();
    }, interval);
  }
  
  pause() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  nextFrame() {
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    if (this.currentFrame === 0 && !this.options.loop) {
      this.pause();
      return;
    }
    this.img.src = this.frames[this.currentFrame];
  }
  
  seekToFrame(frameIndex) {
    if (frameIndex >= 0 && frameIndex < this.frames.length) {
      this.currentFrame = frameIndex;
      this.img.src = this.frames[this.currentFrame];
    }
  }
  
  destroy() {
    this.pause();
    if (this.img && this.img.parentNode) {
      this.img.parentNode.removeChild(this.img);
    }
  }
}

// Clean up video URL (enhanced cleanup)
export const cleanupVideoUrl = (url) => {
  console.log('🧹 Cleanup called for:', url);
  
  // If it's a blob URL, revoke it
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
  
  // If it's frame data with blob URLs, clean them up
  if (typeof url === 'object' && url.frames) {
    url.frames.forEach(frameUrl => {
      if (frameUrl.startsWith('blob:')) {
        URL.revokeObjectURL(frameUrl);
      }
    });
  }
};