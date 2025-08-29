import React, { useState, useEffect, useRef } from 'react';
import '../styles/FinalReport.css';

const FinalReport = ({ 
  patient, 
  summary, 
  conclusion, 
  recommendation, 
  keywords, 
  structuredData,
  onBack 
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const reportRef = useRef(null);

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

  // Handle print
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  // Handle export as PDF (placeholder - needs implementation)
  const handleExportPDF = () => {
    console.log('Export as PDF - To be implemented');
    // TODO: Implement PDF export using libraries like jsPDF or react-pdf
  };

  // Extract key measurements from structuredData
  const getKeyMeasurements = () => {
    const measurements = [];
    
    if (structuredData?.lv_systolic_function?.lvef) {
      measurements.push({ 
        label: 'LVEF', 
        value: `${structuredData.lv_systolic_function.lvef}%` 
      });
    }
    
    if (structuredData?.lv_geometry?.LVEDD) {
      measurements.push({ 
        label: 'LVEDD', 
        value: `${structuredData.lv_geometry.LVEDD} mm` 
      });
    }
    
    if (structuredData?.lv_geometry?.IVSd) {
      measurements.push({ 
        label: 'IVSd', 
        value: `${structuredData.lv_geometry.IVSd} mm` 
      });
    }
    
    if (structuredData?.pulmonary_vessels?.rvsp) {
      measurements.push({ 
        label: 'RVSP', 
        value: `${structuredData.pulmonary_vessels.rvsp} mmHg` 
      });
    }
    
    if (structuredData?.lv_diastolic_function?.['E/E\'']) {
      measurements.push({ 
        label: 'E/E\'', 
        value: structuredData.lv_diastolic_function['E/E\''] 
      });
    }
    
    return measurements;
  };

  const patientInfo = formatPatientInfo();
  const keyMeasurements = getKeyMeasurements();

  return (
    <div className="final-report-container">
      <div className="report-header-actions">
        <button className="btn-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Assessment
        </button>
        <div className="report-actions">
          <button className="btn-print" onClick={handlePrint} disabled={isPrinting}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6V2H12V6M4 10H2V14H14V10H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="4" y="10" width="8" height="4" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            {isPrinting ? 'Printing...' : 'Print'}
          </button>
          <button className="btn-export" onClick={handleExportPDF}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 11L8 3M8 11L5 8M8 11L11 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      <div className="report-content" ref={reportRef}>
        <div className="report-page">
          {/* Report Header */}
          <div className="report-title-section">
            <h1>Echocardiography Report</h1>
            <div className="report-subtitle">Comprehensive Cardiac Assessment</div>
          </div>

          {/* Patient Information */}
          <div className="report-section patient-info-section">
            <h2>Patient Information</h2>
            <div className="patient-info-grid">
              <div className="info-item">
                <span className="info-label">Name:</span>
                <span className="info-value">{patientInfo.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Age:</span>
                <span className="info-value">{patientInfo.age}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Gender:</span>
                <span className="info-value">{patientInfo.gender}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Exam ID:</span>
                <span className="info-value">{patientInfo.id}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Date:</span>
                <span className="info-value">{patientInfo.date}</span>
              </div>
            </div>
          </div>

          {/* Key Measurements */}
          {keyMeasurements.length > 0 && (
            <div className="report-section measurements-section">
              <h2>Key Measurements</h2>
              <div className="measurements-grid">
                {keyMeasurements.map((measurement, index) => (
                  <div key={index} className="measurement-item">
                    <span className="measurement-label">{measurement.label}:</span>
                    <span className="measurement-value">{measurement.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="report-section summary-section">
              <h2>Echocardiographic Findings</h2>
              <div className="report-text">
                {summary.split('\n').map((line, index) => (
                  line.trim() && (
                    <p key={index} className="report-paragraph">
                      {line}
                    </p>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Conclusion */}
          {conclusion && (
            <div className="report-section conclusion-section">
              <h2>Conclusion</h2>
              <div className="report-text">
                {conclusion.split('\n').map((line, index) => (
                  line.trim() && (
                    <p key={index} className="report-paragraph">
                      {line}
                    </p>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Clinical Recommendation */}
          {recommendation && (
            <div className="report-section recommendation-section">
              <h2>Clinical Recommendation</h2>
              <div className="report-text">
                {recommendation.split('\n').map((line, index) => (
                  line.trim() && (
                    <p key={index} className="report-paragraph">
                      {line}
                    </p>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Clinical Keywords */}
          {keywords && keywords.length > 0 && (
            <div className="report-section keywords-section">
              <h2>Clinical Keywords</h2>
              <div className="keywords-list">
                {keywords.map((keyword, index) => (
                  <span key={index} className="keyword-tag">
                    {typeof keyword === 'string' ? keyword : keyword.text || keyword.keyword}
                    {keyword.importance && keyword.importance >= 4 && (
                      <span className="importance-indicator">!</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Report Footer */}
          <div className="report-footer">
            <div className="footer-content">
              <div className="signature-section">
                <div className="signature-line"></div>
                <p>Physician Signature</p>
              </div>
              <div className="timestamp">
                Generated on {getCurrentDate()}
              </div>
            </div>
            <div className="disclaimer">
              This report is generated based on echocardiographic findings and should be interpreted 
              in conjunction with clinical assessment and other diagnostic tests.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalReport;