# EchoPilot AI Medical Service - Refactoring Project

## Project Context

### Overview
AI-powered medical imaging analysis and report generation system undergoing systematic refactoring from legacy codebase to modern architecture.

### Business Requirements
- Medical image (DICOM/NPZ) analysis with AI assistance
- Doctor-AI collaborative workflow for diagnosis
- Real-time chat interface for medical consultation
- Automated report generation with clinical recommendations

### Technical Architecture
```
Frontend (React:3000) → Proxy → Python Backend (Flask:5001)
                            └→ WebSocket Server (Node:3002)
```

## System Design

### Core Workflow
1. **Patient Selection** - Browse and select patient records
2. **Patient Data** - View DICOM images and doctor's initial report
3. **Patient Assessment** - AI analysis with interactive canvas and chatbot
4. **Semi-Final Report** - Review and edit AI-generated insights
5. **Final Report** - Finalize and export medical report

### Key Technical Decisions (Target Architecture)
- **State Management**: Zustand over Redux (simpler API, less boilerplate) - *To be installed*
- **Styling**: CSS Modules over styled-components (better performance) - *To be installed*
- **API Layer**: Axios + React Query (caching, optimistic updates) - *To be installed*
- **Medical Imaging**: Cornerstone.js (industry standard for DICOM) - *To be installed*
- **Real-time**: Socket.io (currently implemented)

## Current Implementation Status

### Legacy Code Analysis

#### Legacy Code Structure
```
src/legacy/
├── components/              # React components
│   ├── PatientSelection.js  # Patient selection (225 lines)
│   ├── PatientDataView.js   # Patient data display
│   ├── PatientAssessment.js # AI analysis (4474 lines, most complex)
│   ├── PatientDetail.js     # Patient detail information
│   ├── FinalReport.js       # Final report generation
│   └── chat/               # Chat-related components
├── services/               # Service layer
│   ├── openaiService.js    # OpenAI API service
│   └── websocket/          # WebSocket services
├── styles/                 # CSS style files
└── utils/                  # Utility functions
```

#### Key Functionality Analysis
- **PatientSelection**: Loads patient list from JSON database
- **PatientAssessment**: AI chat, video processing, structured data editing
- **WebSocket**: Real-time AI chat and report generation
- **OpenAI Integration**: Summary generation, keyword extraction, structured data updates

### Project Structure
```
src/
├── app/                    # Application entry and providers
├── layouts/               # Shared layout components
│   └── MainLayout/       # Common wrapper (header, sidebar, footer)
├── pages/                # 5 main workflow pages
├── services/             # API and WebSocket services
│   ├── python/          # NPZ→MP4 conversion, data processing
│   └── websocket/       # AI chat, report generation
└── shared/              # Reusable utilities and components
```

### Active Development Phase
**Current Step**: Complete refactoring planning and foundation structure setup  
**Blocked By**: Legacy code analysis completed, new architecture design required  
**Next Step**: Install new dependencies and create folder structure

## API Reference

### Python Backend Endpoints (Port 5001)
```typescript
GET  /api/files/npz          // List available NPZ files
GET  /api/files/mp4          // List converted MP4 files
POST /api/convert            // Convert NPZ to MP4
POST /api/process            // Preprocess medical data
GET  /api/stream/:filename   // Stream video file
```

### WebSocket Events (Port 3002)
```typescript
// Client → Server
'chat_message': { message: string, context: object }
'generate_report': { type: 'summary'|'conclusion'|'recommendation', data: object }

// Server → Client
'chat_response': { content: string, isComplete: boolean }
'report_generated': { type: string, content: string }
```

## Code Patterns and Standards

### Component Structure
```typescript
// Each page follows this pattern
pages/
  PageName/
    index.tsx              // Page component
    components/           // Page-specific components
    hooks/               // Page-specific hooks
    types.ts            // TypeScript definitions
```

### Service Layer Pattern
```typescript
class ServiceName {
  private client: AxiosInstance;
  
  async getData<T>(params: Params): Promise<T> {
    // Error handling
    // Type safety
    // Response transformation
  }
}
```

### Layout Props Interface
```typescript
interface FooterProps {
  backLabel?: string;    // Default: "Back"
  nextLabel?: string;    // Default: "Next"
  onBack?: () => void;
  onNext?: () => void;
  disableBack?: boolean;
  disableNext?: boolean;
}
```

