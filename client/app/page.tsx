/**
 * ============================================================================
 * IS-BST UNIVERSITY PORTAL - Main Page
 * ============================================================================
 * 
 * ARCHITECTURE: The Drive acts as the SERVICE ORCHESTRATOR
 * 
 * Each "folder" in the drive represents a MICROSERVICE:
 * - 📁 Finance Service    → CHECK_BALANCE, MAKE_PAYMENT, GET_FEES
 * - 📁 Academics Service  → GET_GRADES, UPLOAD_ASSIGNMENT, GET_TIMETABLE
 * - 📁 My Files           → UPLOAD_FILE, LIST_FILES, DELETE_FILE
 * 
 * Clicking a folder "launches" that service's interface.
 * This demonstrates how distributed systems can be orchestrated from a central UI.
 * 
 * ============================================================================
 */

"use client";

import { useState } from "react";

// Types
interface ServiceFolder {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'service';
  color: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: 'file' | 'folder';
  modified: string;
  status?: string;
}

// The distributed services represented as "folders"
const SERVICE_FOLDERS: ServiceFolder[] = [
  {
    id: 'finance',
    name: 'Finance Service',
    icon: '💰',
    description: 'Check balance, make payments, view fees',
    type: 'service',
    color: '#f59e0b'
  },
  {
    id: 'academics',
    name: 'Academics Service',
    icon: '📚',
    description: 'Grades, assignments, timetable',
    type: 'service',
    color: '#10b981'
  },
  {
    id: 'files',
    name: 'My Files',
    icon: '📁',
    description: 'Upload and manage documents',
    type: 'service',
    color: '#4a90d9'
  },
];

// Sample files for the Files service
const INITIAL_FILES: FileItem[] = [
  { id: '1', name: 'Documents', size: 0, type: 'folder', modified: '2024-12-14' },
  { id: '2', name: 'project_notes.txt', size: 2048, type: 'file', modified: '2024-12-12' },
];

