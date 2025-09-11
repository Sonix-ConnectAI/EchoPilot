// Message handler utilities for EchoPilot AI
export const MESSAGE_TYPES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  ERROR: 'error'
};

export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  STREAMING: 'streaming'
};

export function createMessage(role, content, metadata = {}) {
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    role,
    content,
    timestamp: new Date(),
    status: MESSAGE_STATUS.SENT,
    ...metadata
  };
}

export function parseStreamChunk(chunk) {
  try {
    if (typeof chunk === 'string') {
      return { content: chunk, done: false };
    }
    
    return {
      content: chunk.content || '',
      done: chunk.done || false,
      metadata: chunk.metadata || {}
    };
  } catch (error) {
    console.error('Error parsing stream chunk:', error);
    return { content: '', done: true, error: true };
  }
}

export function formatExecutionResult(result) {
  const { tool, output, error, executionTime } = result;
  
  if (error) {
    return {
      type: 'error',
      message: `Error executing ${tool}: ${error}`,
      details: result
    };
  }
  
  return {
    type: 'success',
    message: `Successfully executed ${tool}`,
    output,
    executionTime,
    details: result
  };
}

export function parseAIResponse(data) {
  return {
    chatMessage: data.chat_message,
    visualization: data.visualization,
    metadata: data.metadata,
    timestamp: data.timestamp,
    id: data.id
  };
}

export function createVisualizationContent(visualization) {
  if (!visualization.needed) {
    return null;
  }

  return {
    type: visualization.type || 'other',
    html: visualization.html_content,
    title: visualization.title,
    description: visualization.description
  };
}

// Generate medical-specific example HTML content
export function generateMedicalHTML(type = 'patient-report') {
  switch (type) {
    case 'patient-report':
      return {
        type: 'report',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>Patient Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #5C6BC0; color: white; padding: 15px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .section h3 { color: #5C6BC0; }
        .vital { display: inline-block; margin: 10px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
        .vital span { display: block; font-size: 24px; font-weight: bold; color: #333; }
        .vital label { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Patient Assessment Report</h1>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
    </div>
    <div class="section">
        <h3>Patient Information</h3>
        <p><strong>Name:</strong> [Patient Name]</p>
        <p><strong>Age:</strong> [Patient Age]</p>
        <p><strong>Condition:</strong> [Patient Condition]</p>
    </div>
    <div class="section">
        <h3>Cardiac Parameters</h3>
        <div class="vital">
            <span>72</span>
            <label>Heart Rate (bpm)</label>
        </div>
        <div class="vital">
            <span>120/80</span>
            <label>Blood Pressure (mmHg)</label>
        </div>
        <div class="vital">
            <span>60%</span>
            <label>EF (%)</label>
        </div>
    </div>
    <div class="section">
        <h3>Echocardiography Findings</h3>
        <ul>
            <li>Left ventricle: Normal size and function</li>
            <li>Right ventricle: Normal size and function</li>
            <li>Valves: No significant abnormalities</li>
            <li>Pericardium: No effusion</li>
        </ul>
    </div>
</body>
</html>`,
        title: 'Patient Assessment Report',
        description: 'Complete patient cardiac assessment report'
      };
    
    case 'cardiac-chart':
      return {
        type: 'chart',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>Cardiac Parameters Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .chart-container { width: 600px; height: 400px; margin: 20px auto; }
        h2 { color: #5C6BC0; text-align: center; }
    </style>
</head>
<body>
    <h2>Cardiac Function Parameters</h2>
    <div class="chart-container">
        <canvas id="cardiacChart"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('cardiacChart').getContext('2d');
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['EF (%)', 'FS (%)', 'E/A Ratio', 'LVEDD (mm)', 'LVESD (mm)', 'LA Size (mm)'],
                datasets: [{
                    label: 'Current Values',
                    data: [60, 35, 1.2, 48, 32, 38],
                    backgroundColor: 'rgba(92, 107, 192, 0.2)',
                    borderColor: 'rgba(92, 107, 192, 1)',
                    borderWidth: 2
                }, {
                    label: 'Normal Range',
                    data: [65, 38, 1.5, 45, 30, 35],
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 10
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Echocardiographic Parameters Comparison'
                    }
                }
            }
        });
    </script>
</body>
</html>`,
        title: 'Cardiac Parameters Chart',
        description: 'Visual comparison of cardiac function parameters'
      };
    
    case 'findings-table':
      return {
        type: 'table',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>Echocardiography Findings</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h2 { color: #5C6BC0; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #5C6BC0; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .normal { color: green; font-weight: bold; }
        .abnormal { color: red; font-weight: bold; }
        .borderline { color: orange; font-weight: bold; }
    </style>
</head>
<body>
    <h2>Echocardiography Findings Summary</h2>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Normal Range</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Left Ventricular EF</td>
                <td>60%</td>
                <td>55-70%</td>
                <td class="normal">Normal</td>
            </tr>
            <tr>
                <td>LVEDD</td>
                <td>48 mm</td>
                <td>39-53 mm</td>
                <td class="normal">Normal</td>
            </tr>
            <tr>
                <td>LVESD</td>
                <td>32 mm</td>
                <td>25-35 mm</td>
                <td class="normal">Normal</td>
            </tr>
            <tr>
                <td>LA Diameter</td>
                <td>42 mm</td>
                <td>30-40 mm</td>
                <td class="borderline">Mildly Dilated</td>
            </tr>
            <tr>
                <td>Mitral E/A Ratio</td>
                <td>0.8</td>
                <td>1.0-2.0</td>
                <td class="borderline">Grade I DD</td>
            </tr>
            <tr>
                <td>TAPSE</td>
                <td>22 mm</td>
                <td>≥17 mm</td>
                <td class="normal">Normal</td>
            </tr>
        </tbody>
    </table>
    <div style="margin-top: 20px; padding: 15px; background: #f0f4ff; border-radius: 5px;">
        <h3>Interpretation:</h3>
        <p>Overall cardiac function is preserved with normal left ventricular systolic function. 
        Mild left atrial enlargement noted with Grade I diastolic dysfunction pattern.</p>
    </div>
</body>
</html>`,
        title: 'Echocardiography Findings Table',
        description: 'Detailed echocardiographic measurements and findings'
      };
    
    default:
      return {
        type: 'other',
        html: `<!DOCTYPE html>
<html>
<head>
    <title>Medical Content</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: linear-gradient(135deg, #5C6BC0 0%, #3949AB 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .container { text-align: center; }
        .highlight { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; }
        ul { text-align: left; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AI-Generated Medical Analysis</h1>
        <p>Advanced echocardiography assessment powered by AI</p>
        <div class="highlight">
            <h3>Key Features</h3>
            <ul>
                <li>Real-time cardiac parameter analysis</li>
                <li>Automated measurement calculations</li>
                <li>Pattern recognition for abnormalities</li>
                <li>Evidence-based recommendations</li>
            </ul>
        </div>
    </div>
</body>
</html>`,
        title: 'Medical Analysis',
        description: 'AI-generated medical content'
      };
  }
}