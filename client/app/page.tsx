/**
 * ============================================================================
 * IS-BST CLOUD STORAGE - Presentation Demo
 * ============================================================================
 * 
 * Features for presentation:
 * 1. Account creation & OTP login
 * 2. Storage quota display
 * 3. Folder management (CRUD)
 * 4. File chunking visualization
 * 5. Security/encryption demonstration
 * 
 * ============================================================================
 */

"use client";

import { useState, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: 'file' | 'folder';
  modified: string;
  parentId: string | null;
  chunks?: ChunkInfo[];
  encrypted?: boolean;
}

interface ChunkInfo {
  id: string;
  index: number;
  size: number;
  hash: string;
  encrypted: boolean;
  uploadedAt?: string;
}

interface User {
  email: string;
  name: string;
  storageQuota: number; // in bytes
  storageUsed: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const STORAGE_QUOTA = 100 * 1024 * 1024; // 100MB

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CloudStorage() {
  // Auth state
  const [authStep, setAuthStep] = useState<'login' | 'otp' | 'authenticated'>('login');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [user, setUser] = useState<User | null>(null);

  // File system state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  // UI state
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number, chunks: ChunkInfo[] } | null>(null);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const generateHash = (data: string): string => {
    // Simple hash simulation for demo
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  };

  const simulateEncrypt = (data: string): string => {
    // Simple "encryption" visualization using hex encoding (avoids btoa issues)
    const encrypted = data.slice(0, 16).split('').map((c, i) =>
      ((c.charCodeAt(0) ^ (i * 17 + 42)) % 256).toString(16).padStart(2, '0')
    ).join('');
    return encrypted.toUpperCase() + '...'
  };

  // ============================================================================
  // AUTH HANDLERS
  // ============================================================================

  const handleSendOtp = () => {
    if (!email.includes('@')) {
      setStatus('Please enter a valid email');
      return;
    }

    // Generate a real 6-digit OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);

    addLog(`→ Sending OTP to ${email}...`);
    addLog(`← OTP generated: ${newOtp}`);
    addLog(`📧 (In production, this would be emailed)`);
    addLog(`🔐 OTP valid for 5 minutes`);
    setAuthStep('otp');
    setStatus('OTP generated! Check the Activity Log');
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setStatus('Please enter a 6-digit OTP');
      return;
    }

    addLog(`→ Verifying OTP: ${otp}`);

    if (otp !== generatedOtp) {
      addLog(`✗ Invalid OTP! Expected: ${generatedOtp}`);
      setStatus('Invalid OTP. Check the Activity Log for the correct code.');
      return;
    }

    addLog(`← OTP verified successfully ✓`);
    addLog(`🔐 Session token generated`);

