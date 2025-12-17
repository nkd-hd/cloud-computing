/**
 * ============================================================================
 * GOOGLE DRIVE CLONE - Main Page (Frontend UI)
 * ============================================================================
 * 
 * This component demonstrates LOCATION TRANSPARENCY:
 * The user clicks "Upload" → fetch('/api/rpc') → TCP Socket → RPC Server
 * 
 * From the user's perspective, it's just clicking a button.
 * From the code's perspective, it's just calling fetch().
 * The complexity of sockets, marshalling, and queues is HIDDEN.
 * 
 * ============================================================================
 */

"use client";

import { useState, useEffect } from "react";

// Types for our file system
interface FileItem {
  id: string;
  name: string;
  size: number;
  type: 'file' | 'folder';
  modified: string;
  status?: string;
}

// Mock initial files (in production, fetch from Convex)
const initialFiles: FileItem[] = [
  { id: '1', name: 'Documents', size: 0, type: 'folder', modified: '2024-12-14' },
  { id: '2', name: 'Photos', size: 0, type: 'folder', modified: '2024-12-13' },
  { id: '3', name: 'project_notes.txt', size: 2048, type: 'file', modified: '2024-12-12' },
];

export default function DrivePage() {
  // State management
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [status, setStatus] = useState<string>('Ready');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [uploadContent, setUploadContent] = useState<string>('');
  const [uploadFilename, setUploadFilename] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [rpcLog, setRpcLog] = useState<string[]>([]);

  /**
   * addLog - Adds an entry to the RPC activity log
   * This helps demonstrate what's happening behind the scenes
   */
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setRpcLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  /**
   * callRpc - The "local" function that triggers remote procedure calls
   * 
   * CONCEPT: This is where LOCATION TRANSPARENCY happens!
   * The developer calls callRpc() like any other async function.
   * They don't need to know about TCP sockets or marshalling.
   */
  const callRpc = async (method: string, payload: Record<string, unknown>) => {
    addLog(`→ Calling RPC: ${method}`);
    setIsLoading(true);

    try {
      /**
       * This fetch() goes to our API route (the STUB)
       * The stub handles all the TCP socket complexity
       */
      const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, payload })
      });

      const data = await response.json();

      addLog(`← Response: ${data.status || 'OK'}`);
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
   * handleFileSelect - Reads a file from the user's computer
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFilename(file.name);
    try {
      // For this demo, we treat all files as text
      // In a real app, you'd use Base64 for binary files
      const text = await file.text();
      setUploadContent(text);
    } catch (err) {
      console.error(err);
      setUploadContent('Error reading file content');
    }
  };

  /**
   * handleUpload - Simulates file upload via RPC
   */
  const handleUpload = async () => {
    if (!uploadFilename.trim()) {
      setStatus('Please enter a filename');
      return;
    }

    setStatus('Uploading...');
    addLog('Starting file upload...');

    try {
      const result = await callRpc('UPLOAD_FILE', {
        filename: uploadFilename,
        content: uploadContent || 'Sample file content'
      });

      if (result.status === 'OK') {
        // Add the new file to our list
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
      } else {
        setStatus(`Error: ${result.error || 'Upload failed'}`);
      }
    } catch {
      setStatus('Error: Failed to connect to RPC server');
    }
  };

  /**
   * handlePing - Tests connection to RPC server
   */
  const handlePing = async () => {
    setStatus('Pinging server...');
    addLog('Sending PING request...');

    try {
      const result = await callRpc('PING', {});

      if (result.status === 'OK' && result.result) {
        const uptime = Math.round(result.result.uptime);
        setStatus(`✓ Server alive! Uptime: ${uptime}s`);
      } else {
        setStatus('Server responded with error');
      }
    } catch {
      setStatus('✗ Server not reachable');
    }
  };

  /**
   * handleDelete - Deletes a file via RPC
   */
  const handleDelete = async (filename: string) => {
    setStatus(`Deleting ${filename}...`);
    addLog(`Deleting file: ${filename}`);

    try {
      const result = await callRpc('DELETE_FILE', { filename });

      if (result.status === 'OK') {
        setFiles(prev => prev.filter(f => f.name !== filename));
        setStatus(`✓ Deleted: ${filename}`);
        setSelectedFile(null);
      }
    } catch {
      setStatus('Error: Delete failed');
    }
  };

  /**
   * formatSize - Formats bytes to human readable size
   */
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <svg width="40" height="40" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
            </svg>
            <span>Drive Clone</span>
          </div>
        </div>
        <div className="header-right">
          <span className={`status-badge ${isLoading ? 'loading' : ''}`}>
            {status}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <button
            className="new-button"
            onClick={() => setShowUploadModal(true)}
          >
            <span className="plus-icon">+</span>
            New
          </button>

          <nav className="nav-menu">
            <a href="#" className="nav-item active">
              <span className="nav-icon">📁</span>
              My Drive
            </a>
            <a href="#" className="nav-item">
              <span className="nav-icon">🗑️</span>
              Trash
            </a>
          </nav>

          <div className="storage-info">
            <div className="storage-bar">
              <div className="storage-used" style={{ width: '35%' }}></div>
            </div>
            <span>5.2 GB of 15 GB used</span>
          </div>
        </aside>

        {/* Files Area */}
        <section className="files-section">
          {/* Toolbar */}
          <div className="toolbar">
            <h2>My Drive</h2>
            <div className="toolbar-actions">
              <button
                className="action-btn"
                onClick={handlePing}
                disabled={isLoading}
              >
                🔌 Test Connection
              </button>
              <button
                className="action-btn primary"
                onClick={() => setShowUploadModal(true)}
                disabled={isLoading}
              >
                ⬆️ Upload File
              </button>
            </div>
          </div>

          {/* File List */}
          <div className="file-list">
            <div className="file-list-header">
              <span className="col-name">Name</span>
              <span className="col-modified">Modified</span>
              <span className="col-size">Size</span>
              <span className="col-actions"></span>
            </div>

            {files.map((file) => (
              <div
                key={file.id}
                className={`file-item ${selectedFile === file.id ? 'selected' : ''} ${file.status === 'uploaded' ? 'new' : ''}`}
                onClick={() => setSelectedFile(file.id)}
              >
                <span className="col-name">
                  <span className="file-icon">
                    {file.type === 'folder' ? '📁' : '📄'}
                  </span>
                  {file.name}
                </span>
                <span className="col-modified">{file.modified}</span>
                <span className="col-size">{formatSize(file.size)}</span>
                <span className="col-actions">
                  {file.type === 'file' && (
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.name);
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* RPC Activity Log */}
        <aside className="activity-log">
          <h3>RPC Activity Log</h3>
          <p className="log-subtitle">Behind the scenes communication</p>
          <div className="log-entries">
            {rpcLog.length === 0 ? (
              <p className="log-empty">No activity yet. Try uploading a file!</p>
            ) : (
              rpcLog.map((entry, i) => (
                <div key={i} className="log-entry">{entry}</div>
              ))
            )}
          </div>
          <div className="log-legend">
            <p><strong>→</strong> = Request sent to server</p>
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
            <p className="modal-subtitle">This will send an RPC request to the server</p>

            <div className="form-group">
              <label>Choose File (from computer)</label>
              <input
                type="file"
                onChange={handleFileSelect}
                style={{ padding: '8px 0', fontSize: '0.9rem' }}
              />
            </div>

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
              <button
                className="btn-secondary"
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={isLoading}
              >
                {isLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