## Testing Strategy

### Test Coverage Requirements
- Unit tests: Utility functions, custom hooks
- Integration tests: API services, WebSocket connections
- E2E tests: Complete workflow from patient selection to final report

### Critical Test Scenarios
1. NPZ to MP4 conversion with large files
2. WebSocket reconnection after network interruption
3. Concurrent report editing by multiple users
4. DICOM rendering performance with multi-frame images

## Security Considerations

### Medical Data Protection
- PHI (Protected Health Information) encryption at rest and in transit
- Session timeout after 30 minutes of inactivity
- Audit logging for all data access
- HIPAA compliance requirements

### API Security
```typescript
// All API requests must include
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Session-ID': sessionId,
  'X-CSRF-Token': csrfToken
}
```

## Performance Requirements

### Target Metrics
- Initial page load: < 3 seconds
- DICOM image rendering: < 1 second
- API response time: < 500ms (except video conversion)
- WebSocket latency: < 100ms

### Optimization Strategies
- Virtual scrolling for patient lists
- Progressive DICOM loading
- React.memo for expensive components
- Web Workers for image processing

## Development Workflow

### Local Development Setup
```bash
# Terminal 1: React Frontend
npm start                 # Runs on :3000

# Terminal 2: Python Backend
python app.py            # Runs on :5001

# Terminal 3: WebSocket Server
node websocket-server.js # Runs on :3002
```

### Environment Variables
```env
# Currently in use
REACT_APP_API_URL=http://localhost:5001
REACT_APP_WS_URL=ws://localhost:3002
REACT_APP_OPENAI_KEY=<required_for_ai_features>
REACT_APP_PROXY_URL=http://localhost:5001

# To be added after refactoring
REACT_APP_PYTHON_BACKEND_URL=http://localhost:5001
REACT_APP_CORNERSTONE_WEB_WORKER_URL=/cornerstone-web-worker.js
REACT_APP_REACT_QUERY_DEVTOOLS=true
```

## Known Issues and Workarounds

### Issue #1: CORS with Local Development
**Problem**: WebSocket CORS errors in development  
**Workaround**: Use setupProxy.js to proxy WebSocket connections

### Issue #2: Large NPZ File Processing
**Problem**: Timeout on files > 100MB  
**Workaround**: Increase axios timeout to 60000ms for conversion endpoints

## Dependencies and Constraints

### Critical Dependencies (Target)
- cornerstone-core: ^2.6.1 (DICOM rendering) - *To be installed*
- react-flow-renderer: ^10.3.0 (AI Canvas) - *To be installed*
- axios: ^1.6.0 (HTTP client) - *To be installed*
- zustand: ^4.4.0 (State management) - *To be installed*

### Currently Installed Dependencies
- react: ^19.1.1 (UI framework)
- express: ^5.1.0 (API server)
- socket.io: ^4.8.1 (WebSocket communication)
- openai: ^5.13.1 (AI integration)

### Browser Requirements
- Chrome 90+, Firefox 88+, Safari 14+
- WebGL support required for DICOM rendering
- WebSocket support required for real-time features

## Migration Progress

### Completed
- [x] Legacy code analysis and functionality mapping
- [x] New architecture design
- [x] API endpoint configuration file creation
- [ ] New dependencies installation
- [ ] Folder structure creation
- [ ] MainLayout implementation
- [ ] Patient Selection page
- [ ] Patient Data page
- [ ] Patient Assessment page
- [ ] Semi-Final Report page
- [ ] Final Report page

### Legacy Code Status
- Location: `src/legacy/`
- Usage: Reference only, gradually migrating functionality
- Deletion planned: After all features are migrated and tested

## Complete Refactoring Plan

## Immediate Next Steps (Phase 0)

### Step 0.1: Dependency Installation
```bash
npm install zustand @tanstack/react-query axios
npm install --save-dev @types/node typescript
```

### Step 0.2: TypeScript Configuration
Create `tsconfig.json` with strict mode enabled for medical application

### Step 0.3: Initial Folder Structure
Move legacy code and create new structure without breaking current functionality

### Phase 1: Foundation Structure Setup
- [ ] Install new dependencies (Zustand, React Query, Cornerstone.js, etc.)
- [ ] TypeScript configuration and type definitions
- [ ] Create new folder structure
- [ ] Routing setup (React Router)

