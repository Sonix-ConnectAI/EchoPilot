import React, { useState, useEffect } from 'react';
import '../styles/PatientSelection.css';

const PatientSelection = ({ onPatientSelect }) => {
  
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredPatient, setHoveredPatient] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/DB_json/eval_result-attn-50-3_local.json');
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process the data - data is an object with numeric keys
      const processedPatients = [];
      Object.keys(data).forEach(key => {
        const patient = data[key];
        if (patient && patient.exam_id) {
          processedPatients.push({
            ...patient,
            _key: key // Store the original key for reference
          });
        }
      });
      
      setPatients(processedPatients);
      setError(null);
    } catch (err) {
      console.error('Error loading patient data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const examId = patient.exam_id || '';
    return examId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const extractPatientInfo = (examId) => {
    const parts = examId.split('__');
    return {
      id: parts[0] || examId,
      date: parts[1] || '',
      fullId: examId
    };
  };

  const handlePatientSelect = async (patient) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      const DB_JSON_PATH = process.env.REACT_APP_DB_JSON_PATH;
      
      const payload = {
        exam_id: patient.exam_id,
        mode: 'pred_label'
      };
      
      if (DB_JSON_PATH) {
        payload.db_json_path = DB_JSON_PATH;
      }
      
      const response = await fetch(`${BACKEND_URL}/api/generate-struct-pred`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 'ok' && data.struct_pred) {
        const enrichedPatient = {
          ...patient,
          struct_pred: data.struct_pred
        };
        // Immediately call onPatientSelect to show processing overlay
        onPatientSelect(enrichedPatient);
      } else {
        throw new Error(data.error || 'Failed to generate structured prediction');
      }
    } catch (err) {
      console.error('❌ Error generating struct_pred:', err);
      setSubmitError(err.message || 'Failed to connect to backend');
      setIsSubmitting(false); // Only reset if there's an error
    }
    // Don't reset isSubmitting here - let the processing overlay handle it
  };

  return (
    <div className="patient-selection">
      <div className="header">
        <div className="title-section">
          <h1 className="main-title">
            <span className="title-icon">🏥</span>
            EchoPilot AI
          </h1>
          <p className="subtitle">Echocardiography Report Assistant</p>
        </div>
        
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search patients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      <div className="content">
        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading patient database...</p>
            <p className="loading-subtext">Processing eval_result-attn-50-3_local.json</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <p className="error-text">⚠️ Error: {error}</p>
            <button className="retry-button" onClick={loadPatientData}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="stats-bar">
              <div className="stat-item">
                <span className="stat-label">Total Patients</span>
                <span className="stat-value">{filteredPatients.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Database</span>
                <span className="stat-value">eval_result-attn-50-3_local.json</span>
              </div>
            </div>

            {submitError && (
              <div className="submit-error-banner">
                <p className="submit-error-text">⚠️ {submitError}</p>
                <button 
                  className="dismiss-error-button" 
                  onClick={() => setSubmitError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}
            
            {isSubmitting && (
              <div className="submitting-overlay">
                <div className="submitting-content">
                  <div className="loading-spinner"></div>
                  <p className="submitting-text">Preparing patient data...</p>
                  <p className="submitting-subtext">This may take a few moments</p>
                </div>
              </div>
            )}
            
            <div className="patients-grid">
              {filteredPatients.map((patient, index) => {
                const patientInfo = extractPatientInfo(patient.exam_id);
                return (
                  <div
                    key={patient.exam_id || index}
                    className={`patient-card ${hoveredPatient === patient.exam_id ? 'hovered' : ''} ${isSubmitting ? 'disabled' : ''}`}
                    onClick={() => !isSubmitting && handlePatientSelect(patient)}
                    onMouseEnter={() => setHoveredPatient(patient.exam_id)}
                    onMouseLeave={() => setHoveredPatient(null)}
                  >
                    <div className="patient-icon">👤</div>
                    <div className="patient-info">
                      <h3 className="patient-id">{patientInfo.id}</h3>
                      {patientInfo.date && (
                        <p className="patient-date">{patientInfo.date}</p>
                      )}
                      {patient.hospital && (
                        <p className="patient-hospital">{patient.hospital}</p>
                      )}
                    </div>
                    <div className="patient-arrow">→</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PatientSelection;