import React, { useState } from 'react';
import './App.css';
import PatientSelection from './components/PatientSelection';
import PatientDataView from './components/PatientDataView';
import PatientAssessment from './components/PatientAssessment';
import PatientDetail from './components/PatientDetail';
import FinalReport from './components/FinalReport';

function App() {
  const [currentPage, setCurrentPage] = useState('selection');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assessedPatient, setAssessedPatient] = useState(null);
  const [isProcessingPatient, setIsProcessingPatient] = useState(false);
  const [assessmentData, setAssessmentData] = useState(null);

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setCurrentPage('dataview');
  };

  const handleBackToSelection = () => {
    setSelectedPatient(null);
    setAssessedPatient(null);
    setIsProcessingPatient(false);
    setCurrentPage('selection');
  };

  const handleBackToAssessment = () => {
    setCurrentPage('assessment');
  };

  const handleBackToDataView = () => {
    setCurrentPage('dataview');
  };

  const handleContinueToAssessment = (patient) => {
    setSelectedPatient(patient);
    setIsProcessingPatient(true);
    setCurrentPage('assessment');
  };

  const handleProceedToDetail = (updatedPatientData) => {
    setAssessedPatient(updatedPatientData);
    setCurrentPage('detail');
  };

  const handleProceedToFinalReport = (data) => {
    setAssessmentData(data);
    setCurrentPage('final-report');
  };

  const handleAssessmentReady = () => {
    setIsProcessingPatient(false);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'selection':
        return <PatientSelection onPatientSelect={handlePatientSelect} />;
      case 'dataview':
        return (
          <PatientDataView 
            patient={selectedPatient}
            onContinueToAssessment={handleContinueToAssessment}
            onBack={handleBackToSelection}
          />
        );
      case 'assessment':
        return (
          <PatientAssessment 
            patient={selectedPatient} 
            onBack={handleBackToDataView}
            onProceed={(action, data) => {
              if (action === 'final-report') {
                // Pass assessment data to final report
                handleProceedToFinalReport({
                  patient: selectedPatient,
                  summary: data?.summary || '',
                  structuredData: data?.structuredData || {}
                });
              } else {
                handleProceedToDetail(action);
              }
            }}
            onReady={handleAssessmentReady}
            isProcessing={isProcessingPatient}
          />
        );
      case 'detail':
        return (
          <PatientDetail 
            patient={assessedPatient || selectedPatient} 
            onBack={() => setCurrentPage('assessment')} 
          />
        );
      case 'final-report':
        return (
          <FinalReport 
            patient={assessmentData?.patient || selectedPatient}
            summary={assessmentData?.summary}
            structuredData={assessmentData?.structuredData}
            onBack={() => setCurrentPage('assessment')}
          />
        );
      default:
        return <PatientSelection onPatientSelect={handlePatientSelect} />;
    }
  };

  return (
    <div className="app">
      {renderCurrentPage()}
    </div>
  );
}

export default App;