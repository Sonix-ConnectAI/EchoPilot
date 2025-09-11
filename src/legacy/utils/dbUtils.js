// Database utilities for fetching exam data and view_attention

let cachedDb = null;
let dbLoadPromise = null;

// Load and cache the database JSON
const loadDatabase = async () => {
  if (cachedDb) return cachedDb;
  
  if (dbLoadPromise) return dbLoadPromise;
  
  dbLoadPromise = (async () => {
    try {
      // Try to get DB path from environment or use default
      const dbPath = process.env.REACT_APP_DB_JSON_PATH || '/DB_json/eval_result-attn-50-3_local.json';
      
      const response = await fetch(dbPath);
      if (!response.ok) {
        throw new Error(`Failed to load database: ${response.status}`);
      }
      
      const data = await response.json();
      cachedDb = data;
      return data;
    } catch (error) {
      console.error('❌ Error loading database:', error);
      cachedDb = {};
      return {};
    }
  })();
  
  return dbLoadPromise;
};

// Get exam entry by ID
export const getExamEntryById = async (examId) => {
  if (!examId) {
    console.warn('⚠️ No examId provided');
    return null;
  }
  
  const db = await loadDatabase();
  
  // Search through all entries for matching exam_id
  for (const [key, entry] of Object.entries(db)) {
    if (entry && entry.exam_id === examId) {
      return entry;
    }
  }
  
  console.log('❌ No exam entry found for:', examId);
  return null;
};

// Get view attention data for an exam
export const getViewAttention = async (examId) => {
  const entry = await getExamEntryById(examId);
  
  if (!entry || !entry.view_attention) {
    return null;
  }
  
  return entry.view_attention;
};

// Map view names to standard echocardiography views
const viewNameMapping = {
  'PLAX': 'PLAX View',
  'PSAX_A': 'PSAX Aortic',
  'PSAX_M': 'PSAX Mitral',
  'PSAX_P': 'PSAX Papillary',
  'A4C': 'Apical 4CH',
  'A2C': 'Apical 2CH',
  'A3C': 'Apical 3CH',
  'SC': 'Subcostal',
  // Additional mappings
  'PLAX View': 'PLAX View',
  'PSAX Aortic': 'PSAX Aortic',
  'PSAX Mitral': 'PSAX Mitral',
  'PSAX Papillary': 'PSAX Papillary',
  'Apical 4CH': 'Apical 4CH',
  'Apical 2CH': 'Apical 2CH',
  'Apical 3CH': 'Apical 3CH',
  'Subcostal': 'Subcostal'
};

// Normalize view name
export const normalizeViewName = (viewName) => {
  if (!viewName) return viewName;
  
  // Try direct mapping
  const mapped = viewNameMapping[viewName];
  if (mapped) return mapped;
  
  // Try case-insensitive match
  const upperView = viewName.toUpperCase();
  for (const [key, value] of Object.entries(viewNameMapping)) {
    if (key.toUpperCase() === upperView) {
      return value;
    }
  }
  
  // Return original if no mapping found
  return viewName;
};

// Get top views based on view_attention weights
export const getTopViewsFromAttention = (viewAttention, maxN = 3) => {
  if (!viewAttention || typeof viewAttention !== 'object') {
    return [];
  }
  
  // Convert to array and sort by weight
  const viewArray = Object.entries(viewAttention)
    .map(([view, weight]) => ({
      view: normalizeViewName(view),
      weight: parseFloat(weight) || 0,
      originalView: view
    }))
    .filter(item => item.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  
  // Return top N views
  return viewArray.slice(0, maxN);
};

// Get video segments for specific views
export const getVideoSegmentsForViews = async (examEntry, viewNames) => {
  if (!examEntry || !viewNames || viewNames.length === 0) {
    return [];
  }
  
  const videoNpz = examEntry.video_npz;
  if (!videoNpz || !Array.isArray(videoNpz)) {
    return [];
  }
  
  // Map view names to video indices (assuming order matches)
  const viewToIndex = {
    'PLAX View': 0,
    'PSAX Aortic': 1,
    'PSAX Mitral': 2,
    'PSAX Papillary': 3,
    'Apical 4CH': 4,
    'Apical 2CH': 5,
    'Apical 3CH': 6,
    'Subcostal': 7
  };
  
  const segments = [];
  
  for (const viewName of viewNames) {
    const normalizedView = normalizeViewName(viewName);
    const index = viewToIndex[normalizedView];
    
    if (index !== undefined && videoNpz[index]) {
      segments.push({
        view: normalizedView,
        index: index,
        npzPath: videoNpz[index],
        // Additional metadata can be added here
      });
    }
  }
  
  return segments;
};

// Clear cached database (useful for testing)
export const clearDbCache = () => {
  cachedDb = null;
  dbLoadPromise = null;
};