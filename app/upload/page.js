'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import Logo from '../components/Logo';
import '../globals.css';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Processing, 3: Review Data, 4: Complete
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [publicId, setPublicId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [formData, setFormData] = useState({
    symbol: '',
    type: 'Buy',
    volumeLot: '',
    openPrice: '',
    closePrice: '',
    takeProfit: '',
    stopLoss: '',
    profitLoss: '',
    openTime: '',
    closeTime: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
    }
  }, [router]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file size (max 5MB for better reliability)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (selectedFile.size > maxSize) {
        setMessage('File too large. Maximum size is 5MB for reliable upload. Please compress your image and try again.');
        setMessageType('error');
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setMessage('Invalid file type. Please upload JPG, PNG, GIF, or WEBP images only.');
        setMessageType('error');
        e.target.value = ''; // Clear the input
        return;
      }

      setFile(selectedFile);
      setMessage('');
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.onerror = () => {
        setMessage('Failed to read image file. Please try another image.');
        setMessageType('error');
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Validate file size (max 5MB for better reliability)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (droppedFile.size > maxSize) {
        setMessage('File too large. Maximum size is 5MB for reliable upload. Please compress your image and try again.');
        setMessageType('error');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(droppedFile.type)) {
        setMessage('Invalid file type. Please upload JPG, PNG, GIF, or WEBP images only.');
        setMessageType('error');
        return;
      }

      setFile(droppedFile);
      setMessage('');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.onerror = () => {
        setMessage('Failed to read image file. Please try another image.');
        setMessageType('error');
      };
      reader.readAsDataURL(droppedFile);
    }
  };

  const handleFormDataChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      setMessage('Please select an image first');
      setMessageType('error');
      return;
    }

    setStep(2);
    setProcessing(true);
    setProcessingMessage('Uploading image to cloud...');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.append('screenshot', file);
      uploadFormData.append('tradeDate', tradeDate);
      uploadFormData.append('extractOnly', 'true'); // Flag to only extract, not save yet

      const response = await axios.post('/api/upload-trade', uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 120 seconds timeout (OCR can take time)
      });

      const data = response.data;      

      if (!data.success) {
        // Handle error response
        const errorMsg = data.message || 'Upload failed. Please try again.';
        setMessage(errorMsg);
        setMessageType('error');
        setStep(1);
        setProcessing(false);
        return;
      }

      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setPublicId(data.publicId);
        setProcessingMessage('Extracting data from image...');

        // If extracted data is available, use it
        if (data.extractedData && data.extractedData.symbol) {
          setExtractedData(data.extractedData);
          setFormData({
            symbol: data.extractedData.symbol || '',
            type: data.extractedData.type || 'Buy',
            volumeLot: data.extractedData.volumeLot?.toString() || '',
            openPrice: data.extractedData.openPrice?.toString() || '',
            closePrice: data.extractedData.closePrice?.toString() || '',
            takeProfit: data.extractedData.takeProfit?.toString() || '',
            stopLoss: data.extractedData.stopLoss?.toString() || '',
            profitLoss: data.extractedData.profitLoss?.toString() || '',
            openTime: data.extractedData.openTime || '',
            closeTime: data.extractedData.closeTime || '',
          });
          setStep(3);
          setMessage('Image uploaded and data extracted successfully! Please review and edit if needed.');
          setMessageType('success');
        } else {
          // If OCR failed, still show the form for manual entry
          setStep(3);
          setMessage('Image uploaded successfully. OCR extraction failed or timed out. Please enter data manually below.');
          setMessageType('error');
        }
      } else {
        setMessage(data.message || 'Upload failed. Please try again.');
        setMessageType('error');
        setStep(1);
      }
    } catch (error) {
      console.error('Upload error:', error);
      let errorMsg = 'Network error. Please check your internet connection and try again.';
      
      // Handle axios errors
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with error status
          const responseData = error.response.data;
          errorMsg = responseData?.message || error.response.statusText || 'Upload failed. Please try again.';
        } else if (error.request) {
          // Request made but no response
          errorMsg = 'No response from server. Please check your internet connection and try again.';
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          errorMsg = 'Request timeout. The image might be too large or network is slow. Please try with a smaller image (max 5MB).';
        } else {
          errorMsg = error.message || 'Upload failed. Please try again.';
        }
      } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errorMsg = 'Request timeout. The image might be too large or network is slow. Please try with a smaller image (max 5MB).';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setMessage(errorMsg);
      setMessageType('error');
      setStep(1);
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!formData.symbol || !formData.openPrice || !formData.closePrice) {
      setMessage('Please fill in required fields: Symbol, Open Price, and Close Price');
      setMessageType('error');
      return;
    }

    setProcessing(true);
    setProcessingMessage('Saving trade...');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const submitFormData = new FormData();
      submitFormData.append('screenshot', file);
      submitFormData.append('tradeDate', tradeDate);
      submitFormData.append('manualData', JSON.stringify({
        ...formData,
        volumeLot: parseFloat(formData.volumeLot) || 0,
        openPrice: parseFloat(formData.openPrice),
        closePrice: parseFloat(formData.closePrice),
        takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : null,
        stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : null,
        profitLoss: parseFloat(formData.profitLoss) || 0,
        tradeDate: tradeDate,
      }));

      const response = await axios.post('/api/upload-trade', submitFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 120 seconds timeout (OCR can take time)
      });

      const data = response.data;

      if (!data.success) {
        const errorMsg = data.message || 'Failed to save trade. Please try again.';
        setMessage(errorMsg);
        setMessageType('error');
        setProcessing(false);
        return;
      }

      if (data.success) {
        setStep(4);
        setMessage('Trade uploaded successfully!');
        setMessageType('success');
        
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setMessage(data.message || 'Failed to save trade');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Save trade error:', error);
      let errorMsg = 'Network error. Please check your internet connection and try again.';
      
      // Handle axios errors
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with error status
          const responseData = error.response.data;
          errorMsg = responseData?.message || error.response.statusText || 'Failed to save trade. Please try again.';
        } else if (error.request) {
          // Request made but no response
          errorMsg = 'No response from server. Please check your internet connection and try again.';
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          errorMsg = 'Request timeout. Please try again.';
        } else {
          errorMsg = error.message || 'Failed to save trade. Please try again.';
        }
      } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errorMsg = 'Request timeout. Please try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setStep(1);
    setExtractedData(null);
    setImageUrl(null);
    setPublicId(null);
    setFormData({
      symbol: '',
      type: 'Buy',
      volumeLot: '',
      openPrice: '',
      closePrice: '',
      takeProfit: '',
      stopLoss: '',
      profitLoss: '',
      openTime: '',
      closeTime: '',
    });
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Logo size={36} />
            <h1>Crypto Trading Tracker</h1>
          </div>
          <div className="navbar-links">
            <Link href="/dashboard">📈 Dashboard</Link>
            <Link href="/upload">📤 Upload Trade</Link>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                router.push('/auth/login');
              }}
              className="btn btn-secondary"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container upload-container">
        <div className="card">
          <h2>📤 Upload Trading Screenshot</h2>

          {message && (
            <div className={messageType === 'success' ? 'success' : 'error'}>
              <span>{messageType === 'success' ? '✅' : '⚠️'}</span>
              <span>{message}</span>
            </div>
          )}

          {/* Step 1: Upload Image */}
          {step === 1 && (
            <div className="upload-step">
              <div className="step-indicator">
                <div className="step-number">1</div>
                <div className="step-title">Upload Screenshot</div>
              </div>

              <div className="input-group">
                <label htmlFor="tradeDate">📅 Trade Date</label>
                <input
                  type="date"
                  id="tradeDate"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  required
                />
              </div>

              <div
                className="file-upload-area"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon">📷</div>
                <h3 style={{ marginBottom: '12px', color: '#2d3748' }}>
                  {file ? 'Image Selected' : 'Click or Drag & Drop Image Here'}
                </h3>
                <p style={{ color: '#718096', marginBottom: '16px' }}>
                  {file ? file.name : 'Supported formats: JPG, PNG, GIF'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="screenshot"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {file && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="btn btn-secondary"
                    style={{ marginTop: '12px' }}
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>

              {previewUrl && (
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="image-preview"
                    style={{ maxHeight: '400px' }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleUploadAndProcess}
                className="btn btn-primary"
                disabled={!file}
                style={{ marginTop: '24px', width: '100%', padding: '16px' }}
              >
                {file ? '🚀 Upload & Process Image' : '📤 Please Select Image First'}
              </button>
            </div>
          )}

          {/* Step 2: Processing */}
          {step === 2 && processing && (
            <div className="processing-overlay">
              <div className="processing-card">
                <div className="processing-spinner"></div>
                <h3 style={{ marginBottom: '12px', color: '#2d3748' }}>Processing...</h3>
                <p style={{ color: '#718096' }}>{processingMessage}</p>
              </div>
            </div>
          )}

          {/* Step 3: Review & Edit Data */}
          {step === 3 && !processing && (
            <div className="upload-step">
              <div className="step-indicator">
                <div className="step-number">2</div>
                <div className="step-title">Review & Edit Extracted Data</div>
              </div>

              {imageUrl && (
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <img
                    src={imageUrl}
                    alt="Uploaded"
                    className="image-preview"
                    style={{ maxHeight: '300px' }}
                  />
                </div>
              )}

              {extractedData && (
                <div className="extracted-data-preview">
                  <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✨ Extracted Data
                  </h3>
                  <div className="data-grid">
                    {extractedData.symbol && (
                      <div className="data-item">
                        <div className="data-label">Symbol</div>
                        <div className="data-value">{extractedData.symbol}</div>
                      </div>
                    )}
                    {extractedData.type && (
                      <div className="data-item">
                        <div className="data-label">Type</div>
                        <div className="data-value">{extractedData.type}</div>
                      </div>
                    )}
                    {extractedData.profitLoss !== null && (
                      <div className="data-item">
                        <div className="data-label">Profit/Loss</div>
                        <div className={`data-value ${extractedData.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                          ${extractedData.profitLoss.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid #e2e8f0' }}>
                <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✏️ Edit Trade Details
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div className="input-group">
                    <label htmlFor="symbol">💎 Symbol (BTC, ETH, etc.) *</label>
                    <input
                      type="text"
                      id="symbol"
                      name="symbol"
                      value={formData.symbol}
                      onChange={handleFormDataChange}
                      placeholder="BTC"
                      style={{ textTransform: 'uppercase' }}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="type">📊 Trade Type *</label>
                    <select
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleFormDataChange}
                    >
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="volumeLot">📦 Volume / Lot</label>
                    <input
                      type="number"
                      id="volumeLot"
                      name="volumeLot"
                      value={formData.volumeLot}
                      onChange={handleFormDataChange}
                      placeholder="0.02"
                      step="0.01"
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="openPrice">📈 Open Price (USD) *</label>
                    <input
                      type="number"
                      id="openPrice"
                      name="openPrice"
                      value={formData.openPrice}
                      onChange={handleFormDataChange}
                      placeholder="87526.77"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="closePrice">📉 Close Price (USD) *</label>
                    <input
                      type="number"
                      id="closePrice"
                      name="closePrice"
                      value={formData.closePrice}
                      onChange={handleFormDataChange}
                      placeholder="87461.90"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="takeProfit">🎯 Take Profit (USD)</label>
                    <input
                      type="number"
                      id="takeProfit"
                      name="takeProfit"
                      value={formData.takeProfit}
                      onChange={handleFormDataChange}
                      placeholder="87598.54"
                      step="0.01"
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="stopLoss">🛑 Stop Loss (USD)</label>
                    <input
                      type="number"
                      id="stopLoss"
                      name="stopLoss"
                      value={formData.stopLoss}
                      onChange={handleFormDataChange}
                      placeholder="87482.01"
                      step="0.01"
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="profitLoss">💰 Profit / Loss (USD)</label>
                    <input
                      type="number"
                      id="profitLoss"
                      name="profitLoss"
                      value={formData.profitLoss}
                      onChange={handleFormDataChange}
                      placeholder="-1.30"
                      step="0.01"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '16px' }}
                  >
                    ✅ Save Trade
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '16px' }}
                  >
                    🔄 Start Over
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '24px' }}>✅</div>
              <h2 style={{ color: '#28a745', marginBottom: '16px' }}>Trade Saved Successfully!</h2>
              <p style={{ color: '#718096' }}>Redirecting to dashboard...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
