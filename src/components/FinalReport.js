import React, { useState, useEffect } from 'react';
import '../styles/FinalReport.css';
import { generateConclusionFromData, generateRecommendationFromData } from '../services/openaiService';

const FinalReport = ({ 
  patient, 
  summary, 
  structuredData,
  onBack 
}) => {
  const [conclusion, setConclusion] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [isGeneratingConclusion, setIsGeneratingConclusion] = useState(false);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);

  // Format current date
  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Format patient info
  const formatPatientInfo = () => {
    if (!patient) return {};
    
    return {
      name: patient.name || patient.patient_name || 'Unknown',
      age: patient.age || 'Unknown',
      gender: patient.gender || 'Unknown',
      id: patient.exam_id || patient.id || 'Unknown',
      date: getCurrentDate()
    };
  };

  // Generate Conclusion using OpenAI
  const generateConclusion = async () => {
    if (!summary || !structuredData) return;
    
    setIsGeneratingConclusion(true);
    try {
      const result = await generateConclusionFromData(summary, structuredData);
      setConclusion(result);
    } catch (error) {
      console.error('Error generating conclusion:', error);
      setConclusion('Error generating conclusion. Please try again.');
    } finally {
      setIsGeneratingConclusion(false);
    }
  };

  // Generate Recommendation using OpenAI
  const generateRecommendation = async () => {
    if (!summary || !structuredData) return;
    
    setIsGeneratingRecommendation(true);
    try {
      const result = await generateRecommendationFromData(summary, structuredData);
      setRecommendation(result);
    } catch (error) {
      console.error('Error generating recommendation:', error);
      setRecommendation('Error generating recommendations. Please try again.');
    } finally {
      setIsGeneratingRecommendation(false);
    }
  };

  // Auto-generate conclusion and recommendation when component mounts
  useEffect(() => {
    if (summary && structuredData) {
      generateConclusion();
      generateRecommendation();
    }
  }, [summary, structuredData]);

  const patientInfo = formatPatientInfo();

  return (
    <div className="final-report-page">
      {/* Top Header */}
      <div className="top-header">
        <div className="header-content">
          <div className="app-icon">
            <img src="/logo/logo.PNG" alt="EchoPilot AI" className="logo-image" />
          </div>
          <div className="app-name">EchoPilot AI - Final Report</div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="side-panel">
        <div className="side-panel-content">
          <div className="side-panel-item">
            <div className="side-panel-icon">
              <img src="/logo/logo.PNG" alt="Logo" className="side-panel-logo" />
            </div>
            <div className="side-panel-tooltip">Home</div>
          </div>
          
          <div className="side-panel-divider"></div>
          
          <div className="side-panel-item">
            <div className="side-panel-icon user-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="side-panel-tooltip">Patient</div>
          </div>
          
          <div className="side-panel-item">
            <div className="side-panel-icon ai-icon">
              <img src="/logo/logo.PNG" alt="AI" className="ai-logo" />
            </div>
            <div className="side-panel-tooltip">AI Analysis</div>
          </div>
        </div>
      </div>

      {/* Patient Info Container */}
      <div className="patient-info-container">
        <div className="patient-info-row">
          <div className="patient-info-card">
            <div className="patient-info-item">
              <span className="info-label">Name:</span>
              <span className="info-value-bold">{patientInfo.name}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Age:</span>
              <span className="info-value">{patientInfo.age}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Gender:</span>
              <span className="info-value">{patientInfo.gender}</span>
            </div>
            <div className="patient-info-item">
              <span className="info-label">Exam ID:</span>
              <span className="info-value">{patientInfo.id}</span>
            </div>
          </div>
          
          <div className="right-controls-container">
            <div className="header-dropdowns-container">
              {/* Empty for now - can add dropdowns if needed */}
            </div>
            
            <div className="final-report-button" onClick={onBack}>
              <span>Back to Assessment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Panel Grid */}
      <div className="main-container">
        <div className="final-report-grid">
          {/* Summary Panel */}
          <div className="report-panel summary-panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Summary
              </h3>
            </div>
            <div className="panel-content">
              {summary ? (
                <div className="summary-content">
                  {summary.split('\n').map((line, index) => (
                    line.trim() && (
                      <p key={index} className="summary-line">
                        {line}
                      </p>
                    )
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No summary available</p>
                </div>
              )}
            </div>
          </div>

          {/* Conclusion Panel */}
          <div className="report-panel conclusion-panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Conclusion
              </h3>
              {!conclusion && !isGeneratingConclusion && (
                <button className="generate-btn" onClick={generateConclusion}>
                  Generate
                </button>
              )}
            </div>
            <div className="panel-content">
              {isGeneratingConclusion ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Generating conclusion...</p>
                </div>
              ) : conclusion ? (
                <div className="conclusion-content">
                  {conclusion.split('\n').map((line, index) => (
                    line.trim() && (
                      <p key={index} className="conclusion-line">
                        {line}
                      </p>
                    )
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Click "Generate" to create conclusion</p>
                </div>
              )}
            </div>
          </div>

          {/* Recommendation Panel */}
          <div className="report-panel recommendation-panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Recommendation
              </h3>
              {!recommendation && !isGeneratingRecommendation && (
                <button className="generate-btn" onClick={generateRecommendation}>
                  Generate
                </button>
              )}
            </div>
            <div className="panel-content">
              {isGeneratingRecommendation ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Generating recommendations...</p>
                </div>
              ) : recommendation ? (
                <div className="recommendation-content">
                  {recommendation.split('\n').map((line, index) => (
                    line.trim() && (
                      <p key={index} className="recommendation-line">
                        {line}
                      </p>
                    )
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Click "Generate" to create recommendations</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <div className="footer-content">
          <div className="footer-left">
            {/* Empty for now */}
          </div>
          <div className="footer-right">
            <button className="back-button" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalReport;