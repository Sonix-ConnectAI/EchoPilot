import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { npzToVideoUrl, cleanupVideoUrl } from '../utils/videoProcessor';

const HoverableText = ({ text, examData }) => {
  console.log('🚀 HoverableText component called with:', { text, examData });
  
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [currentTerm, setCurrentTerm] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [videoState, setVideoState] = useState({
    videoUrl: null,
    loading: false,
    error: null,
    dimensions: { width: 0, height: 0 }
  });
  
  const videoRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);
  const currentTermElementRef = useRef(null);
  const isMouseOverTooltipRef = useRef(false);
  const isPausedRef = useRef(false);

  // Essential cardiac terms only (commonly used in AI reports)
  const cardiacTerms = {
    // Chambers
    "LV": {
      title: "Left Ventricle",
      content: {
        "Description": "Main pumping chamber of the heart",
        "Function": "Pumps oxygenated blood to the body",
        "Normal size": "LVEDD: 42-58mm (M), 37-52mm (F)",
        "Assessment": "Systolic & diastolic function, wall motion"
      }
    },
    "LA": {
      title: "Left Atrium",
      content: {
        "Description": "Upper left chamber of the heart",
        "Function": "Receives oxygenated blood from lungs",
        "Normal volume": "22±6 mL/m² (biplane method)",
        "Clinical significance": "Enlargement indicates diastolic dysfunction"
      }
    },
    "RV": {
      title: "Right Ventricle",
      content: {
        "Description": "Pumps blood to the lungs",
        "Normal size": "Base: 25-41mm, Mid: 19-35mm",
        "Function assessment": "TAPSE, S', FAC",
        "Clinical significance": "Enlargement in pulmonary HTN"
      }
    },
    "RA": {
      title: "Right Atrium",
      content: {
        "Description": "Upper right chamber",
        "Function": "Receives deoxygenated blood from body",
        "Normal area": "<18 cm²",
        "Assessment": "Size, IVC diameter"
      }
    },
    // Valves
    "MV": {
      title: "Mitral Valve",
      content: {
        "Location": "Between LA and LV",
        "Structure": "Bileaflet (anterior & posterior)",
        "Function": "Prevents backflow during systole",
        "Assessment": "Stenosis, regurgitation, prolapse"
      }
    },
    "AV": {
      title: "Aortic Valve",
      content: {
        "Location": "Between LV and aorta",
        "Structure": "Trileaflet (normally)",
        "Function": "Prevents backflow during diastole",
        "Assessment": "AS, AR, bicuspid morphology"
      }
    },
    "TV": {
      title: "Tricuspid Valve",
      content: {
        "Location": "Between RA and RV",
        "Structure": "Three leaflets",
        "Function": "Prevents backflow to RA",
        "Clinical": "TR velocity estimates RVSP"
      }
    },
    "PV": {
      title: "Pulmonary Valve",
      content: {
        "Location": "Between RV and PA",
        "Structure": "Three semilunar cusps",
        "Function": "Prevents backflow from PA",
        "Assessment": "PS, PR, velocity"
      }
    },
    // Key measurements
    "LVEF": {
      title: "Left Ventricular Ejection Fraction",
      content: {
        "Definition": "% of blood pumped out",
        "Normal": ">52% (M), >54% (F)",
        "Methods": "Simpson's, visual, 3D",
        "Classification": "Normal, mild, moderate, severe"
      }
    },
    "E/A": {
      title: "E/A Ratio",
      content: {
        "Description": "Mitral inflow pattern",
        "E wave": "Early diastolic filling",
        "A wave": "Atrial contraction",
        "Normal": "0.8-2.0 (age dependent)"
      }
    },
    "E/e'": {
      title: "E/e' Ratio",
      content: {
        "Description": "LV filling pressure estimate",
        "Normal": "<8 (low LAP)",
        "Gray zone": "8-14",
        "Elevated": ">14 (high LAP)"
      }
    },
    // Common pathologies
    "TR": {
      title: "Tricuspid Regurgitation",
      content: {
        "Grading": "Trivial, mild, moderate, severe",
        "Velocity": "Estimates RVSP",
        "Causes": "Functional, rheumatic, endocarditis",
        "Assessment": "Color jet, vena contracta, PISA"
      }
    },
    "MR": {
      title: "Mitral Regurgitation",
      content: {
        "Mechanism": "Primary vs secondary",
        "Grading": "Mild, moderate, severe",
        "Quantification": "PISA, vena contracta, regurgitant volume",
        "Clinical impact": "LA enlargement, pulmonary HTN"
      }
    },
    "AS": {
      title: "Aortic Stenosis",
      content: {
        "Severity": "Mean gradient, AVA, velocity",
        "Mild": "Vmax 2-3 m/s",
        "Moderate": "Vmax 3-4 m/s",
        "Severe": "Vmax >4 m/s, AVA <1 cm²"
      }
    },
    "AR": {
      title: "Aortic Regurgitation",
      content: {
        "Grading": "Mild, moderate, severe",
        "PHT": "<500ms suggests severe",
        "Jet width": ">65% LVOT = severe",
        "Impact": "LV dilatation, dysfunction"
      }
    }
  };

  // Parse text to find cardiac terms
  const parseText = (text) => {
    if (!text) return [];
    
    const segments = [];
    const termPattern = new RegExp(
      `\\b(${Object.keys(cardiacTerms).join('|')})\\b`,
      'gi'
    );
    
    const lines = text.split('\n');
    
    lines.forEach((line) => {
      let lineSegments = [];
      let lastIndex = 0;
      let match;
      
      termPattern.lastIndex = 0;
      
      while ((match = termPattern.exec(line)) !== null) {
        if (match.index > lastIndex) {
          lineSegments.push({
            type: 'normal',
            content: line.substring(lastIndex, match.index)
          });
        }
        
        const termKey = match[1].toUpperCase();
        lineSegments.push({
          type: 'cardiac-term',
          content: match[0],
          term: termKey,
          data: cardiacTerms[termKey]
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < line.length) {
        lineSegments.push({
          type: 'normal',
          content: line.substring(lastIndex)
        });
      }
      
      if (lineSegments.length === 0) {
        lineSegments.push({
          type: 'normal',
          content: line
        });
      }
      
      segments.push(...lineSegments, { type: 'linebreak' });
    });
    
    if (segments.length > 0 && segments[segments.length - 1].type === 'linebreak') {
      segments.pop();
    }
    
    return segments;
  };

  // Load video function - now uses examData
  const loadVideo = async () => {
    try {
      console.log('🔄 Starting video load for exam:', examData.exam_id);
      setVideoState(prev => ({ ...prev, loading: true, error: null }));
      
      // Use examData to get appropriate video path
      let videoPath = "/videos/26409027(1).dcm.mp4"; // fallback
      
      if (examData && examData.video_npz) {
        if (Array.isArray(examData.video_npz) && examData.video_npz.length > 0) {
          videoPath = examData.video_npz[0];
        } else if (typeof examData.video_npz === 'string') {
          videoPath = examData.video_npz;
        }
      }
      
      const url = await npzToVideoUrl(videoPath);
      
      console.log('✅ Video URL received:', url);
      setVideoState({
        videoUrl: url,
        loading: false,
        error: null,
        dimensions: { width: 0, height: 0 }
      });
    } catch (err) {
      console.error('❌ Error loading video:', err);
      setVideoState({
        videoUrl: null,
        loading: false,
        error: 'Failed to load video',
        dimensions: { width: 0, height: 0 }
      });
    }
  };

  // Update tooltip position when scrolling
  const updateTooltipPosition = useCallback(() => {
    if (currentTermElementRef.current && showTooltip) {
      const rect = currentTermElementRef.current.getBoundingClientRect();
      setMousePosition({
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 5
      });
    }
  }, [showTooltip]);

  // Add scroll listener
  useEffect(() => {
    const handleScroll = () => {
      updateTooltipPosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [updateTooltipPosition]);

  const handleMouseEnter = (event, term) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    
    currentTermElementRef.current = event.target;
    
    const rect = event.target.getBoundingClientRect();
    setMousePosition({
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 5
    });
    
    if (!showTooltip || currentTerm?.term !== term.term) {
      setCurrentTerm(term);
      setShowTooltip(true);
      setIsTooltipVisible(true);
      setIsPaused(false);
      isPausedRef.current = false;
    }
    
    if (!videoState.videoUrl && !videoState.loading) {
      loadVideo();
    }
  };

  const handleMouseLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      if (!isMouseOverTooltipRef.current && !isPausedRef.current) {
        setIsTooltipVisible(false);
        setTimeout(() => {
          setShowTooltip(false);
          setCurrentTerm(null);
          currentTermElementRef.current = null;
        }, 300);
      }
    }, 1000);
  };

  const handleTooltipMouseEnter = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    isMouseOverTooltipRef.current = true;
    if (!isTooltipVisible) {
      setIsTooltipVisible(true);
    }
  };

  const handleTooltipMouseLeave = () => {
    isMouseOverTooltipRef.current = false;
    if (!isPaused && showTooltip) {
      tooltipTimeoutRef.current = setTimeout(() => {
        if (!isMouseOverTooltipRef.current && !isPausedRef.current) {
          setIsTooltipVisible(false);
          setTimeout(() => {
            setShowTooltip(false);
            setCurrentTerm(null);
            currentTermElementRef.current = null;
          }, 300);
        }
      }, 1000);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      setVideoState(prev => ({
        ...prev,
        dimensions: {
          width: video.videoWidth,
          height: video.videoHeight
        }
      }));
    }
  };

  const handleTooltipClick = () => {
    setIsPaused(!isPaused);
    isPausedRef.current = !isPausedRef.current;
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoState.videoUrl) {
        cleanupVideoUrl(videoState.videoUrl);
      }
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [videoState.videoUrl]);

  const segments = parseText(text);

  // Tooltip component
  const CardiacTooltip = ({ term, position }) => {
    if (!term || !term.data) return null;
    
    const tooltipSize = { width: 450, height: 300 }; // Simplified size calculation
    
    const tooltipContent = (
      <div 
        className={`measurement-tooltip ${isTooltipVisible ? 'tooltip-visible' : 'tooltip-hidden'}`}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          zIndex: 10000,
          cursor: 'pointer',
          width: `${tooltipSize.width}px`,
          minHeight: `${tooltipSize.height}px`
        }}
        onClick={handleTooltipClick}
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
      >
        <div className="tooltip-header">
          {term.data.title}
          {isPaused && <span style={{float: 'right', fontSize: '0.8em'}}>⏸ Paused (click to resume)</span>}
        </div>
        <div className="tooltip-content">
          {Object.entries(term.data.content).map(([key, value]) => (
            <div key={key} className="tooltip-item">
              <span className="tooltip-label">{key}:</span>
              <span className="tooltip-value">{value}</span>
            </div>
          ))}
        </div>
        
        {/* Video section */}
        <div className="tooltip-video-section">
          <div className="video-container" style={{ height: 200 }}>
            {videoState.loading && (
              <div className="video-loading">
                <div className="loading-spinner"></div>
                <p>Loading video...</p>
              </div>
            )}
            
            {videoState.error && (
              <div className="video-error">
                <span className="error-icon">⚠️</span>
                <p>{videoState.error}</p>
              </div>
            )}
            
            {!videoState.loading && !videoState.error && videoState.videoUrl && (
              <video
                ref={videoRef}
                className="tooltip-video"
                src={videoState.videoUrl}
                autoPlay={!isPaused}
                loop
                muted
                controls
                onLoadedMetadata={handleVideoLoad}
              />
            )}
          </div>
          <div className="video-label">
            📊 Echo Video - Click tooltip to {isPaused ? 'resume' : 'pause'}
          </div>
        </div>
      </div>
    );
    
    return ReactDOM.createPortal(tooltipContent, document.body);
  };

  return (
    <>
      <div className="hoverable-text-container" style={{ position: 'relative' }}>
        {segments.map((segment, index) => {
          if (segment.type === 'linebreak') {
            return <br key={index} />;
          } else if (segment.type === 'cardiac-term') {
            return (
              <span
                key={index}
                className="cardiac-term-highlight"
                onMouseEnter={(e) => handleMouseEnter(e, segment)}
                onMouseLeave={handleMouseLeave}
                style={{ 
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  transition: 'all 0.2s ease',
                  display: 'inline',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                {segment.content}
              </span>
            );
          } else {
            return <span key={index}>{segment.content}</span>;
          }
        })}
      </div>
      
      {showTooltip && currentTerm && (
        <CardiacTooltip
          term={currentTerm}
          position={mousePosition}
        />
      )}
    </>
  );
};

export default HoverableText;