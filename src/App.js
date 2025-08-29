import React, { useState } from 'react';
import './App.css';
import PatientSelection from './components/PatientSelection';
import PatientAssessment from './components/PatientAssessment';
import PatientDetail from './components/PatientDetail';

function App() {
  const [currentPage, setCurrentPage] = useState('selection');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assessedPatient, setAssessedPatient] = useState(null);

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setCurrentPage('assessment');
  };

  const handleBackToSelection = () => {
    setSelectedPatient(null);
    setAssessedPatient(null);
    setCurrentPage('selection');
  };

  const handleBackToAssessment = () => {
    setCurrentPage('assessment');
  };

  const handleProceedToDetail = (updatedPatientData) => {
    setAssessedPatient(updatedPatientData);
    setCurrentPage('detail');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'selection':
        return <PatientSelection onPatientSelect={handlePatientSelect} />;
      case 'assessment':
        return (
          <PatientAssessment 
            patient={selectedPatient} 
            onBack={handleBackToSelection}
            onProceed={handleProceedToDetail}
          />
        );
      case 'detail':
        return (
          <PatientDetail 
            patient={assessedPatient || selectedPatient} 
            onBack={handleBackToAssessment} 
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