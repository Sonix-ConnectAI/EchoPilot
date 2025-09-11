// Core type definitions

export interface IPatient {
  id: string;
  mrn: string;                    // Medical Record Number
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  studyDate: Date;
  modality: 'CT' | 'MRI' | 'Echo';
  priority: 'urgent' | 'normal' | 'low';
  dicomFiles: IDicomFile[];
  metadata: IPatientMetadata;
}

export interface IDicomFile {
  id: string;
  filename: string;
  path: string;
  size: number;
  modality: string;
  studyDate: Date;
}

export interface IPatientMetadata {
  studyDescription: string;
  physicianName: string;
  institutionName: string;
  [key: string]: any;
}

export interface IAnalysis {
  id: string;
  patientId: string;
  timestamp: Date;
  aiPredictions: IAIPrediction[];
  features: IFeature[];
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface IAIPrediction {
  category: string;
  prediction: string;
  confidence: number;
  boundingBox?: IBoundingBox;
}

export interface IFeature {
  name: string;
  value: string | number;
  importance: number;
}

export interface IBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IReport {
  id: string;
  analysisId: string;
  summary: string;
  findings: IFinding[];
  conclusion: string;
  recommendations: string[];
  keywords: string[];
  editHistory: IEditRecord[];
}

export interface IFinding {
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export interface IEditRecord {
  timestamp: Date;
  userId: string;
  action: 'create' | 'edit' | 'delete';
  section: string;
  changes: string;
}