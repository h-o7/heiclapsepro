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
  Scale
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

  // Convert a single HEIC file
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
      let convertedBlob = await convertHEICtoJPG(targetBlob, customQuality ?? quality);

      // Perform Resizing if enabled
      if (resizeEnabled && resizeWidth > 0 && resizeHeight > 0) {
        convertedBlob = await resizeImage(
          convertedBlob,
          resizeWidth,
          resizeHeight,
          resizeModeFit,
          customQuality ?? quality
        );
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

    const newName = fileItem.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
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
        const pureName = fileItem.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
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

  // Pipeline converted images to the Timelapse Timeline
  const sendToTimelapse = async () => {
    const successfulFiles = files.filter((f) => f.status === 'done' && f.convertedBlob && f.convertedUrl);
    if (successfulFiles.length === 0) return;

    const framesToInject: Omit<TimelineFrame, 'id'>[] = [];

    for (const f of successfulFiles) {
      if (f.convertedBlob && f.convertedUrl) {
        const dimensions = await getImageDimensions(f.convertedUrl);
        framesToInject.push({
          name: f.name.replace(/\.(heic|heif)$/i, '') + '.jpg',
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 text-indigo-400" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            HEIC Batch Converter
            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-2 py-0.5 rounded border border-indigo-100">
              Folder Transcoder
            </span>
          </h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            High-efficiency HEIC formatted photos taken by modern mobile devices cannot be natively viewed inside core web browsers. Drop your raw folders and files here to transcode them into highly polished, universal JPEGs locally in parallel, without zero-exposure server leakage.
          </p>
        </div>
      </div>

      {/* Control Station Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Dropzone & Loader */}
        <div className="lg:col-span-3 space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/20 scale-[0.99] shadow-inner'
                : 'border-slate-300 bg-white hover:bg-slate-50/50 hover:border-indigo-400 shadow-sm'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => processUploadedFiles(e.target.files)}
              multiple
              accept=".heic,.heif"
              className="hidden"
              id="heic-input"
            />
            
            <div className="p-4 bg-indigo-50 rounded-full border border-indigo-100 text-indigo-600 mb-4 transition-all">
              <Upload className="w-10 h-10 text-indigo-600" />
            </div>

            <p className="text-slate-800 font-bold text-center">
              Drag & drop HEIC photos or foldered lists here
            </p>
            <p className="text-slate-400 text-xs text-center mt-1">
              Supports bulk selection of raw HEIC files (`.heic` or `.heif`)
            </p>

            <button
              onClick={handleSelectFilesClick}
              className="mt-6 px-5 py-2.5 bg-white text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer hover:bg-slate-50"
            >
              Select files from computer
            </button>
          </div>

          {/* Overall Converting progress and status */}
          {files.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-col gap-1 w-full md:w-auto">
                <span className="text-xs text-slate-450 uppercase tracking-widest font-mono">Conversion Queue Status</span>
                <span className="text-slate-700 text-sm font-semibold flex items-center gap-2">
                  <span className="text-indigo-600 font-bold">{convertedCount}</span> converted
                  <span className="text-slate-300 font-bold">•</span>
                  <span className="text-amber-600 font-semibold">{pendingCount}</span> remaining
                  {errorCount > 0 && (
                    <>
                      <span className="text-slate-300 font-bold">•</span>
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errorCount} errors
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Graphical Master Slider Progress */}
              <div className="flex-1 w-full md:max-w-md bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${(convertedCount / files.length) * 100}%` }}
                />
              </div>

              <span className="text-slate-600 font-mono text-sm font-bold">
                {Math.round((convertedCount / files.length) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Configuration Column */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 h-fit space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Rendering Plan</h3>
          </div>

          {/* Quality Slider Control */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold font-mono">
              <span className="text-slate-500">JPEG Quality</span>
              <span className="text-indigo-600 font-bold">{Math.round(quality * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="1.00"
              step="0.05"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              disabled={isConvertingAll}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Optimized Compression</span>
              <span>Maximum Density</span>
            </div>
          </div>

          {/* Image Resizing Options */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resizeEnabled}
                  onChange={(e) => setResizeEnabled(e.target.checked)}
                  disabled={isConvertingAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-indigo-600" />
                  Enable Resizing
                </span>
              </label>
            </div>

            {resizeEnabled && (
              <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100 animate-fadeIn">
                {/* Resize Mode */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-450">Resizing Mode</span>
                  <div className="flex bg-slate-200/65 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setResizeModeFit(true)}
                      className={`flex-1 py-1 text-center font-semibold rounded-md transition-all ${
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
                      className={`flex-1 py-1 text-center font-semibold rounded-md transition-all ${
                        !resizeModeFit
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Stretch (Exact)
                    </button>
                  </div>
                </div>

                {/* Dimensions inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 font-bold block">Width (px)</label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      value={resizeWidth}
                      onChange={(e) => setResizeWidth(Math.max(100, parseInt(e.target.value) || 0))}
                      disabled={isConvertingAll}
                      className="w-full px-2 py-1 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 font-bold block">Height (px)</label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      value={resizeHeight}
                      onChange={(e) => setResizeHeight(Math.max(100, parseInt(e.target.value) || 0))}
                      disabled={isConvertingAll}
                      className="w-full px-2 py-1 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                
                <p className="text-[9px] text-slate-400 font-mono leading-tight">
                  {resizeModeFit
                    ? '💡 Aspect ratio is safely maintained. Output fits within these bounds.'
                    : '⚠ Output is forced exactly to target pixels, stretching if needed.'}
                </p>
              </div>
            )}
          </div>

          {/* Operations stack */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleConvertAll}
              disabled={isConvertingAll || files.length === 0 || pendingCount === 0}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-100 disabled:shadow-none"
            >
              {isConvertingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Converting ({conversionIndex}/{files.length})...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-white fill-current" />
                  <span>Convert {pendingCount > 0 ? pendingCount : 'All'} to JPG</span>
                </>
              )}
            </button>

            {/* PIPELINE / TIMELAPSE INJECTION BUTTON */}
            <button
              onClick={sendToTimelapse}
              disabled={convertedCount === 0 || isConvertingAll}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-100 disabled:shadow-none"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Import to Timeline ({convertedCount})</span>
            </button>

            {/* DOWNLOAD ALL ZIP */}
            <button
              onClick={handleDownloadAllZip}
              disabled={convertedCount === 0 || isConvertingAll || isZipping}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 disabled:bg-slate-100 disabled:border-none disabled:text-slate-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              {isZipping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span>Generating ZIP...</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4 text-indigo-650" />
                  <span>Download ZIP ({convertedCount})</span>
                </>
              )}
            </button>

            {/* CLEAR LIST */}
            <button
              onClick={handleClearList}
              disabled={files.length === 0 || isConvertingAll}
              className="w-full py-2 px-4 bg-transparent hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
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
                <p className="text-rose-700 leading-relaxed">
                  Web-based engines (including browser compatibility modes used by Electron) are powered by standard WebAssembly decoders which only support standard <strong>8-bit HEIC files</strong>. High Dynamic Range (<strong>10-bit HDR, Apple ProRAW HDR, or Samsung HDR10+</strong>) captures cannot be fully decoded in-browser.
                </p>
                <p className="font-medium text-[11px] pt-1">
                  💡 <strong>Recommended Workarounds:</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1 mt-0.5 font-normal text-rose-700">
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
                className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 relative group hover:border-indigo-400 hover:bg-white transition-all overflow-hidden shadow-sm"
              >
                {/* Visual Image Preview Panel */}
                <div 
                  onClick={() => fileItem.status === 'done' && downloadSingle(fileItem)}
                  className={`w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center relative flex-shrink-0 cursor-pointer ${
                    fileItem.status === 'done' ? 'ring-2 ring-indigo-500/10 border border-indigo-200' : 'border border-slate-200'
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
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
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
                      <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
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
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
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
          <p className="text-slate-400 text-xs mt-1">Upload HEIC files/folders above to transcode them into highly polished JPEGs instantly</p>
        </div>
      )}
    </div>
  );
}
