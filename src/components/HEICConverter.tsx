/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  SlidersHorizontal, 
  Play, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FolderArchive,
  ArrowRight,
  Sparkles,
  Scale,
  Folder
} from 'lucide-react';
import JSZip from 'jszip';
import { HEICFile, TimelineFrame } from '../types';
import { convertHEICtoJPG, getImageDimensions, resizeImage } from '../utils/heic';

interface HEICConverterProps {
  onAddToTimelapse: (frames: Omit<TimelineFrame, 'id'>[]) => void;
  timelapseFrameCount: number;
}

export default function HEICConverter({ onAddToTimelapse, timelapseFrameCount }: HEICConverterProps) {
  const [files, setFiles] = useState<HEICFile[]>([]);
  const [quality, setQuality] = useState<number>(0.85);
  const [isConvertingAll, setIsConvertingAll] = useState<boolean>(false);
  const [conversionIndex, setConversionIndex] = useState<number>(0);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [isSavingToFolder, setIsSavingToFolder] = useState<boolean>(false);
  
  // Resizing Controls
  const [resizeEnabled, setResizeEnabled] = useState<boolean>(false);
  const [resizeWidth, setResizeWidth] = useState<number>(1920);
  const [resizeHeight, setResizeHeight] = useState<number>(1080);
  const [resizeModeFit, setResizeModeFit] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag over states
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Handle file selections
  const processUploadedFiles = (rawFiles: FileList | null) => {
    if (!rawFiles) return;

    const newHeicFiles: HEICFile[] = [];
    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      const nameLower = file.name.toLowerCase();
      
      // We target HEIC / HEIF format primarily, but let the user load anything
      const isHeic = nameLower.endsWith('.heic') || nameLower.endsWith('.heif');
      
      // Create new HEIC item
      newHeicFiles.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        status: 'pending',
        progress: 0,
      });
    }

    setFiles((prev) => [...prev, ...newHeicFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processUploadedFiles(e.dataTransfer.files);
  };

  // Trigger manual file selection
  const handleSelectFilesClick = () => {
    fileInputRef.current?.click();
  };

  // Convert a single image file (HEIC or standard format)
  const convertSingleFile = async (id: string, customQuality?: number) => {
    const targetFile = files.find((f) => f.id === id);
    if (!targetFile) return;

    // Update status
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: 'converting', progress: 20 }
          : f
      )
    );

    try {
      const targetBlob = targetFile.file;
      const nameLower = targetFile.name.toLowerCase();
      const isHeic = nameLower.endsWith('.heic') || nameLower.endsWith('.heif');
      
      let convertedBlob: Blob;

      if (isHeic) {
        // Step 1: Decode HEIC to JPG
        convertedBlob = await convertHEICtoJPG(targetBlob, customQuality ?? quality);
        
        // Step 2: Resize if enabled
        if (resizeEnabled && resizeWidth > 0 && resizeHeight > 0) {
          convertedBlob = await resizeImage(
            convertedBlob,
            resizeWidth,
            resizeHeight,
            resizeModeFit,
            customQuality ?? quality
          );
        }
      } else {
        // For non-HEIC / standard format files (JPG, PNG, WEBP, BMP, etc.):
        // We ALWAYS transcode standard images to JPEG (applying custom quality and/or resizing)
        if (resizeEnabled && resizeWidth > 0 && resizeHeight > 0) {
          convertedBlob = await resizeImage(
            targetBlob,
            resizeWidth,
            resizeHeight,
            resizeModeFit,
            customQuality ?? quality
          );
        } else {
          // If resizing is disabled, transcode using natural/original size to compress to JPG with chosen quality
          convertedBlob = await resizeImage(
            targetBlob,
            99999, // large upper bound
            99999, // large upper bound
            true,  // fit (retains original size since no upscale occurs)
            customQuality ?? quality
          );
        }
      }

      const convertedUrl = URL.createObjectURL(convertedBlob);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'done',
                convertedBlob,
                convertedUrl,
                progress: 100,
              }
            : f
        )
      );
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'error',
                errorMsg: err.message || 'Error converting HEIC image',
                progress: 0,
              }
            : f
        )
      );
    }
  };

  // Mass conversion sequential loop (runs 1 at a time to prevent device out-of-memory errors)
  const handleConvertAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    setIsConvertingAll(true);
    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const current = files[i];
      if (current.status === 'pending' || current.status === 'error') {
        setConversionIndex(i + 1);
        await convertSingleFile(current.id);
        count++;
      }
    }

    setIsConvertingAll(false);
  };

  // Individual image download
  const downloadSingle = (fileItem: HEICFile) => {
    if (!fileItem.convertedBlob || !fileItem.convertedUrl) return;

    const newName = fileItem.name.replace(/\.[^.]+$/, '') + '.jpg';
    const link = document.createElement('a');
    link.href = fileItem.convertedUrl;
    link.download = newName;
    link.click();
  };

  // Bulk ZIP saving
  const handleDownloadAllZip = async () => {
    const successfulFiles = files.filter((f) => f.status === 'done' && f.convertedBlob);
    if (successfulFiles.length === 0) return;

    setIsZipping(true);
    const zip = new JSZip();

    successfulFiles.forEach((fileItem) => {
      if (fileItem.convertedBlob) {
        const pureName = fileItem.name.replace(/\.[^.]+$/, '') + '.jpg';
        zip.file(pureName, fileItem.convertedBlob);
      }
    });

    try {
      const zipContentBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipContentBlob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'heic_converted_jpgs.zip';
      link.click();

      // Revoke to clean memories
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (err) {
      console.error('ZIP generation failed: ', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Bulk Local Folder saving (Supports Electron Desktop app & Web File System Access API)
  const handleSaveToFolder = async () => {
    const successfulFiles = files.filter((f) => f.status === 'done' && f.convertedBlob);
    if (successfulFiles.length === 0) return;

    const electronAPI = (window as any).electronAPI;

    // --- 1. Electron Desktop Environment ---
    if (electronAPI) {
      try {
        setIsSavingToFolder(true);

        // Let the user choose a target directory
        const directory = await electronAPI.selectDirectory();
        if (!directory) {
          return; // Canceled by user
        }

        // Save each converted image file sequentially to minimize peak IPC memory usage
        for (const fileItem of successfulFiles) {
          if (!fileItem.convertedBlob) continue;
          const pureName = fileItem.name.replace(/\.[^.]+$/, '') + '.jpg';
          
          // Read Blob as arrayBuffer
          const arrayBuffer = await fileItem.convertedBlob.arrayBuffer();
          
          // Pass to native writer
          const res = await electronAPI.saveFilesToDirectory(directory, [{
            name: pureName,
            arrayBuffer: new Uint8Array(arrayBuffer)
          }]);

          if (!res || !res.success) {
            throw new Error(res?.error || 'Failed to write files to disk');
          }
        }

        alert(`Successfully saved all ${successfulFiles.length} converted JPG photos natively into folder:\n${directory}`);
      } catch (err: any) {
        console.error('Local folder export failed:', err);
        alert(`Folder export failed: ${err.message || String(err)}`);
      } finally {
        setIsSavingToFolder(false);
      }
      return;
    }

    // --- 2. Web Browser Environment with File System Access API ---
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        setIsSavingToFolder(true);
        
        // Prompt user to select directory
        const directoryHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });

        let savedCount = 0;
        for (const fileItem of successfulFiles) {
          if (!fileItem.convertedBlob) continue;
          const pureName = fileItem.name.replace(/\.[^.]+$/, '') + '.jpg';
          
          // Create a new file handle inside selected directory
          const fileHandle = await directoryHandle.getFileHandle(pureName, { create: true });
          
          // Create writeable stream and write Blob
          const writable = await fileHandle.createWritable();
          await writable.write(fileItem.convertedBlob);
          await writable.close();
          savedCount++;
        }

        alert(`Successfully exported ${savedCount} converted photos directly into your selected local folder!`);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('User canceled directory choice.');
          return;
        }
        console.error('Web folder export failed:', err);
        alert(`Folder export failed: ${err.message || String(err)}. You can use the "Download All (ZIP)" button as a fallback.`);
      } finally {
        setIsSavingToFolder(false);
      }
      return;
    }

    // --- 3. Traditional Browser Fallback (e.g. Firefox, Safari) ---
    try {
      setIsSavingToFolder(true);
      if (confirm(`Your browser doesn't support picking folders directly. Would you like to download all ${successfulFiles.length} converted photos individually to your standard Downloads directory?`)) {
        for (const fileItem of successfulFiles) {
          if (!fileItem.convertedBlob) continue;
          const pureName = fileItem.name.replace(/\.[^.]+$/, '') + '.jpg';
          const link = document.createElement('a');
          link.href = URL.createObjectURL(fileItem.convertedBlob);
          link.download = pureName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Keep a tiny delay to avoid browser choking on rapid parallel downloads
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    } catch (err: any) {
      console.error('Individual fallback conversion failed:', err);
    } finally {
      setIsSavingToFolder(false);
    }
  };

  // Pipeline converted images to the Timelapse Timeline
  const sendToTimelapse = async () => {
    const successfulFiles = files.filter((f) => f.status === 'done' && f.convertedBlob && f.convertedUrl);
    if (successfulFiles.length === 0) return;

    const framesToInject: Omit<TimelineFrame, 'id'>[] = [];

    for (const f of successfulFiles) {
      if (f.convertedBlob && f.convertedUrl) {
        const dimensions = await getImageDimensions(f.convertedUrl);
        framesToInject.push({
          name: f.name.replace(/\.[^.]+$/, '') + '.jpg',
          size: f.convertedBlob.size,
          url: f.convertedUrl,
          blob: f.convertedBlob,
          width: dimensions.width,
          height: dimensions.height,
          rotation: 0,
          flipped: false,
          aspectRatio: dimensions.width / dimensions.height,
        });
      }
    }

    onAddToTimelapse(framesToInject);
    
    // Nice notifications
    alert(`Successfully transferred ${framesToInject.length} converted JPG photos to your Timelapse timeline!`);
  };

  // Clear file lists and revoke object URLs
  const handleClearList = () => {
    files.forEach((f) => {
      if (f.convertedUrl) {
        URL.revokeObjectURL(f.convertedUrl);
      }
    });
    setFiles([]);
    setConversionIndex(0);
  };

  // Remove individual file slot
  const removeFile = (id: string) => {
    const target = files.find((f) => f.id === id);
    if (target?.convertedUrl) {
      URL.revokeObjectURL(target.convertedUrl);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const convertedCount = files.filter((f) => f.status === 'done').length;
  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Dynamic Workspace Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Sparkles className="w-24 h-24 text-brand-400" />
        </div>
        <div className="relative z-10 max-w-full">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Advanced Batch Photo Converter
            <span className="text-[9px] bg-brand-50 text-brand-600 font-mono font-bold px-1.5 py-0.5 rounded border border-brand-100">
              Folder Transcoder & Resizer
            </span>
          </h2>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
            Transcode and resize your raw HEIC captures as well as standard images (JPG, PNG, WEBP, BMP) directly in your browser. All computations occur sandboxed on your local machine, avoiding unnecessary cloud exposures.
          </p>
        </div>
      </div>

      {/* Control Station Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dropzone & Loader */}
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleSelectFilesClick}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer ${
              isDragging
                ? 'border-brand-500 bg-brand-50/20 scale-[0.99] shadow-inner'
                : 'border-slate-300 bg-white hover:bg-slate-50/50 hover:border-brand-400 shadow-sm'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => processUploadedFiles(e.target.files)}
              multiple
              accept=".heic,.heif,.jpg,.jpeg,.png,.webp,.bmp"
              className="hidden"
              id="heic-input"
            />
            
            <div className="p-3 bg-brand-50 rounded-full border border-brand-100 text-brand-600 mb-3 transition-all">
              <Upload className="w-8 h-8 text-brand-600" />
            </div>

            <p className="text-slate-800 text-sm font-bold text-center">
              Drag & drop photos or folders here
            </p>
            <p className="text-slate-400 text-[11px] text-center mt-0.5 max-w-xs leading-tight">
              Supports bulk HEIC (`.heic`/`.heif`) and standard images (`.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`)
            </p>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFilesClick();
              }}
              className="mt-4 px-4 py-2 bg-white text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer hover:bg-slate-50"
            >
              Select files from computer
            </button>
          </div>

          {/* Overall Converting progress and status */}
          {files.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-col gap-0.5 w-full sm:w-auto">
                <span className="text-[10px] text-slate-450 uppercase tracking-widest font-mono">Queue Status</span>
                <span className="text-slate-700 text-xs font-semibold flex items-center gap-1.5">
                  <span className="text-brand-600 font-bold">{convertedCount}</span> converted
                  <span className="text-slate-300 font-bold">•</span>
                  <span className="text-amber-600 font-semibold">{pendingCount}</span> remaining
                  {errorCount > 0 && (
                    <>
                      <span className="text-slate-300 font-bold">•</span>
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {errorCount} errors
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Graphical Master Slider Progress */}
              <div className="flex-1 w-full sm:max-w-xs bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div 
                  className="bg-brand-600 h-full transition-all duration-300"
                  style={{ width: `${(convertedCount / files.length) * 100}%` }}
                />
              </div>

              <span className="text-slate-600 font-mono text-xs font-bold">
                {Math.round((convertedCount / files.length) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Configuration Column */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 h-fit space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rendering Plan</h3>
          </div>

          {/* Quality Slider Control */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold font-mono">
              <span className="text-slate-500">JPEG Quality</span>
              <span className="text-brand-600 font-bold">{Math.round(quality * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="1.00"
              step="0.05"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              disabled={isConvertingAll}
              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
            />
          </div>

          {/* Image Resizing Options */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resizeEnabled}
                  onChange={(e) => setResizeEnabled(e.target.checked)}
                  disabled={isConvertingAll}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-brand-600" />
                  Enable Resizing
                </span>
              </label>
            </div>

            {resizeEnabled && (
              <div className="space-y-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 animate-fadeIn">
                {/* Resize Mode */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-450">Mode:</span>
                  <div className="flex bg-slate-200/65 p-0.5 rounded-lg text-[10px] w-36">
                    <button
                      type="button"
                      onClick={() => setResizeModeFit(true)}
                      className={`flex-1 py-0.5 text-center font-semibold rounded-md transition-all ${
                        resizeModeFit
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Fit (Ratio)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResizeModeFit(false)}
                      className={`flex-1 py-0.5 text-center font-semibold rounded-md transition-all ${
                        !resizeModeFit
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Stretch
                    </button>
                  </div>
                </div>

                {/* Dimensions inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
                    <span className="text-[9px] font-mono text-slate-400 font-bold">W</span>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      value={resizeWidth}
                      onChange={(e) => setResizeWidth(Math.max(100, parseInt(e.target.value) || 0))}
                      disabled={isConvertingAll}
                      className="w-full text-right text-xs text-slate-800 focus:outline-none bg-transparent"
                    />
                    <span className="text-[9px] font-mono text-slate-400">px</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
                    <span className="text-[9px] font-mono text-slate-400 font-bold">H</span>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      value={resizeHeight}
                      onChange={(e) => setResizeHeight(Math.max(100, parseInt(e.target.value) || 0))}
                      disabled={isConvertingAll}
                      className="w-full text-right text-xs text-slate-800 focus:outline-none bg-transparent"
                    />
                    <span className="text-[9px] font-mono text-slate-400">px</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Operations stack - Side-by-side Grids */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleConvertAll}
                disabled={isConvertingAll || files.length === 0 || pendingCount === 0}
                className="py-2 px-3 bg-brand-600 border border-transparent hover:border-brand-200 hover:bg-brand-50 hover:text-black disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:shadow-none disabled:hover:border-transparent group"
              >
                {isConvertingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white flex-shrink-0 group-hover:text-black" />
                    <span className="truncate">Conv. ({conversionIndex}/{files.length})</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-white fill-current flex-shrink-0 group-hover:text-black group-hover:fill-black" />
                    <span className="truncate">Convert to JPG</span>
                  </>
                )}
              </button>

              <button
                onClick={sendToTimelapse}
                disabled={convertedCount === 0 || isConvertingAll}
                className="py-2 px-3 bg-brand-600 border border-transparent hover:border-brand-200 hover:bg-brand-50 hover:text-black disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:shadow-none disabled:hover:border-transparent group"
              >
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 text-white group-hover:text-black" />
                <span className="truncate flex-1 text-center">Import to Timeline</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSaveToFolder}
                disabled={convertedCount === 0 || isConvertingAll || isSavingToFolder}
                className="py-2 px-1.5 bg-brand-50 hover:bg-brand-100 disabled:bg-slate-50 disabled:text-slate-400 text-brand-700 border border-brand-150 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                title={
                  typeof window !== 'undefined' && 'electronAPI' in window
                    ? 'Natively write individual JPG files directly into any local disk directory'
                    : typeof window !== 'undefined' && 'showDirectoryPicker' in window
                    ? 'Uses modern high-performance browser directory features to write JPGs directly to a local folder without a ZIP archive!'
                    : 'Saves individual JPG files sequentially on your computer!'
                }
              >
                {isSavingToFolder ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-brand-600 flex-shrink-0" />
                    <span className="truncate">Saving...</span>
                  </>
                ) : (
                  <>
                    <Folder className="w-3 h-3 text-brand-600 flex-shrink-0" />
                    <span className="truncate">Save to Folder</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadAllZip}
                disabled={convertedCount === 0 || isConvertingAll || isZipping}
                className="py-2 px-1.5 bg-white hover:bg-slate-50 border border-slate-300 disabled:bg-slate-100 disabled:border-none disabled:text-slate-400 text-slate-700 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-slate-400 flex-shrink-0" />
                    <span className="truncate">Zipping...</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-3 h-3 text-brand-600 flex-shrink-0" />
                    <span className="truncate">Download ZIP</span>
                  </>
                )}
              </button>
            </div>

            {/* CLEAR LIST */}
            <button
              onClick={handleClearList}
              disabled={files.length === 0 || isConvertingAll}
              className="w-full py-1.5 px-3 bg-transparent hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Clear Queue List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid file display queue */}
      {files.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-150 pb-2">
            <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">Conversion Queue ({files.length})</span>
            <span className="text-[10px] text-slate-400 font-mono">Click preview frame to export single JPEG files</span>
          </div>

          {errorCount > 0 && (
            <div className="mb-4 bg-rose-50/50 border border-rose-150 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="text-xs text-rose-800 space-y-1">
                <p className="font-bold">Some HEIC photos failed to transcode</p>
                {typeof window !== 'undefined' && 'electronAPI' in window ? (
                  <p className="text-rose-700 leading-relaxed">
                    You are running inside the <strong>Electron Desktop App</strong> which utilizes optimized native background threads. If a photo still fails to load, the capture may be corrupted or in an unsupported high bit-depth format. Please verify the source file's integrity.
                  </p>
                ) : (
                  <p className="text-rose-700 leading-relaxed">
                    Browser-based environments are powered by standard WebAssembly decoders which only support standard <strong>8-bit HEIC files</strong>. High Dynamic Range (<strong>10-bit HDR, Apple ProRAW HDR, or Samsung HDR10+</strong>) captures cannot be fully decoded inside a standard web browser.
                  </p>
                )}
                <p className="font-medium text-[11px] pt-1">
                  💡 <strong>Recommended Workarounds:</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1 mt-0.5 font-normal text-rose-700">
                  {!(typeof window !== 'undefined' && 'electronAPI' in window) && (
                    <li className="text-brand-950 font-semibold bg-brand-50/70 p-1.5 rounded-lg border border-brand-100 my-1">
                      🚀 <strong>Use the Electron Desktop App</strong>: Pack and launch your local build (`npm run electron:start` or `npm run package`) which activates <strong>GPU-accelerated, native zero-memory-limit converters</strong> (including macOS `sips` integration) to bypass browser bounds completely!
                    </li>
                  )}
                  <li><strong>For Samsung Galaxy:</strong> Go to Camera Settings ➔ Advanced picture options ➔ Toggle off <strong>"HDR10+ pictures / High bit-depth HEIF"</strong>.</li>
                  <li><strong>For iPhone/iOS:</strong> Go to Settings ➔ Camera ➔ Formats ➔ Select <strong>"Most Compatible"</strong> (captures in JPEG) or disable <strong>Apple ProRAW / Auto-HDR</strong> high-depth capture.</li>
                  <li><strong>Alternative:</strong> Convert high-bitrate photos using native tools (such as Preview on Mac or Photos on Windows) first, then import standard files.</li>
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((fileItem) => (
              <div 
                key={fileItem.id} 
                className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 relative group hover:border-brand-400 hover:bg-white transition-all overflow-hidden shadow-sm"
              >
                {/* Visual Image Preview Panel */}
                <div 
                  onClick={() => fileItem.status === 'done' && downloadSingle(fileItem)}
                  className={`w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center relative flex-shrink-0 cursor-pointer ${
                    fileItem.status === 'done' ? 'ring-2 ring-brand-500/10 border border-brand-200' : 'border border-slate-200'
                  }`}
                >
                  {fileItem.status === 'done' && fileItem.convertedUrl ? (
                    <img 
                      src={fileItem.convertedUrl} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all"
                      referrerPolicy="no-referrer"
                    />
                  ) : fileItem.status === 'converting' ? (
                    <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-350" />
                  )}
                </div>

                {/* Details column */}
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-slate-800 text-xs font-bold truncate" title={fileItem.name}>
                    {fileItem.name}
                  </p>
                  <p className="text-slate-400 font-mono text-[10px] mt-0.5">
                    {formatSize(fileItem.size)}
                  </p>

                  {/* Progress / Status Tag */}
                  <div className="mt-1 flex items-center gap-1.5">
                    {fileItem.status === 'pending' && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        Pending
                      </span>
                    )}
                    {fileItem.status === 'converting' && (
                      <span className="text-[10px] font-mono font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                        Converting
                      </span>
                    )}
                    {fileItem.status === 'done' && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Done
                      </span>
                    )}
                    {fileItem.status === 'error' && (
                      <span 
                        className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex items-center gap-1 truncate max-w-full"
                        title={fileItem.errorMsg}
                      >
                        <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" /> Error
                      </span>
                    )}
                  </div>
                </div>

                {/* Single file download & deletion */}
                <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-between opacity-50 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => removeFile(fileItem.id)}
                    disabled={isConvertingAll}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer disabled:opacity-30"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {fileItem.status === 'done' && (
                    <button
                      onClick={() => downloadSingle(fileItem)}
                      className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                      title="Download JPG"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 shadow-sm">
          <FolderArchive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">Your transcoding queue is empty</p>
          <p className="text-slate-400 text-xs mt-1">Upload HEIC or standard images/folders above to transcode them into highly polished JPEGs instantly</p>
        </div>
      )}
    </div>
  );
}