    setUser({
      email,
      name: email.split('@')[0],
      storageQuota: STORAGE_QUOTA,
      storageUsed: 0
    });
    setAuthStep('authenticated');
    setStatus('Welcome to IS-BST Cloud Storage!');
  };

  // ============================================================================
  // FILE SYSTEM HANDLERS
  // ============================================================================

  const getCurrentFiles = (): FileItem[] => {
    return files.filter(f => f.parentId === currentFolderId);
  };

  const getBreadcrumbs = (): { id: string | null, name: string }[] => {
    const crumbs: { id: string | null, name: string }[] = [{ id: null, name: 'Root' }];
    let current = currentFolderId;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);
      const folder = files.find(f => f.id === current);
      if (folder) {
        crumbs.splice(1, 0, { id: folder.id, name: folder.name });
        current = folder.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      setStatus('Please enter a folder name');
      return;
    }

    addLog(`→ Creating folder: ${newFolderName}`);

    const newFolder: FileItem = {
      id: `folder_${Date.now()}`,
      name: newFolderName,
      size: 0,
      type: 'folder',
      modified: new Date().toISOString().split('T')[0],
      parentId: currentFolderId
    };

    setFiles(prev => [...prev, newFolder]);
    addLog(`← Folder created successfully`);
    setShowNewFolderModal(false);
    setNewFolderName('');
    setStatus(`Created folder: ${newFolderName}`);
  };

  const handleNavigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedFile(null);
  };

  const handleDeleteFile = (file: FileItem) => {
    addLog(`→ Deleting: ${file.name}`);

    if (file.type === 'folder') {
      // Delete folder and all contents
      const idsToDelete = new Set<string>([file.id]);
      let changed = true;
      while (changed) {
        changed = false;
        files.forEach(f => {
          if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
            idsToDelete.add(f.id);
            changed = true;
          }
        });
      }
      setFiles(prev => prev.filter(f => !idsToDelete.has(f.id)));
    } else {
      setFiles(prev => prev.filter(f => f.id !== file.id));
      if (user) {
        setUser({ ...user, storageUsed: user.storageUsed - file.size });
      }
    }

    addLog(`← Deleted successfully`);
    setSelectedFile(null);
  };

  // ============================================================================
  // CHUNKED UPLOAD WITH ENCRYPTION
  // ============================================================================

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setShowUploadModal(false);

    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    addLog(`📁 Starting upload: ${file.name} (${formatBytes(fileSize)})`);
    addLog(`🔪 Splitting into ${totalChunks} chunks of ${formatBytes(CHUNK_SIZE)} each`);
    addLog(`🔐 Applying AES-256 encryption to each chunk...`);

    const chunks: ChunkInfo[] = [];
    const reader = new FileReader();

    reader.onload = async () => {
      const content = reader.result as string;

      // Process chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunkData = content.substring(start, end);

        const chunkInfo: ChunkInfo = {
          id: `chunk_${Date.now()}_${i}`,
          index: i,
          size: end - start,
          hash: generateHash(chunkData),
          encrypted: true,
          uploadedAt: new Date().toISOString()
        };

        chunks.push(chunkInfo);

        // Update progress
        setUploadProgress({
          current: i + 1,
          total: totalChunks,
          chunks: [...chunks]
        });

        // Log chunk processing
        addLog(`  📦 Chunk ${i + 1}/${totalChunks}: ${formatBytes(chunkInfo.size)}`);
        addLog(`     Hash: ${chunkInfo.hash}`);
        addLog(`     Encrypted: ${simulateEncrypt(chunkData)}`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Create file record
      const newFile: FileItem = {
        id: `file_${Date.now()}`,
        name: file.name,
        size: fileSize,
        type: 'file',
        modified: new Date().toISOString().split('T')[0],
        parentId: currentFolderId,
        chunks: chunks,
        encrypted: true
      };

      setFiles(prev => [...prev, newFile]);

      if (user) {
        setUser({ ...user, storageUsed: user.storageUsed + fileSize });
      }

      addLog(`✅ Upload complete: ${file.name}`);
      addLog(`🔗 ${chunks.length} chunks distributed across storage nodes`);
      addLog(`🔐 All chunks encrypted with AES-256`);

      setUploadProgress(null);
      setIsLoading(false);
      setStatus(`Uploaded: ${file.name}`);
    };

    reader.readAsText(file);
  };

  const handleGenerateLargeFile = async () => {
    if (!user) return;

    const targetSize = Math.floor(STORAGE_QUOTA * 0.9); // 90MB
    const fileName = 'large_dataset.bin';

    setIsLoading(true);
    addLog(`📁 Generating ${formatBytes(targetSize)} test file...`);
    addLog(`🔪 This will fill ~90% of your storage quota`);

    const totalChunks = Math.ceil(targetSize / CHUNK_SIZE);
    const chunks: ChunkInfo[] = [];

    addLog(`🔐 Encrypting and distributing ${totalChunks} chunks...`);

    for (let i = 0; i < totalChunks; i++) {
      const chunkSize = Math.min(CHUNK_SIZE, targetSize - (i * CHUNK_SIZE));
      const chunkData = 'X'.repeat(Math.min(1000, chunkSize)); // Simulated data

      const chunkInfo: ChunkInfo = {
        id: `chunk_${Date.now()}_${i}`,
        index: i,
        size: chunkSize,
        hash: generateHash(chunkData + i),
        encrypted: true,
        uploadedAt: new Date().toISOString()
      };

      chunks.push(chunkInfo);

      setUploadProgress({
        current: i + 1,
        total: totalChunks,
        chunks: [...chunks]
      });

      if (i % 10 === 0 || i === totalChunks - 1) {
        addLog(`  📦 Chunk ${i + 1}/${totalChunks} distributed (Node ${(i % 3) + 1})`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const newFile: FileItem = {
      id: `file_${Date.now()}`,
      name: fileName,
      size: targetSize,
      type: 'file',
      modified: new Date().toISOString().split('T')[0],
      parentId: currentFolderId,
      chunks: chunks,
      encrypted: true
    };

    setFiles(prev => [...prev, newFile]);
    setUser({ ...user, storageUsed: user.storageUsed + targetSize });

    addLog(`✅ File generated: ${fileName}`);
    addLog(`📊 Storage now at ${((user.storageUsed + targetSize) / STORAGE_QUOTA * 100).toFixed(1)}%`);

    setUploadProgress(null);
    setIsLoading(false);
    setStatus(`Generated: ${fileName} (${formatBytes(targetSize)})`);
  };

  // ============================================================================
  // RENDER: LOGIN SCREEN
  // ============================================================================

  if (authStep !== 'authenticated') {
    return (
      <div className="app-container">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-logo">🎓</div>
            <h1>IS-BST Cloud Storage</h1>
            <p className="auth-subtitle">Secure, Distributed File Storage</p>

            {authStep === 'login' && (
              <div className="auth-form">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@is-bst.edu"
                  />
                </div>
                <button className="btn-primary full-width" onClick={handleSendOtp}>
                  Create Account / Sign In
                </button>
                <p className="auth-hint">We&apos;ll send you a one-time password</p>
              </div>
            )}

            {authStep === 'otp' && (
              <div className="auth-form">
                <p className="otp-sent">OTP sent to <strong>{email}</strong></p>
                <div className="form-group">
                  <label>Enter 6-digit OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="otp-input"
                  />
                </div>
                <button className="btn-primary full-width" onClick={handleVerifyOtp}>
                  Verify OTP
                </button>
                <button className="btn-link" onClick={() => setAuthStep('login')}>
                  ← Use different email
                </button>
              </div>
            )}
          </div>

          <aside className="auth-log">
            <h3>🔐 Security Log</h3>
            <div className="log-entries">
              {activityLog.length === 0 ? (
                <p className="log-empty">Authentication events will appear here</p>
              ) : (
                activityLog.map((entry, i) => (
                  <div key={i} className="log-entry">{entry}</div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: MAIN APPLICATION
  // ============================================================================

  const storagePercent = user ? (user.storageUsed / user.storageQuota) * 100 : 0;
  const currentFiles = getCurrentFiles();
  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🎓</span>
            <span>IS-BST Cloud Storage</span>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-email">{user?.email}</span>
            <button className="btn-logout" onClick={() => {
              setAuthStep('login');
              setUser(null);
              setFiles([]);
              setActivityLog([]);
            }}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <button className="new-button" onClick={() => setShowUploadModal(true)}>
            <span>+</span> Upload File
          </button>

          <button className="new-folder-btn" onClick={() => setShowNewFolderModal(true)}>
            📁 New Folder
          </button>

          <button className="generate-btn" onClick={handleGenerateLargeFile} disabled={isLoading}>
            📊 Generate 90MB File
          </button>

          {/* Storage Quota */}
          <div className="storage-quota">
            <h4>Storage</h4>
            <div className="quota-bar">
              <div
                className="quota-used"
                style={{
                  width: `${Math.min(storagePercent, 100)}%`,
                  background: storagePercent > 90 ? '#ef4444' : storagePercent > 70 ? '#f59e0b' : '#10b981'
                }}
              />
            </div>
            <p className="quota-text">
              {formatBytes(user?.storageUsed || 0)} of {formatBytes(user?.storageQuota || 0)} used
            </p>
            <p className="quota-percent">
              {storagePercent.toFixed(1)}% capacity
            </p>
          </div>
        </aside>

        {/* Files Area */}
        <section className="files-section">
          {/* Breadcrumbs */}
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id ?? 'root'}>
                {i > 0 && <span className="breadcrumb-sep">/</span>}
                <button
                  className="breadcrumb-btn"
                  onClick={() => handleNavigateToFolder(crumb.id)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <span className="file-count">
              {currentFiles.length} items
              {selectedFile && ` • Selected: ${selectedFile.name}`}
            </span>
            {selectedFile && (
              <div className="toolbar-actions">
                <button
                  className="action-btn danger"
                  onClick={() => handleDeleteFile(selectedFile)}
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="upload-progress">
              <div className="progress-header">
                <span>Uploading chunks...</span>
                <span>{uploadProgress.current}/{uploadProgress.total}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <div className="chunk-list">
                {uploadProgress.chunks.slice(-3).map(chunk => (
                  <div key={chunk.id} className="chunk-item">
                    📦 Chunk {chunk.index + 1}: {formatBytes(chunk.size)} | 🔐 Encrypted | Hash: {chunk.hash}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File List */}
          <div className="file-list">
            <div className="file-list-header">
              <span className="col-name">Name</span>
              <span className="col-modified">Modified</span>
              <span className="col-size">Size</span>
              <span className="col-status">Status</span>
            </div>

            {currentFiles.length === 0 && (
              <div className="empty-folder">
                <p>📁 This folder is empty</p>
                <p>Upload files or create folders to get started</p>
              </div>
            )}

            {currentFiles.map((file) => (
              <div
                key={file.id}
                className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                onClick={() => setSelectedFile(file)}
                onDoubleClick={() => file.type === 'folder' && handleNavigateToFolder(file.id)}
              >
                <span className="col-name">
                  <span className="file-icon">
                    {file.type === 'folder' ? '📁' : file.encrypted ? '🔐' : '📄'}
                  </span>
                  {file.name}
                </span>
                <span className="col-modified">{file.modified}</span>
                <span className="col-size">{file.type === 'folder' ? '—' : formatBytes(file.size)}</span>
                <span className="col-status">
                  {file.encrypted && <span className="badge encrypted">Encrypted</span>}
                  {file.chunks && <span className="badge chunked">{file.chunks.length} chunks</span>}
                </span>
              </div>
            ))}
          </div>

          {/* File Details */}
          {selectedFile && selectedFile.chunks && (
            <div className="file-details">
              <h3>📊 Distribution Details: {selectedFile.name}</h3>
              <div className="details-grid">
                <div className="detail-item">
                  <span className="label">Total Size</span>
                  <span className="value">{formatBytes(selectedFile.size)}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Chunks</span>
                  <span className="value">{selectedFile.chunks.length}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Encryption</span>
                  <span className="value">AES-256</span>
                </div>
                <div className="detail-item">
                  <span className="label">Distribution</span>
                  <span className="value">3 Nodes</span>
                </div>
              </div>
              <div className="chunk-visualization">
                <h4>Chunk Distribution</h4>
                <div className="node-grid">
                  {[1, 2, 3].map(node => (
                    <div key={node} className="storage-node">
                      <div className="node-header">Node {node}</div>
                      <div className="node-chunks">
                        {selectedFile.chunks?.filter((_, i) => i % 3 === node - 1).map(chunk => (
                          <div key={chunk.id} className="mini-chunk">
                            {chunk.index + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Activity Log */}
        <aside className="activity-log">
          <h3>📋 Activity Log</h3>
          <p className="log-subtitle">File operations & security events</p>
          <div className="log-entries">
            {activityLog.length === 0 ? (
              <p className="log-empty">Upload a file to see activity</p>
            ) : (
              activityLog.map((entry, i) => (
                <div key={i} className="log-entry">{entry}</div>
              ))
            )}
          </div>
        </aside>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>📤 Upload File</h2>
            <p className="modal-subtitle">Files are split into chunks and encrypted</p>

            <div className="upload-zone">
              <input
                type="file"
                id="file-input"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-input" className="upload-label">
                <span className="upload-icon">📁</span>
                <span>Click to select a file</span>
                <span className="upload-hint">Files are encrypted with AES-256</span>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>📁 New Folder</h2>

            <div className="form-group">
              <label>Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="My Folder"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewFolderModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateFolder}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
