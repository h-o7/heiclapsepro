/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Loader2, 
  Film, 
  FileVideo, 
  ImageDown,
  VolumeX,
  Gauge,
  Expand,
  Clock,
  SlidersHorizontal,
  AlertCircle
} from 'lucide-react';
import { TimelineFrame } from '../types';
import { compileVideo, getSupportedMimeType } from '../utils/recorder';
import JSZip from 'jszip';

interface PlayerPreviewProps {
  frames: TimelineFrame[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  children?: React.ReactNode;
}

export default function PlayerPreview({ frames, currentIndex, setCurrentIndex, children }: PlayerPreviewProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(10);
  const [loop, setLoop] = useState<boolean>(true);
  
  const [resolutionPreset, setResolutionPreset] = useState<'4k' | '1080p' | '720p' | 'square' | 'source'>('source');
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm' | 'zip'>('mp4');
  const [encodingQuality, setEncodingQuality] = useState<'standard' | 'high' | 'pristine'>('high');

  const [speedFactor, setSpeedFactor] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<'match' | '16-9' | '4-3' | '1-1' | '9-16'>('match');
  
  // Video compile states
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileProgress, setCompileProgress] = useState<number>(0);
  const [compileTotal, setCompileTotal] = useState<number>(0);
  const [finishedVideoBlob, setFinishedVideoBlob] = useState<Blob | null>(null);