### Phase 2: State Management and Services
- [ ] Zustand store setup
- [ ] React Query configuration
- [ ] API service layer implementation
- [ ] WebSocket service implementation

### Phase 3: Layout and Common Components
- [ ] MainLayout component implementation
- [ ] Common UI components implementation
- [ ] Common hooks implementation

### Phase 4: Page-by-Page Migration
- [ ] PatientSelection page (Priority: High)
- [ ] PatientData page (Priority: High)
- [ ] PatientAssessment page (Priority: Very High, most complex)
- [ ] SemiFinalReport page (Priority: Medium)
- [ ] FinalReport page (Priority: Medium)

### Phase 5: Integration and Optimization
- [ ] Full integration testing
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation completion

## Team Communication

### Code Review Checklist
- [ ] TypeScript types properly defined
- [ ] Error boundaries implemented
- [ ] Loading states handled
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Medical data properly sanitized

### Naming Conventions
- Components: PascalCase
- Hooks: camelCase with 'use' prefix
- Services: camelCase with 'Service' suffix
- Types/Interfaces: PascalCase with 'I' prefix for interfaces

## Common UI/UX Patterns

### Layout Structure (All Pages)
```typescript
<MainLayout>
  <TopHeader />           // Fixed: App logo, user info, settings
  <SidePanel />          // Fixed: Navigation, patient context
  <PatientInfoContainer /> // Fixed: Current patient details
  <MainContainer>        // Dynamic: Page-specific content
    {/* Page content */}
  </MainContainer>
  <Footer               // Fixed: Navigation buttons
    backLabel={customBack}
    nextLabel={customNext}
  />
</MainLayout>
```

### Page-Specific Footer Labels
```typescript
const footerConfig = {
  PatientSelection: { back: null, next: "Select Patient" },
  PatientData: { back: "Patient List", next: "AI Analysis" },
  PatientAssessment: { back: "Doctor Data", next: "Review Report" },
  SemiFinalReport: { back: "AI Analysis", next: "Final Review" },
  FinalReport: { back: "Edit Report", next: "Complete" }
};
```

## Refactoring Steps Guide

### Phase 1: Foundation (Current)
```
Step 1.1: Create folder structure
Step 1.2: Implement MainLayout
Step 1.3: Setup routing
```

### Phase 2: Core Pages
```
Step 2.1: Patient Selection page
Step 2.2: Patient Data page
Step 2.3: Patient Assessment page
Step 2.4: Semi-Final Report page
Step 2.5: Final Report page
```

### Phase 3: Service Integration
```
Step 3.1: HTTP client setup
Step 3.2: WebSocket client setup
Step 3.3: Python backend services
Step 3.4: WebSocket services
```

### Phase 4: Feature Implementation
```
Step 4.1: DICOM viewer integration
Step 4.2: AI Canvas implementation
Step 4.3: Chatbot integration
Step 4.4: Report generation
```

### Phase 5: State Management
```
Step 5.1: Zustand store setup
Step 5.2: Patient state management
Step 5.3: Analysis state management
Step 5.4: Report state management
```

## Error Handling Patterns

### API Error Handler
```typescript
const handleApiError = (error: AxiosError) => {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 500) {
    // Show server error message
  } else if (error.code === 'ECONNABORTED') {
    // Handle timeout
  }
  // Log to monitoring service
};
```

### WebSocket Reconnection
```typescript
class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.connect();
        this.reconnectAttempts++;
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
    }
  }
}
```

## Data Models

### Patient Model
```typescript
interface IPatient {
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
```

### Analysis Model
```typescript
interface IAnalysis {
  id: string;
  patientId: string;
  timestamp: Date;
  aiPredictions: IAIPrediction[];
  features: IFeature[];
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}
```

### Report Model
```typescript
interface IReport {
  id: string;
  analysisId: string;
  summary: string;
  findings: IFinding[];
  conclusion: string;
  recommendations: string[];
  keywords: string[];
  editHistory: IEditRecord[];
}
```

## Monitoring and Logging

### Client-Side Logging
```typescript
// Use structured logging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
    // Send to monitoring service
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error);
    // Send to error tracking service
  }
};
```

### Performance Monitoring
```typescript
// Track key metrics
const metrics = {
  pageLoadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
  apiResponseTime: endTime - startTime,
  renderTime: performance.measure('render'),
  memoryUsage: performance.memory?.usedJSHeapSize
};
```