export default function UniversityPortal() {
  // Navigation state
  const [currentView, setCurrentView] = useState<string>('home'); // 'home', 'finance', 'academics', 'files'
  const [status, setStatus] = useState<string>('Ready');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rpcLog, setRpcLog] = useState<string[]>([]);

  // Service-specific state
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [serviceResponse, setServiceResponse] = useState<Record<string, unknown> | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFilename, setUploadFilename] = useState<string>('');
  const [uploadContent, setUploadContent] = useState<string>('');

  /**
   * addLog - Adds entry to RPC activity log
   */
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setRpcLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  /**
   * callRpc - Makes RPC call through the stub
   */
  const callRpc = async (method: string, payload: Record<string, unknown>) => {
    addLog(`→ Calling ${method}...`);
    setIsLoading(true);
    setServiceResponse(null);

    try {
      const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, payload })
      });

      const data = await response.json();
      addLog(`← Response: ${data.status || 'OK'}`);
      setServiceResponse(data.result || data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`✗ Error: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * handleServiceClick - Opens a service "folder"
   */
  const handleServiceClick = (serviceId: string) => {
    setCurrentView(serviceId);
    setServiceResponse(null);
    setStatus(`Opened ${serviceId.charAt(0).toUpperCase() + serviceId.slice(1)} Service`);
  };

  /**
   * handleUpload - File upload handler
   */
  const handleUpload = async () => {
    if (!uploadFilename.trim()) {
      setStatus('Please enter a filename');
      return;
    }

    setStatus('Uploading...');
    try {
      const result = await callRpc('UPLOAD_FILE', {
        filename: uploadFilename,
        content: uploadContent || 'Sample file content'
      });

      if (result.status === 'OK') {
        const newFile: FileItem = {
          id: Date.now().toString(),
          name: uploadFilename,
          size: uploadContent.length || 20,
          type: 'file',
          modified: new Date().toISOString().split('T')[0],
          status: 'uploaded'
        };
        setFiles(prev => [...prev, newFile]);
        setStatus(`✓ Uploaded: ${uploadFilename}`);
        setShowUploadModal(false);
        setUploadFilename('');
        setUploadContent('');
      }
    } catch {
      setStatus('Error: Upload failed');
    }
  };

  /**
   * formatSize - Formats bytes to readable size
   */
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Render the home view (service folders)
   */
  const renderHomeView = () => (
    <div className="service-grid">
      <h2 className="section-title">University Portal Services</h2>
      <p className="section-subtitle">Click a folder to launch the distributed service</p>

      <div className="folders-grid">
        {SERVICE_FOLDERS.map((service) => (
          <div
            key={service.id}
            className="service-folder"
            onClick={() => handleServiceClick(service.id)}
            style={{ '--service-color': service.color } as React.CSSProperties}
          >
            <div className="folder-icon">{service.icon}</div>
            <div className="folder-info">
              <h3>{service.name}</h3>
              <p>{service.description}</p>
            </div>
            <div className="folder-arrow">→</div>
          </div>
        ))}
      </div>

      <div className="architecture-note">
        <h4>🔗 Distributed Architecture</h4>
        <p>Each folder connects to the <strong>RPC Server</strong> via TCP sockets.
          The server routes requests to the appropriate service handler.</p>
      </div>
    </div>
  );

  /**
   * Render Finance Service view
   */
  const renderFinanceView = () => (
    <div className="service-view finance">
      <div className="service-header">
        <button className="back-btn" onClick={() => setCurrentView('home')}>← Back</button>
        <h2>💰 Finance Service</h2>
      </div>

      <div className="service-actions">
        <button
          className="service-btn"
          onClick={() => callRpc('CHECK_BALANCE', { student_id: 'STU001' })}
          disabled={isLoading}
        >
          Check Balance
        </button>
        <button
          className="service-btn"
          onClick={() => callRpc('GET_FEES_STATEMENT', { student_id: 'STU001' })}
          disabled={isLoading}
        >
          Fees Statement
        </button>
        <button
          className="service-btn"
          onClick={() => callRpc('MAKE_PAYMENT', { student_id: 'STU001', amount: 50000, description: 'Lab Fee' })}
          disabled={isLoading}
        >
          Make Payment (₦50,000)
        </button>
      </div>

      {serviceResponse && (
        <div className="response-panel">
          <h4>RPC Response:</h4>
          <pre>{JSON.stringify(serviceResponse, null, 2)}</pre>
        </div>
      )}
    </div>
  );

  /**
   * Render Academics Service view
   */
  const renderAcademicsView = () => (
    <div className="service-view academics">
      <div className="service-header">
        <button className="back-btn" onClick={() => setCurrentView('home')}>← Back</button>
        <h2>📚 Academics Service</h2>
      </div>

      <div className="service-actions">
        <button
          className="service-btn"
          onClick={() => callRpc('GET_GRADES', { student_id: 'STU001' })}
          disabled={isLoading}
        >
          View Grades
        </button>
        <button
          className="service-btn"
          onClick={() => callRpc('GET_TIMETABLE', { student_id: 'STU001' })}
          disabled={isLoading}
        >
          View Timetable
        </button>
        <button
          className="service-btn"
          onClick={() => callRpc('UPLOAD_ASSIGNMENT', {
            student_id: 'STU001',
            course: 'CS401',
            filename: 'assignment1.pdf',
            content: 'Sample assignment content'
          })}
          disabled={isLoading}
        >
          Submit Assignment
        </button>
      </div>

      {serviceResponse && (
        <div className="response-panel">
          <h4>RPC Response:</h4>
          <pre>{JSON.stringify(serviceResponse, null, 2)}</pre>
        </div>
      )}
    </div>
  );

  /**
   * Render Files Service view
   */
  const renderFilesView = () => (
    <div className="service-view files">
      <div className="service-header">
        <button className="back-btn" onClick={() => setCurrentView('home')}>← Back</button>
        <h2>📁 My Files</h2>
        <button
          className="upload-btn"
          onClick={() => setShowUploadModal(true)}
        >
          + Upload
        </button>
      </div>

      <div className="file-list">
        <div className="file-list-header">
          <span className="col-name">Name</span>
          <span className="col-modified">Modified</span>
          <span className="col-size">Size</span>
        </div>

        {files.map((file) => (
          <div key={file.id} className={`file-item ${file.status === 'uploaded' ? 'new' : ''}`}>
            <span className="col-name">
              <span className="file-icon">{file.type === 'folder' ? '📁' : '📄'}</span>
              {file.name}
            </span>
            <span className="col-modified">{file.modified}</span>
            <span className="col-size">{formatSize(file.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Get current view title
   */
  const getViewTitle = () => {
    switch (currentView) {
      case 'finance': return 'Finance Service';
      case 'academics': return 'Academics Service';
      case 'files': return 'My Files';
      default: return 'IS-BST University Portal';
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo" onClick={() => setCurrentView('home')} style={{ cursor: 'pointer' }}>
            <span className="logo-icon">🎓</span>
            <span>{getViewTitle()}</span>
          </div>
        </div>
        <div className="header-right">
          <button
            className="ping-btn"
            onClick={() => callRpc('PING', {})}
            disabled={isLoading}
          >
            🔌 Test Connection
          </button>
          <span className={`status-badge ${isLoading ? 'loading' : ''}`}>
            {status}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Content Area */}
        <section className="content-area">
          {currentView === 'home' && renderHomeView()}
          {currentView === 'finance' && renderFinanceView()}
          {currentView === 'academics' && renderAcademicsView()}
          {currentView === 'files' && renderFilesView()}
        </section>

        {/* RPC Activity Log */}
        <aside className="activity-log">
          <h3>RPC Activity Log</h3>
          <p className="log-subtitle">TCP socket communication</p>
          <div className="log-entries">
            {rpcLog.length === 0 ? (
              <p className="log-empty">Click a service to see RPC traffic</p>
            ) : (
              rpcLog.map((entry, i) => (
                <div key={i} className="log-entry">{entry}</div>
              ))
            )}
          </div>
          <div className="log-legend">
            <p><strong>→</strong> = Request to server (TCP)</p>
            <p><strong>←</strong> = Response received</p>
            <p><strong>✗</strong> = Error occurred</p>
          </div>
        </aside>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Upload File</h2>
            <p className="modal-subtitle">This sends an RPC request to the server</p>

            <div className="form-group">
              <label>Filename</label>
              <input
                type="text"
                value={uploadFilename}
                onChange={(e) => setUploadFilename(e.target.value)}
                placeholder="example.txt"
              />
            </div>

            <div className="form-group">
              <label>Content (optional)</label>
              <textarea
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                placeholder="Enter file content..."
                rows={4}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleUpload} disabled={isLoading}>
                {isLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