  // Frames ZIP state
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Handle auto playback timer
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const intervalMs = 1000 / (fps * speedFactor);
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= frames.length - 1) {
          if (loop) {
            return 0;
          } else {
            setIsPlaying(false);
            return prev;
          }
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, fps, speedFactor, loop, frames.length, setCurrentIndex]);

  // Redraw canvas whenever frame changes, index changes, or aspect changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (frames.length === 0) {
      // Draw empty canvas state
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#64748b';
      // Dynamically scale font size so it's readable at higher canvas resolutions
      const fontSize = Math.max(18, Math.min(Math.round(canvas.width * 0.032), Math.round(canvas.height * 0.048)));
      ctx.font = `500 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Timeline empty. Upload or transcode HEIC photos to preview.', canvas.width / 2, canvas.height / 2);
      return;
    }

    const currentFrame = frames[currentIndex];
    if (!currentFrame) return;

    const img = new Image();
    img.onload = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Draw background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      
      // Translate to canvas center
      ctx.translate(width / 2, height / 2);

      // Rotation matrix
      if (currentFrame.rotation > 0) {
        ctx.rotate((currentFrame.rotation * Math.PI) / 180);
      }

      // Flip matrix
      if (currentFrame.flipped) {
        ctx.scale(-1, 1);
      }

      // Fit details
      const isRotated90or270 = currentFrame.rotation === 90 || currentFrame.rotation === 270;
      const originalW = (isRotated90or270 ? img.naturalHeight : img.naturalWidth) || 1920;
      const originalH = (isRotated90or270 ? img.naturalWidth : img.naturalHeight) || 1080;
      const frameAspect = originalW / originalH || 16/9;

      let drawW = width;
      let drawH = height;

      if (width / height > frameAspect) {
        drawW = height * frameAspect;
      } else {
        drawH = width / frameAspect;
      }

      if (isRotated90or270) {
        const factor = Math.min(width / originalH, height / originalW) || 1;
        ctx.drawImage(img, -img.naturalWidth * factor / 2, -img.naturalHeight * factor / 2, img.naturalWidth * factor, img.naturalHeight * factor);
      } else {
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      }

      ctx.restore();
    };
    img.onerror = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f38ba8';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Error rendering frame: ${currentFrame.name}`, width / 2, height / 2);
    };
    img.src = currentFrame.url;
  }, [frames, currentIndex, resolutionPreset, aspectRatio]);

  // Calculate resolution outputs
  const getCanvasDimensions = (): { width: number; height: number } => {
    // 1. Determine baseline height or bounding dimension based on preset
    let baseHeight = 1080;
    let baseWidth = 1920;
    
    switch (resolutionPreset) {
      case '4k':
        baseHeight = 2160;
        baseWidth = 3840;
        break;
      case '1080p':
        baseHeight = 1080;
        baseWidth = 1920;
        break;
      case '720p':
        baseHeight = 720;
        baseWidth = 1280;
        break;
      case 'square':
        baseHeight = 1080;
        baseWidth = 1080;
        break;
      case 'source':
      default:
        if (frames.length > 0) {
          const first = frames[0];
          baseWidth = first.width;
          baseHeight = first.height;
        } else {
          baseWidth = 1920;
          baseHeight = 1080;
        }
        break;
    }

    // 2. Adjust based on Output Aspect Ratio
    if (aspectRatio === 'match') {
      if (resolutionPreset === 'square') {
        return { width: 1080, height: 1080 };
      }
      if (resolutionPreset === 'source') {
        if (frames.length > 0) {
          const first = frames[0];
          const maxDim = 1920;
          if (first.width > maxDim || first.height > maxDim) {
            const ratio = first.width / first.height;
            if (first.width > first.height) {
              return { width: maxDim, height: Math.round(maxDim / ratio) };
            } else {
              return { width: Math.round(maxDim * ratio), height: maxDim };
            }
          }
          return { width: first.width, height: first.height };
        }
        return { width: 1920, height: 1080 };
      }
      if (frames.length > 0) {
        const nativeAspect = frames[0].width / frames[0].height;
        if (nativeAspect > 1) {
          return { width: Math.round(baseHeight * nativeAspect), height: baseHeight };
        } else {
          return { width: baseHeight, height: Math.round(baseHeight / nativeAspect) };
        }
      }
      return { width: baseWidth, height: baseHeight };
    }

    // Explicit aspects
    switch (aspectRatio) {
      case '16-9':
        return { width: baseHeight ? Math.round(baseHeight * (16 / 9)) : 1920, height: baseHeight };
      case '4-3':
        return { width: baseHeight ? Math.round(baseHeight * (4 / 3)) : 1440, height: baseHeight };
      case '1-1':
        return { width: baseHeight, height: baseHeight };
      case '9-16':
        return { width: baseHeight ? Math.round(baseHeight * (9 / 16)) : 607, height: baseHeight };
      default:
        return { width: baseWidth, height: baseHeight };
    }
  };

  const { width: renderWidth, height: renderHeight } = getCanvasDimensions();

  // Navigation handlers
  const handleTogglePlay = () => {
    if (frames.length === 0) return;
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleStepBack = () => {
    if (frames.length === 0) return;
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev === 0 ? frames.length - 1 : prev - 1));
  };

  const handleStepForward = () => {
    if (frames.length === 0) return;
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev === frames.length - 1 ? 0 : prev + 1));
  };

  // Compile video action
  const handleCompileVideo = async () => {
    if (frames.length === 0) return;
    setIsPlaying(false);
    setIsCompiling(true);
    setCompileProgress(0);
    setCompileTotal(frames.length);
    setFinishedVideoBlob(null);

    const targetWidth = renderWidth;
    const targetHeight = renderHeight;

    let targetBitrate = 45000000;
    if (encodingQuality === 'standard') {
      targetBitrate = 5000000;
    } else if (encodingQuality === 'pristine') {
      targetBitrate = 95000000;
    }

    try {
      const blob = await compileVideo({
        frames,
        fps: fps * speedFactor,
        width: targetWidth,
        height: targetHeight,
        bitrate: targetBitrate,
        format: exportFormat === 'zip' ? 'mp4' : exportFormat,
        onProgress: (curr, tot) => {
          setCompileProgress(curr);
          setCompileTotal(tot);
        },
      });

      setFinishedVideoBlob(blob);
    } catch (err: any) {
      console.error(err);
      alert(`Export Failed: ${err.message || 'Error occurred compiling timelapse.'}`);
    } finally {
      setIsCompiling(false);
    }
  };

  // Download finished mp4/webm file
  const downloadVideo = () => {
    if (!finishedVideoBlob) return;
    const isMp4 = finishedVideoBlob.type.includes('mp4');
    const extension = isMp4 ? 'mp4' : 'webm';
    const rawURL = URL.createObjectURL(finishedVideoBlob);
    
    const clicker = document.createElement('a');
    clicker.href = rawURL;
    clicker.download = `timelapse_sequence.${extension}`;
    clicker.click();

    setTimeout(() => URL.revokeObjectURL(rawURL), 1000);
  };

  // Delegate master export trigger based on selected exportFormat
  const handleGenerateAndSave = () => {
    if (frames.length === 0) {
      setTimelineError("There is no data in your timeline! Please import some converted JPG photos or drag and drop images onto the timeline area first before generating a timelapse.");
      return;
    }
    if (exportFormat === 'zip') {
      handleDownloadFramesZip();
    } else {
      handleCompileVideo();
    }
  };

  // Compile frames zip (renamed in sequential orders like frame_0001.jpg)
  const handleDownloadFramesZip = async () => {
    if (frames.length === 0) return;
    setIsZipping(true);
    const zip = new JSZip();

    try {
      for (let i = 0; i < frames.length; i++) {
        const item = frames[i];
        
        // Convert blob to arrayBuffer of file
        const response = await fetch(item.url);
        const arrayBuffer = await response.arrayBuffer();

        // 0-padded format (e.g. frame_0001.jpg)
        const paddedNum = String(i + 1).padStart(4, '0');
        const renamedFile = `frame_${paddedNum}.jpg`;
        
        zip.file(renamedFile, arrayBuffer);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const dlUrl = URL.createObjectURL(zipBlob);

      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = 'timelapse_numbered_jpgs.zip';
      a.click();

      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch (err: any) {
      console.error(err);
      alert(`Error zipping sequence: ${err.message}`);
    } finally {
      setIsZipping(false);
    }
  };

  const getDurationString = () => {
    const totalSecs = frames.length / fps;
    const currentSecs = currentIndex / fps;
    
    const format = (secs: number) => {
      const minutes = Math.floor(secs / 60);
      const remainingSeconds = secs % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
    };

    return `${format(currentSecs)} / ${format(totalSecs)}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {children}

      {/* Dynamic Player Sandbox with standard premium borders and controls */}
      <div 
        ref={playerContainerRef}
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg relative p-1.5"
      >
        <div className="bg-black rounded-xl overflow-hidden relative group">
          {/* Aspect Ratio Box Wrapper for proper visual display */}
          <div className="flex items-center justify-center p-4 min-h-[300px] md:min-h-[460px] bg-slate-950 relative">
            <canvas
              ref={canvasRef}
              width={renderWidth}
              height={renderHeight}
              className="rounded shadow-2xl border border-slate-900 max-h-[400px] md:max-h-[500px] max-w-full object-contain"
            />

            {/* Master loading compiled screen */}
            {isCompiling && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-35 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-slate-100">Compiling Timelapse Video</h3>
                <p className="text-slate-400 text-xs mt-2 font-mono">
                  Drawing, rotating, and encoding frame {compileProgress} of {compileTotal}
                </p>
                
                <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                  <div 
                    className="bg-brand-600 h-full transition-all duration-200"
                    style={{ width: `${(compileProgress / compileTotal) * 100}%` }}
                  />
                </div>
                <span className="text-slate-500 font-mono text-[10px] mt-2">
                  Do not navigate away or close your browser tab during compilation
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Scrubber Bar */}
        <div className="px-6 py-3 bg-slate-50/80 flex items-center gap-4">
          <span className="text-slate-400 font-mono text-[10px] font-bold select-none">
            FRAME: {frames.length > 0 ? currentIndex + 1 : 0}/{frames.length}
          </span>
          
          <input
            type="range"
            min="0"
            max={frames.length > 0 ? frames.length - 1 : 0}
            value={frames.length > 0 ? currentIndex : 0}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(parseInt(e.target.value));
            }}
            disabled={frames.length <= 1}
            className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-650 disabled:opacity-30"
          />

          <span className="text-slate-650 font-mono text-xs flex items-center gap-1.5 font-bold select-none">
            <Clock className="w-3.5 h-3.5 text-slate-450" />
            {getDurationString()}
          </span>
        </div>

        {/* Physical Timeline Controls Panel */}
        <div className="py-2 px-4 bg-white flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          
          {/* Main timeline deck buttons */}
          <div className="flex items-center gap-1 w-full sm:w-auto sm:justify-start justify-center">
            <button
              onClick={handleStop}
              disabled={frames.length === 0}
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-lg hover:bg-slate-50"
              title="Stop & Reset"
            >
              <Square className="w-3.5 h-3.5 fill-current text-slate-400" />
            </button>

            <button
              onClick={handleStepBack}
              disabled={frames.length === 0}
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-lg hover:bg-slate-50"
              title="Previous Frame"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleTogglePlay}
              disabled={frames.length === 0}
              className={`p-2 rounded-full border shadow-sm flex items-center justify-center transition-all cursor-pointer ${
                isPlaying 
                  ? 'bg-brand-600 border-brand-500 text-white hover:bg-brand-500 scale-[1.03] shadow-md shadow-brand-100'
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200 scale-100'
              } disabled:opacity-35`}
              title={isPlaying ? 'Pause' : 'Play Timeline'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5 text-slate-800" />
              )}
            </button>

            <button
              onClick={handleStepForward}
              disabled={frames.length === 0}
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-lg hover:bg-slate-50"
              title="Next Frame"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(0);
              }}
              disabled={frames.length === 0}
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-lg hover:bg-slate-50"
              title="Rewind to Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Framerate Slider and configuration tags */}
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            
            {/* FPS Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-[10px] flex items-center gap-1 font-mono">
                <Gauge className="w-3 h-3 text-brand-600" /> PLAY FPS:
              </span>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 py-1 px-2 rounded-lg shadow-inner">
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  className="w-20 sm:w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
                <span className="text-[10px] font-mono font-bold text-brand-600 min-w-[48px] text-right">
                  {fps * speedFactor} FPS
                </span>
              </div>
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => setLoop(!loop)}
              disabled={frames.length === 0}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                loop
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-transparent border-slate-200 text-slate-400'
              }`}
            >
              {loop ? 'Loop' : 'Once'}
            </button>
          </div>

        </div>
      </div>

      {/* Info status if video downloaded */}
      {finishedVideoBlob && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-emerald-800 gap-2 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="font-bold flex items-center gap-1.5 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Master Timelapse Compiled successfully!
            {exportFormat === 'mp4' && !finishedVideoBlob.type.includes('mp4') && (
              <span className="text-[10px] text-emerald-600 bg-emerald-100/50 px-1.5 py-0.5 rounded font-normal ml-1">
                (Firefox fell back to clean WebM due to native MP4 encoder limits)
              </span>
            )}
          </span>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-150 text-emerald-700 font-semibold shadow-sm shrink-0">
            Size: {formatSize(finishedVideoBlob.size)} • {finishedVideoBlob.type.includes('mp4') ? 'MPEG-4 (MP4)' : 'WebM (WEBM)'}
          </span>
        </div>
      )}

      {/* Export Workspace & Settings Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-800 space-y-6 shadow-lg">
        
        {/* CARD HEADER */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-brand-600" />
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Export Settings</h2>
        </div>

        {/* SECTION: Generate & Save Action block */}
        <div className="space-y-3">
          {finishedVideoBlob && exportFormat !== 'zip' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleGenerateAndSave}
                disabled={isCompiling || isZipping}
                className="py-3.5 px-4 bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100/50 hover:border-slate-300 hover:text-black rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                Recompile Timelapse
              </button>
              <button
                onClick={downloadVideo}
                className="py-3.5 px-4 bg-brand-600 border border-transparent hover:border-brand-200 hover:bg-brand-50 hover:text-black text-white rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-brand-200 hover:shadow-lg hover:shadow-brand-200/80"
              >
                <FileVideo className="w-3.5 h-3.5" />
                Export Media Output
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateAndSave}
              disabled={isCompiling || isZipping}
              className="w-full py-4 bg-brand-600 border border-transparent hover:border-brand-200 hover:bg-brand-50 hover:text-black disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-brand-200 hover:shadow-lg hover:shadow-brand-200/80 active:scale-[0.99] disabled:hover:bg-slate-100 disabled:hover:text-slate-400 disabled:hover:border-transparent"
            >
              {isCompiling || isZipping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>PROCESSING SEQUENCE...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 stroke-[3]" />
                  <span>GENERATE & SAVE</span>
                </>
              )}
            </button>
          )}

          <div className="text-center">
            <span className="text-[10px] text-slate-400 font-mono">
              {exportFormat === 'zip' 
                ? `Renames & packages ${frames.length} sequential JPG files inside a ZIP folder.`
                : `Compiles ${frames.length} active frames at ${renderWidth} × ${renderHeight} px.`}
            </span>
          </div>
        </div>

        {/* SECTION: Frame Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Frame Rate</span>
            <span className="bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold px-2.5 py-1 rounded font-mono shadow-sm">
              {fps} FPS
            </span>
          </div>
          
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="60"
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-100 border border-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] font-mono font-medium text-slate-400 px-1 select-none">
              <span>1 FPS</span>
              <span>24 FPS (Cinema)</span>
              <span>30 FPS (Standard)</span>
              <span>60 FPS</span>
            </div>
          </div>
        </div>

        {/* SECTION: Timelapse Speed Factor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Timelapse Speed Factor</span>
            <span className="bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold px-2.5 py-1 rounded font-mono shadow-sm">
              {speedFactor}x {speedFactor === 1 ? '(Normal)' : speedFactor <= 3 ? '(Fast)' : '(Hyper)'}
            </span>
          </div>

          <div className="grid grid-cols-5 p-1 bg-slate-50 border border-slate-200 rounded-xl">
            {[1, 2, 3, 4, 8].map((factor) => (
              <button
                key={factor}
                type="button"
                onClick={() => setSpeedFactor(factor)}
                className={`py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  speedFactor === factor
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {factor}x
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Smooth sequence: Processing every uploaded photo frame in correct order.
          </p>
        </div>

        {/* SECTION: Output Aspect Ratio */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Output Aspect Ratio</span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'match', name: 'Match', sub: 'Auto' },
              { id: '16-9', name: 'Widescreen', sub: '16:9' },
              { id: '4-3', name: 'Classic', sub: '4:3' },
              { id: '1-1', name: 'Square', sub: '1:1' },
              { id: '9-16', name: 'Vertical', sub: '9:16' },
            ].map((aspect) => (
              <button
                key={aspect.id}
                type="button"
                onClick={() => setAspectRatio(aspect.id as any)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-center items-center group ${
                  aspectRatio === aspect.id
                    ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50 hover:border-slate-300 hover:text-black'
                }`}
              >
                <div className="font-bold text-xs transition-colors">
                  {aspect.name}
                </div>
                <div className={`text-[10px] font-mono mt-0.5 transition-colors ${aspectRatio === aspect.id ? 'text-brand-200' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {aspect.sub}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* SECTION 1: Resolution Presets */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Resolution Presets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { id: 'source', name: 'Original Source', desc: frames.length > 0 ? `${frames[0].width} × ${frames[0].height} px (Native)` : 'Native Size' },
              { id: '4k', name: '4K Ultra HD', desc: '3840 × 2160 px' },
              { id: '1080p', name: '1080p Full HD', desc: '1920 × 1080 px' },
              { id: '720p', name: '720p HD Ready', desc: '1280 × 720 px' },
              { id: 'square', name: 'Square Canvas', desc: '1080 × 1080 px' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setResolutionPreset(preset.id as any)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group ${
                  resolutionPreset === preset.id
                    ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50 hover:border-slate-300 hover:text-black'
                }`}
              >
                <div className="font-bold text-xs transition-colors">
                  {preset.name}
                </div>
                <div className={`text-[10px] font-mono mt-1 transition-colors ${resolutionPreset === preset.id ? 'text-brand-200' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 2: Export Format */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Export Format</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'mp4', name: 'MP4 Video', desc: 'Universal H.264', icon: FileVideo },
              { id: 'webm', name: 'WebM Movie', desc: 'Fast HTML5 web', icon: Film },
              { id: 'zip', name: 'Sequenced ZIP', desc: 'For video editors', icon: ImageDown },
            ].map((format) => {
              const Icon = format.icon;
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setExportFormat(format.id as any)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 group ${
                    exportFormat === format.id
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50 hover:border-slate-300 hover:text-black'
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    exportFormat === format.id 
                      ? 'bg-brand-700 text-white' 
                      : 'bg-white text-slate-400 border border-slate-150 group-hover:border-slate-300'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs transition-colors">
                      {format.name}
                    </div>
                    <div className={`text-[10px] font-sans transition-colors ${
                      exportFormat === format.id ? 'text-brand-200' : 'text-slate-400 group-hover:text-slate-600'
                    }`}>
                      {format.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: Video Encoding Quality */}
        {exportFormat !== 'zip' && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Video Encoding Quality</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-50 border border-brand-150 text-brand-600 font-mono">
                  {encodingQuality === 'standard' ? '5 Mbps Standard' : encodingQuality === 'high' ? '45 Mbps Studio' : '95 Mbps Pristine'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'standard', name: 'Standard', desc: '5 Mbps' },
                  { id: 'high', name: 'High', value: '45 Mbps', desc: '45 Mbps' },
                  { id: 'pristine', name: 'Pristine', desc: '95 Mbps' },
                ].map((quality) => (
                  <button
                    key={quality.id}
                    type="button"
                    onClick={() => setEncodingQuality(quality.id as any)}
                    className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer group ${
                      encodingQuality === quality.id
                        ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50 hover:border-slate-300 hover:text-black'
                    }`}
                  >
                    <div className="font-bold text-xs transition-colors">
                      {quality.name}
                    </div>
                    <div className={`text-[10px] font-mono mt-1 transition-colors ${
                      encodingQuality === quality.id ? 'text-brand-200' : 'text-slate-400 group-hover:text-slate-600'
                    }`}>
                      {quality.desc}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans mt-2">
                {encodingQuality === 'standard' && "Balanced bitrates. Optimized for faster web uploads and compact file sizes."}
                {encodingQuality === 'high' && "Crisp studio grade. Ideal for 1080p/4K timelines with ultra-low compression artifacts."}
                {encodingQuality === 'pristine' && "Lossless-grade maximum density. Best for archive master records and high-fidelity projections."}
              </p>
            </div>
          </>
        )}

      </div>

      {/* Modern Pop Alert Modal for Empty Timeline */}
      {timelineError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-650 mb-3">
              <div className="p-2 bg-red-50 rounded-full">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Empty Timeline</h3>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed mb-6 font-medium">
              {timelineError}
            </p>
            <button
              onClick={() => setTimelineError(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer active:scale-95 text-center"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