## References

### External Documentation
- [Cornerstone.js Documentation](https://docs.cornerstonejs.org/)
- [React Flow Documentation](https://reactflow.dev/)
- [DICOM Standard](https://www.dicomstandard.org/)
- [HL7 FHIR](https://www.hl7.org/fhir/)

### Internal Documentation
- API Specification: `/docs/api/README.md`
- WebSocket Protocol: `/docs/websocket/protocol.md`
- Medical Workflow: `/docs/medical/workflow.md`
- Security Guidelines: `/docs/security/guidelines.md`

## Deployment Notes

### Production Build
```bash
# Build optimized production bundle
npm run build

# Output structure
build/
├── static/
│   ├── css/
│   ├── js/
│   └── media/
├── index.html
└── asset-manifest.json
```

### Docker Deployment
```dockerfile
# Multi-stage build
FROM node:18 as frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.9 as backend
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .

FROM nginx:alpine
COPY --from=frontend-build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
```

## Contact and Support

### Technical Lead
- Architecture decisions
- Code review final approval
- Production deployment

### Medical Domain Expert
- Workflow validation
- Medical terminology
- Regulatory compliance

### DevOps Support
- Infrastructure setup
- CI/CD pipeline
- Monitoring configuration

## Legacy Code Migration Guide

### Migration Priority
1. **PatientSelection** (225 lines) - Relatively simple
2. **PatientDataView** - Data display logic
3. **PatientAssessment** (4474 lines) - Most complex, AI chat, video processing
4. **FinalReport** - Report generation logic
5. **PatientDetail** - Detail information display

### PatientAssessment Component Breakdown Strategy
Given the 4474 lines of code, break down into:

1. **AI Chat Module** (~800 lines)
   - Chat interface
   - Message handling
   - WebSocket connection
   
2. **Video Processing Module** (~600 lines)
   - NPZ to MP4 conversion
   - Video player controls
   - Frame extraction
   
3. **Structured Data Editor** (~1000 lines)
   - Form components
   - Validation logic
   - Auto-save functionality
   
4. **AI Canvas Module** (~1200 lines)
   - Visualization components
   - Drag-and-drop interface
   - Data flow management
   
5. **Shared Utilities** (~874 lines)
   - Common functions
   - Data transformations
   - API calls

### Important Notes
- PatientAssessment component is 4474 lines and extremely complex
- Contains multiple features: AI chat, video processing, structured data editing
- WebSocket connection and OpenAI API integration are core features
- Requires step-by-step feature separation for migration

### Technical Challenges
- Large video file processing (NPZ → MP4 conversion)
- Real-time AI chat (WebSocket + OpenAI)
- Complex state management (patient data, AI analysis results, edit states)
- Medical data security and HIPAA compliance

## Risk Management

### High Risk Areas
1. **PatientAssessment Migration**
   - Risk: Breaking critical functionality
   - Mitigation: Feature-by-feature migration with parallel testing
   
2. **WebSocket Connection**
   - Risk: Real-time features disruption
   - Mitigation: Keep existing Socket.io until new implementation tested

3. **Video Processing**
   - Risk: Performance degradation
   - Mitigation: Benchmark before/after migration

## Success Metrics

### Performance Benchmarks
- [ ] PatientAssessment load time < 2s (currently: measure baseline)
- [ ] Video conversion time unchanged or improved
- [ ] WebSocket latency < 100ms maintained
- [ ] Bundle size reduced by 20%

### Code Quality Metrics
- [ ] TypeScript coverage: 100%
- [ ] Test coverage: > 80%
- [ ] No any types in production code
- [ ] All components < 300 lines

## Getting Started with Refactoring

### Current Situation
- Legacy code is in `src/legacy/` with PatientAssessment.js being 4474 lines
- Socket.io and OpenAI are already implemented
- Need to migrate to TypeScript with new architecture

### Step 1: Install Required Dependencies and Set Up TypeScript
Please help me:
1. Install zustand, react-query, axios, and TypeScript dependencies
2. Create tsconfig.json with appropriate settings for medical application
3. Create the new folder structure while keeping legacy code working
4. Set up path aliases for cleaner imports

**Important**: The legacy code must continue working during migration.

---
**Last Updated**: 2024-01-15  
**Next Review**: Weekly during active development  
**Version**: 1.0.0