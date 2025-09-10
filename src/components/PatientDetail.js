import React, { useState } from 'react';
import '../styles/PatientDetail.css';
import { generateAIReport } from '../services/openaiService';
import HoverableText from './HoverableText';

const PatientDetail = ({ patient, onBack }) => {
  console.log('👤 PatientDetail loaded for:', patient.exam_id);
  
  const [activePanel, setActivePanel] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReports, setAiReports] = useState({
    summary: null,
    conclusion: null,
    recommendation: null
  });
  const [error, setError] = useState(null);

  const extractPatientInfo = (examId) => {
    const parts = examId.split('__');
    return {
      id: parts[0] || examId,
      date: parts[1] || '',
      fullId: examId
    };
  };

  const patientInfo = extractPatientInfo(patient.exam_id);

  // Format text - preserve original formatting
  const formatText = (text) => {
    if (!text) return 'No data available';
    return text.replace(/\\n/g, '\n').trim();
  };

  // Handle AI report generation
  const handleGenerateAIReport = async () => {
    console.log('🚀 Generate AI Report button clicked');
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log('📡 Calling AI service...');
      const reports = await generateAIReport(patient);
      console.log('✅ AI reports received:', Object.keys(reports));
      setAiReports(reports);
    } catch (err) {
      console.log('❌ AI report generation failed:', err.message);
      setError('Failed to generate AI report. Please try again.');
      console.error('AI report generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="patient-detail">
      <header className="detail-header">
        <button className="back-button" onClick={() => {
          console.log('⬅️ Back button clicked');
          onBack();
        }}>
          ← Back to Patients
        </button>
        
        <div className="patient-header-info">
          <h1 className="patient-name">{patientInfo.id}</h1>
          <div className="patient-meta">
            {patientInfo.date && <span className="meta-item">📅 {patientInfo.date}</span>}
            {patient.hospital && <span className="meta-item">🏥 {patient.hospital}</span>}
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className={`action-btn generate-report ${isGenerating ? 'generating' : ''}`}
            onClick={handleGenerateAIReport}
            disabled={isGenerating}
          >
            <span className="btn-icon">
              {isGenerating ? '⏳' : '📊'}
            </span>
            {isGenerating ? 'Generating AI Report...' : 'Generate AI Report'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="panels-container">
        <div 
          className={`panel summary-panel ${activePanel === 'summary' ? 'active' : ''}`}
          onClick={() => {
            console.log('📋 Summary panel clicked');
            setActivePanel(activePanel === 'summary' ? null : 'summary');
          }}
        >
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="panel-icon">📋</span>
              AI Summary
            </h2>
            <span className="panel-status">
              {aiReports.summary ? 'AI Generated' : 'AI Analysis Pending'}
            </span>
          </div>
          <div className="panel-content">
            {aiReports.summary ? (
              <HoverableText 
                text={aiReports.summary} 
                examData={patient}
              />
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🤖</span>
                <p className="empty-text">AI summary will appear here after analysis</p>
              </div>
            )}
          </div>
        </div>

        <div 
          className={`panel conclusion-panel ${activePanel === 'conclusion' ? 'active' : ''}`}
          onClick={() => {
            console.log('🩺 Conclusion panel clicked');
            setActivePanel(activePanel === 'conclusion' ? null : 'conclusion');
          }}
        >
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="panel-icon">🩺</span>
              AI Conclusion
            </h2>
            <span className="panel-status">
              {aiReports.conclusion ? 'AI Generated' : 'AI Analysis Pending'}
            </span>
          </div>
          <div className="panel-content">
            {aiReports.conclusion ? (
              <pre className="formatted-text">{formatText(aiReports.conclusion)}</pre>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📝</span>
                <p className="empty-text">AI conclusion will appear here after analysis</p>
              </div>
            )}
          </div>
        </div>

        <div 
          className={`panel recommend-panel ${activePanel === 'recommend' ? 'active' : ''}`}
          onClick={() => {
            console.log('💡 Recommendations panel clicked');
            setActivePanel(activePanel === 'recommend' ? null : 'recommend');
          }}
        >
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="panel-icon">💡</span>
              AI Recommendations
            </h2>
            <span className="panel-status">
              {aiReports.recommendation ? 'AI Generated' : 'AI Analysis Pending'}
            </span>
          </div>
          <div className="panel-content">
            {aiReports.recommendation ? (
              <pre className="formatted-text">{formatText(aiReports.recommendation)}</pre>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <p className="empty-text">AI recommendations will appear here after analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="detail-footer">
        <div className="footer-info">
          <span className="info-item">Exam ID: {patient.exam_id}</span>
          {patient.video_npz && <span className="info-item">Videos: {Array.isArray(patient.video_npz) ? patient.video_npz.length : 1}</span>}
          {patient.meta_json && <span className="info-item">Metadata: ✅</span>}
        </div>
      </div>
    </div>
  );
};

export default PatientDetail;