import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/PatientDataView.css';
import { cleanupVideoUrl } from '../utils/videoProcessor';



const PatientDataView = ({ patient, onContinueToAssessment, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [videoSegments, setVideoSegments] = useState([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videoErrors, setVideoErrors] = useState({});
  const [loadedVideos, setLoadedVideos] = useState({});
  const videosContainerRef = useRef(null);
  const videoUrlsRef = useRef([]);

  // Load video segments from patient data
  const loadVideoSegments = useCallback(async () => {
    if (!patient) return;
    
    setIsLoadingVideos(true);
    const segments = [];
    
    try {
      // Process video_npz array or view_attention data
      let videoPaths = [];
      
      // Check for video_npz array
      if (patient.video_npz && Array.isArray(patient.video_npz)) {
        videoPaths = patient.video_npz;
      }
      // Check for view_attention data (contains video information)
      else if (patient.view_attention) {
        // Extract unique video paths from view_attention
        const uniquePaths = new Set();
        Object.entries(patient.view_attention).forEach(([category, views]) => {
          if (Array.isArray(views)) {
            views.forEach(item => {
              if (item.fname) {
                uniquePaths.add(item.fname);
              }
            });
          }
        });
        videoPaths = Array.from(uniquePaths);
      }
      
      // Process each video path (limit to reasonable number)
      const maxVideos = videoPaths.length; // Remove limit to show all videos
      for (let i = 0; i < maxVideos; i++) {
        const videoPath = videoPaths[i];
        
        try {
          let videoUrl = '';
          let cleanPath = '';
          
          // Check if it's an NPZ file path
          if (videoPath && videoPath.endsWith('.npz')) {
            // Remove the /mnt/c/Users/Ontact/Desktop/EchoVerse_js/echopilot-ai/public/ prefix
            // and convert .npz to .mp4 to use existing MP4 files
            let cleanPath = videoPath;
            if (videoPath.includes('/mnt/c/Users/Ontact/Desktop/EchoVerse_js/echopilot-ai/public/')) {
              cleanPath = videoPath.replace('/mnt/c/Users/Ontact/Desktop/EchoVerse_js/echopilot-ai/public', '');
            }
            
            // Convert .npz extension to .mp4
            cleanPath = cleanPath.replace('.npz', '.mp4');
            
            // Use the MP4 path directly (no backend conversion needed)
            videoUrl = cleanPath;
            
          } else if (videoPath && videoPath.endsWith('.mp4')) {
            // Check if it's a full path or relative path
            if (videoPath.startsWith('/mnt/') || videoPath.startsWith('C:')) {
              // It's a full system path, extract just the filename
              const filename = videoPath.split('/').pop();
              videoUrl = `/videos/${filename}`;
            } else {
              // Use as is if it's already a relative path
              videoUrl = videoPath;
            }
          } else {
            // Fallback to demo video
            videoUrl = '/videos/2025_05_01/15201759/20241206/ORG-2-1.2.840.113619.2.391.20263.1733481481.178.1.512.dcm.mp4';
          }
          
          // Extract view information if available
          let viewInfo = {};
          if (patient.view_attention) {
            Object.entries(patient.view_attention).forEach(([category, views]) => {
              if (Array.isArray(views)) {
                const match = views.find(v => v.fname === videoPath);
                if (match) {
                  viewInfo = {
                    view_name: match.view_lbl || `View ${i + 1}`,
                    view_idx: match.view_idx,
                    weight: match.weight,
                    category
                  };
                }
              }
            });
          }
          
          const segment = {
            id: i,
            name: viewInfo.view_name || `Video ${i + 1}`,
            url: videoUrl,
            path: videoPath,
            category: viewInfo.category || 'general',
            weight: viewInfo.weight || 0,
            view_idx: viewInfo.view_idx || i
          };
          
          segments.push(segment);
          
          // Store URL for cleanup
          videoUrlsRef.current.push(videoUrl);
        } catch (err) {
          console.error(`  ❌ Error processing video ${i}:`, err);
          setVideoErrors(prev => ({ ...prev, [i]: err.message }));
        }
      }
      
      // If no videos found, create demo segments with available videos
      if (segments.length === 0) {
        const demoVideos = [
          '/videos/2025_05_01/15201759/20241206/ORG-2-1.2.840.113619.2.391.20263.1733481481.178.1.512.dcm.mp4',
          '/videos/2025_05_01/15201759/20241206/ORG-2-1.2.840.113619.2.391.20263.1733481489.180.1.512.dcm.mp4',
          '/videos/2025_05_01/15201759/20241206/ORG-2-1.2.840.113619.2.391.20263.1733481571.187.1.512.dcm.mp4',
          '/videos/2025_05_01/15201759/20241206/ORG-2-1.2.840.113619.2.391.20263.1733481575.188.1.512.dcm.mp4'
        ];
        
        for (let i = 0; i < Math.min(demoVideos.length, 8); i++) {
          const videoUrl = demoVideos[i % demoVideos.length];
          const demoSegment = {
            id: i,
            name: `Demo View ${i + 1}`,
            url: videoUrl,
            category: 'demo'
          };
          segments.push(demoSegment);
          videoUrlsRef.current.push(videoUrl);
        }
      }
      
      setVideoSegments(segments);
    } catch (err) {
      console.error('❌ Error loading video segments:', err);
    } finally {
      setIsLoadingVideos(false);
      setIsLoading(false);
    }
  }, [patient]);
  
  useEffect(() => {
    if (patient) {
      loadVideoSegments();
    } else {
      setIsLoading(false);
    }
    
    // Cleanup on unmount
    return () => {
      // Cleanup video URLs
      videoUrlsRef.current.forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          cleanupVideoUrl(url);
        }
      });
      videoUrlsRef.current = [];
    };
  }, [patient, loadVideoSegments]);

  const handleVideoError = useCallback((event, videoId) => {
    const videoElement = event.target;
    const videoSrc = videoElement.src;
    console.warn(`Video ${videoId} failed to load from: ${videoSrc}`);
    
    // Try fallback video if not already using it
    if (!videoSrc.includes('ORG-2-1.2.840.113619')) {
      videoElement.src = '/videos/2025_05_01/15201759/20241206/ORG-2-1.2.840.113619.2.391.20263.1733481481.178.1.512.dcm.mp4';
    } else {
      // If even fallback fails, mark as error
      setVideoErrors(prev => ({ ...prev, [videoId]: 'Video unavailable' }));
    }
  }, []);

  const handleVideoLoad = useCallback((videoId) => {
    setLoadedVideos(prev => ({ ...prev, [videoId]: true }));
    // Clear any previous error for this video
    setVideoErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[videoId];
      return newErrors;
    });
  }, []);

  const handleBackClick = useCallback(() => {
    if (onBack) {
      onBack();
    }
  }, [onBack]);

  // Get category label for display
  const getCategoryLabel = useCallback((category) => {
    const labels = {
      aorta: 'Aorta View',
      av: 'Aortic Valve',
      mv: 'Mitral Valve',
      tv: 'Tricuspid Valve',
      pv: 'Pulmonary Valve',
      lv: 'Left Ventricle',
      rv: 'Right Ventricle',
      la: 'Left Atrium',
      ra: 'Right Atrium',
      demo: 'Demo View',
      general: 'General View'
    };
    return labels[category] || category;
  }, []);

  const handleContinueClick = useCallback(() => {
    if (onContinueToAssessment && patient) {
      onContinueToAssessment(patient);
    }
  }, [onContinueToAssessment, patient]);

  if (isLoading) {
    return (
      <div className="patient-data-view loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading patient data...</p>
        </div>
      </div>
    );
  }


  if (!patient) {
    return (
      <div className="patient-data-view error">
        <div className="error-message">
          <h2>No Patient Data</h2>
          <p>No patient data available to display.</p>
        </div>
      </div>
    );
  }

  // Simple direct access to patient data
  const comments_en = patient?.comments_en || '';
  const conclusion_en = patient?.conclusion_en || '';
  const exam_id = patient?.exam_id;
  const patientName = patient?.patient_name || patient?.name || 'Unknown Patient';
  const examDate = patient?.exam_date || patient?.date || '';

  // Extract patient info
  const extractPatientInfo = (examId) => {
    const parts = examId.split('__');
    return {
      id: parts[0] || examId,
      date: parts[1] || '',
      fullId: examId
    };
  };

  const patientInfo = extractPatientInfo(patient.exam_id);

  return (
    <div className="patient-data-view">
      {/* Top Header */}
      <div className="top-header">
        <div className="header-content">
          <div className="app-icon">
            <img src="/logo/logo.PNG" alt="Sonix Health Logo" className="logo-image" />
          </div>
          <span className="app-name">Sonix Health</span>
        </div>
      </div>

      {/* Patient Information Panel */}
      <div className="patient-info-container">
        <div className="patient-info-row">
          <div className="patient-info-card">
            <div className="patient-info-item">
              <span className="info-label">Patient ID:</span>
              <span className="info-value">{patientInfo.id || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Name:</span>
              <span className="info-value-bold">{patient.name || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Sex:</span>
              <span className="info-value">{patient.gender || patient.sex || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Age:</span>
              <span className="info-value">{patient.age || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Height:</span>
              <span className="info-value">{patient.height || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Weight:</span>
              <span className="info-value">{patient.weight || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">HR:</span>
              <span className="info-value">{patient.hr || patient.heart_rate || 'N/A'}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">BSA:</span>
              <span className="info-value">{patient.bsa || 'N/A'}</span>
            </div>
          </div>

          {/* Right side controls container */}
          <div className="right-controls-container">
            {/* Image Quality Dropdown */}
            <div className="dropdown-card">
              <span className="dropdown-label">Image Quality</span>
              <div className="dropdown-content">
                <span className="dropdown-value">Non-Diagnostic</span>
                <div className="dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="#FFFFFF" strokeWidth="2" fill="none"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Cardiac Rhythm Dropdown */}
            <div className="dropdown-card">
              <span className="dropdown-label">Cardiac Rhythm</span>
              <div className="dropdown-content">
                <span className="dropdown-value">Ventricular Premature Beat</span>
                <div className="dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="#FFFFFF" strokeWidth="2" fill="none"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* End Exam Button */}
            <div className="end-exam-button" onClick={onBack}>
              <span>End Exam</span>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="main-content">
        
        {/* Videos Area - Left 50% */}
        <div className="videos-area">
          <div className="section-header">
            <h2>Video Data</h2>
            <span className="video-count">{videoSegments.length} videos</span>
          </div>
          
          <div className="videos-container" ref={videosContainerRef}>
            {isLoadingVideos ? (
              <div className="videos-loading">
                <div className="spinner"></div>
                <p>Loading video segments...</p>
              </div>
            ) : (
              <div className="videos-grid">
                {videoSegments.map((video) => (
                  <div key={video.id} className="video-card">
                    <div className="video-wrapper">
                      <video
                        className="segment-video"
                        src={video.url}
                        muted
                        autoPlay
                        loop
                        playsInline
                        controls
                        onLoadedData={() => handleVideoLoad(video.id)}
                        onError={(e) => handleVideoError(e, video.id)}
                      />
                      {videoErrors[video.id] && (
                        <div className="video-error-overlay">
                          <span>⚠️ {videoErrors[video.id]}</span>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Clinical Notes Area - Right 50% */}
        <div className="clinical-notes-area">
          
          {/* Comments Section - Top 50% */}
          <div className="notes-section comments-section">
            <div className="section-header">
              <h2>Clinical Comments</h2>
            </div>
            <div className="notes-content">
              {comments_en ? (
                <div className="notes-text">
                  {comments_en}
                </div>
              ) : (
                <div className="notes-text empty-state">
                  <div className="empty-icon">💬</div>
                  <p>No clinical comments available.</p>
                  <p className="empty-subtitle">Clinical observations and notes will appear here.</p>
                </div>
              )}
            </div>
          </div>

          {/* Conclusion Section - Bottom 50% */}
          <div className="notes-section conclusion-section">
            <div className="section-header">
              <h2>Clinical Conclusion</h2>
            </div>
            <div className="notes-content">
              {conclusion_en ? (
                <div className="notes-text">
                  {conclusion_en}
                </div>
              ) : (
                <div className="notes-text empty-state">
                  <div className="empty-icon">📋</div>
                  <p>No clinical conclusion available.</p>
                  <p className="empty-subtitle">Final assessment and conclusions will appear here.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="page-footer">
        <button className="back-button" onClick={handleBackClick}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <button 
          className="continue-button"
          onClick={handleContinueClick}
          disabled={!patient}
        >
          Continue to Assessment
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="arrow-icon">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default PatientDataView;