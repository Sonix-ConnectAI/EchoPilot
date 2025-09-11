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
    // 새 환자 선택 시 이전 평가 결과/상태 초기화 (요약 재생성 유도)
    setAssessmentData(null);
    setAssessedPatient(null);
    setIsProcessingPatient(false);
    setCurrentPage('dataview');
  };

  const handleBackToSelection = () => {
    setSelectedPatient(null);
    setAssessedPatient(null);
    // selection으로 돌아갈 때도 이전 평가 데이터 제거해 다음 선택 시 초기 상태 보장
    setAssessmentData(null);
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
    const isSamePatient = selectedPatient && (selectedPatient.exam_id || selectedPatient.id) === (patient && (patient.exam_id || patient.id));
    const hasExistingSummary = !!(assessmentData && assessmentData.summary);

    if (isSamePatient && hasExistingSummary) {
      console.log('📝 [Navigation] DataView → Assessment (reuse existing summary)\n', {
        patient: patient && (patient.exam_id || patient.id),
        hasExistingSummary
      });
      setSelectedPatient(patient);
      setIsProcessingPatient(false);
      setCurrentPage('assessment');
      return;
    }

    console.log('📝 [Navigation] DataView → Assessment (re-generate)\n', {
      patient: patient && (patient.exam_id || patient.id),
      hasExistingSummary
    });
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
            initialSummary={assessmentData?.summary || ''}
            initialStructuredData={assessmentData?.structuredData || null}
            initialKeywords={assessmentData?.keywords || []}
            onBack={handleBackToDataView}
            onEndExam={handleBackToSelection}
            onAssessmentDataChange={(data) => {
              // Keep latest assessment snapshot for reuse on navigation
              setAssessmentData(data);
            }}
            onProceed={(action, data) => {
              if (action === 'final-report') {
                // Pass assessment data to final report
                handleProceedToFinalReport({
                  patient: selectedPatient,
                  summary: data?.summary || '',
                  structuredData: data?.structuredData || {},
                  keywords: data?.keywords || []
                });
              } else {
                handleProceedToDetail(action);
              }
            }}
            onReady={handleAssessmentReady}
            isProcessing={isProcessingPatient}
          />
        );

      case 'final-report':
        return (
          <FinalReport 
            patient={assessmentData?.patient || selectedPatient}
            summary={assessmentData?.summary}
            structuredData={assessmentData?.structuredData}
            onBack={() => {
              console.log('📝 [Back] Final Report → Assessment');
              setCurrentPage('assessment');
            }}
            onEndExam={() => {
              console.log('📝 [End Exam] Final Report → Selection');
              setSelectedPatient(null);
              setAssessedPatient(null);
              setAssessmentData(null);
              setIsProcessingPatient(false);
              setCurrentPage('selection');
            }}
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