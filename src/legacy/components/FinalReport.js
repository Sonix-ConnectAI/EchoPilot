import React, { useState, useEffect } from 'react';
import '../styles/FinalReport.css';
import { generateConclusionFromData, generateRecommendationFromData } from '../services/openaiService';

const FinalReport = ({ 
  patient, 
  summary, 
  structuredData,
  onBack,
  onEndExam
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
      <div className="final-report-top-header">
        <div className="final-report-header-content">
          <div className="final-report-app-icon">
            <img src="/logo/logo.PNG" alt="Sonix Health Logo" className="final-report-logo-image" />
          </div>
          <div className="final-report-app-name">Sonix Health</div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="final-report-side-panel">
        <div className="final-report-side-panel-content">
          {/* Expand/Collapse Button */}
          <div className="final-report-side-panel-toggle">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="#FFFFFF" strokeWidth="2" fill="none"/>
            </svg>
          </div>

          {/* User/Team Button */}
          <div className="final-report-side-panel-item" title="Team Management">
            <div className="final-report-side-panel-icon final-report-user-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" stroke="#FFFFFF" strokeWidth="1.5"/>
                <path d="M0 16C0 12.6863 3.58172 10 8 10C12.4183 10 16 12.6863 16 16" stroke="#FFFFFF" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="final-report-side-panel-tooltip">Team Management</span>
          </div>

          {/* Divider */}
          <div className="final-report-side-panel-divider"></div>

          {/* AI Assistant */}
          <div className="final-report-side-panel-item" title="AI Assistant">
            <div className="final-report-side-panel-icon final-report-ai-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="#FFFFFF" strokeWidth="1.5"/>
                <text x="10" y="12" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">AI</text>
              </svg>
            </div>
            <span className="final-report-side-panel-tooltip">AI Assistant</span>
          </div>

          {/* A/B Testing */}
          <div className="final-report-side-panel-item" title="A/B Testing">
            <div className="final-report-side-panel-icon final-report-ab-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 3H8V17H3V3Z" stroke="#FFFFFF" strokeWidth="1.5"/>
                <path d="M12 3H17V17H12V3Z" stroke="#FFFFFF" strokeWidth="1.5"/>
                <text x="5.5" y="12" fill="#FFFFFF" fontSize="8" fontWeight="bold">A</text>
                <text x="14.5" y="12" fill="#FFFFFF" fontSize="8" fontWeight="bold">B</text>
              </svg>
            </div>
            <span className="final-report-side-panel-tooltip">A/B Testing</span>
          </div>

          {/* Gallery/Images */}
          <div className="final-report-side-panel-item" title="Gallery">
            <div className="final-report-side-panel-icon final-report-gallery-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="#FFFFFF" strokeWidth="1.5"/>
                <circle cx="7" cy="7" r="2" stroke="#FFFFFF" strokeWidth="1.5"/>
                <path d="M2 14L6 10L10 14L18 6" stroke="#FFFFFF" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="final-report-side-panel-tooltip">Gallery</span>
          </div>
        </div>
      </div>

      {/* Patient Information Panel */}
      <div className="final-report-patient-info-container">
        <div className="final-report-patient-info-row">
          <div className="final-report-patient-info-card">
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">Patient ID:</span>
              <span className="final-report-info-value">{patientInfo.id || 'N/A'}</span>
            </div>
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">Name:</span>
              <span className="final-report-info-value-bold">{patient.name || 'N/A'}</span>
            </div>
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">Sex:</span>
              <span className="final-report-info-value">{patient.gender || patient.sex || 'N/A'}</span>
            </div>
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">Age:</span>
              <span className="final-report-info-value">{patient.age || 'N/A'}</span>
            </div>
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">Height:</span>
              <span className="final-report-info-value">{patient.height || 'N/A'}</span>
            </div>
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">Weight:</span>
              <span className="final-report-info-value">{patient.weight || 'N/A'}</span>
            </div>
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">HR:</span>
              <span className="final-report-info-value">{patient.hr || patient.heart_rate || 'N/A'}</span>
            </div>
            <div className="final-report-patient-info-item">
              <span className="final-report-info-label">BSA:</span>
              <span className="final-report-info-value">{patient.bsa || 'N/A'}</span>
            </div>
          </div>
          
          {/* End Exam Button */}
          <div className="final-report-end-exam-button" onClick={onEndExam}>
            <span>End Exam</span>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Panel Grid */}
      <div className="final-report-main-container">
        <div className="final-report-grid">
          {/* Summary Panel */}
          <div className="final-report-panel final-report-summary-panel">
            <div className="final-report-panel-header">
              <h3 className="final-report-panel-title">
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
            <div className="final-report-panel-content">
              {summary ? (
                <div className="final-report-summary-content">
                  {summary.split('\n').map((line, index) => (
                    line.trim() && (
                      <p key={index} className="final-report-summary-line">
                        {line}
                      </p>
                    )
                  ))}
                </div>
              ) : (
                <div className="final-report-empty-state">
                  <p>No summary available</p>
                </div>
              )}
            </div>
          </div>

          {/* Conclusion Panel */}
          <div className="final-report-panel final-report-conclusion-panel">
            <div className="final-report-panel-header">
              <h3 className="final-report-panel-title">
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
                <button className="final-report-generate-btn" onClick={generateConclusion}>
                  Generate
                </button>
              )}
            </div>
            <div className="final-report-panel-content">
              {isGeneratingConclusion ? (
                <div className="final-report-loading-state">
                  <div className="final-report-loading-spinner"></div>
                  <p>Generating conclusion...</p>
                </div>
              ) : conclusion ? (
                <div className="final-report-conclusion-content">
                  {conclusion.split('\n').map((line, index) => (
                    line.trim() && (
                      <p key={index} className="final-report-conclusion-line">
                        {line}
                      </p>
                    )
                  ))}
                </div>
              ) : (
                <div className="final-report-empty-state">
                  <p>Click "Generate" to create conclusion</p>
                </div>
              )}
            </div>
          </div>

          {/* Recommendation Panel */}
          <div className="final-report-panel final-report-recommendation-panel">
            <div className="final-report-panel-header">
              <h3 className="final-report-panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Recommendation
              </h3>
              {!recommendation && !isGeneratingRecommendation && (
                <button className="final-report-generate-btn" onClick={generateRecommendation}>
                  Generate
                </button>
              )}
            </div>
            <div className="final-report-panel-content">
              {isGeneratingRecommendation ? (
                <div className="final-report-loading-state">
                  <div className="final-report-loading-spinner"></div>
                  <p>Generating recommendations...</p>
                </div>
              ) : recommendation ? (
                <div className="final-report-recommendation-content">
                  {recommendation.split('\n').map((line, index) => (
                    line.trim() && (
                      <p key={index} className="final-report-recommendation-line">
                        {line}
                      </p>
                    )
                  ))}
                </div>
              ) : (
                <div className="final-report-empty-state">
                  <p>Click "Generate" to create recommendations</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="final-report-footer">
        <div className="final-report-footer-content">
          <div className="final-report-footer-left">
            {/* Empty for now */}
            <button className="final-report-back-button" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
          </div>
          <div className="final-report-footer-right">
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalReport;