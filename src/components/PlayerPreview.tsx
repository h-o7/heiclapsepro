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
  Clock
} from 'lucide-react';
import { TimelineFrame } from '../types';
import { compileVideo, getSupportedMimeType } from '../utils/recorder';
import JSZip from 'jszip';

interface PlayerPreviewProps {
  frames: TimelineFrame[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

export default function PlayerPreview({ frames, currentIndex, setCurrentIndex }: PlayerPreviewProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(10);
  const [loop, setLoop] = useState<boolean>(true);
  const [aspectRatioSetting, setAspectRatioSetting] = useState<'source' | '16-9' | '4-3' | '1-1'>('16-9');
  
  // Video compile states
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileProgress, setCompileProgress] = useState<number>(0);
  const [compileTotal, setCompileTotal] = useState<number>(0);
  const [finishedVideoBlob, setFinishedVideoBlob] = useState<Blob | null>(null);

  // Frames ZIP state
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Handle auto playback timer
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const intervalMs = 1000 / fps;
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
  }, [isPlaying, fps, loop, frames.length, setCurrentIndex]);

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
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Timeline empty. Upload or transcode HEIC photos to preview.', canvas.width / 2, canvas.height / 2);
      return;
    }

    const currentFrame = frames[currentIndex];
    if (!currentFrame) return;

    const img = new Image();
    img.src = currentFrame.url;
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
      const originalW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
      const originalH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;
      const frameAspect = originalW / originalH;

      let drawW = width;
      let drawH = height;

      if (width / height > frameAspect) {
        drawW = height * frameAspect;
      } else {
        drawH = width / frameAspect;
      }

      if (isRotated90or270) {
        const factor = Math.min(width / originalH, height / originalW);
        ctx.drawImage(img, -img.naturalWidth * factor / 2, -img.naturalHeight * factor / 2, img.naturalWidth * factor, img.naturalHeight * factor);
      } else {
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      }

      ctx.restore();
    };
  }, [frames, currentIndex, aspectRatioSetting]);

  // Calculate resolution outputs
  const getCanvasDimensions = (): { width: number; height: number } => {
    if (frames.length > 0 && aspectRatioSetting === 'source') {
      const first = frames[0];
      // Bound it so it's not overly large for rendering canvas
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

    switch (aspectRatioSetting) {
      case '16-9':
        return { width: 1280, height: 720 };
      case '4-3':
        return { width: 960, height: 720 };
      case '1-1':
        return { width: 800, height: 800 };
      default:
        return { width: 1280, height: 720 };
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

    try {
      const blob = await compileVideo({
        frames,
        fps,
        width: targetWidth,
        height: targetHeight,
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
    const extension = getSupportedMimeType().includes('mp4') ? 'mp4' : 'webm';
    const rawURL = URL.createObjectURL(finishedVideoBlob);
    
    const clicker = document.createElement('a');
    clicker.href = rawURL;
    clicker.download = `timelapse_sequence.${extension}`;
    clicker.click();

    setTimeout(() => URL.revokeObjectURL(rawURL), 1000);
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
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-slate-100">Compiling Timelapse Video</h3>
                <p className="text-slate-400 text-xs mt-2 font-mono">
                  Drawing, rotating, and encoding frame {compileProgress} of {compileTotal}
                </p>
                
                <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-200"
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
        <div className="px-6 py-3 border-t border-slate-150 bg-slate-50/80 flex items-center gap-4">
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
            className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-650 disabled:opacity-30"
          />

          <span className="text-slate-650 font-mono text-xs flex items-center gap-1.5 font-bold select-none">
            <Clock className="w-3.5 h-3.5 text-slate-450" />
            {getDurationString()}
          </span>
        </div>

        {/* Physical Timeline Controls Panel */}
        <div className="p-6 bg-white border-t border-slate-150 flex flex-col md:flex-row gap-6 md:items-center justify-between">
          
          {/* Main timeline deck buttons */}
          <div className="flex items-center gap-1.5 w-full md:w-auto md:justify-start justify-center">
            <button
              onClick={handleStop}
              disabled={frames.length === 0}
              className="p-3 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-xl hover:bg-slate-50"
              title="Stop & Reset"
            >
              <Square className="w-4 h-4 fill-current text-slate-400" />
            </button>

            <button
              onClick={handleStepBack}
              disabled={frames.length === 0}
              className="p-3 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-xl hover:bg-slate-50"
              title="Previous Frame"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={handleTogglePlay}
              disabled={frames.length === 0}
              className={`p-4 rounded-full border shadow-md flex items-center justify-center transition-all cursor-pointer ${
                isPlaying 
                  ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 scale-[1.03] shadow-lg shadow-indigo-200'
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200 scale-100 shadow-sm'
              } disabled:opacity-35`}
              title={isPlaying ? 'Pause' : 'Play Timeline'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current text-white" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5 text-slate-800" />
              )}
            </button>

            <button
              onClick={handleStepForward}
              disabled={frames.length === 0}
              className="p-3 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-xl hover:bg-slate-50"
              title="Next Frame"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(0);
              }}
              disabled={frames.length === 0}
              className="p-3 text-slate-400 hover:text-slate-700 disabled:opacity-35 disabled:hover:text-slate-400 transition-all cursor-pointer rounded-xl hover:bg-slate-50"
              title="Rewind to Start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Framerate Slider and configuration tags */}
          <div className="flex flex-col sm:flex-row gap-6 md:items-center">
            
            {/* FPS Selector */}
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 text-slate-500 font-bold text-xs flex items-center gap-1 font-mono">
                <Gauge className="w-3.5 h-3.5 text-indigo-600" /> PLAY FPS:
              </span>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-xl shadow-inner">
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-mono font-bold text-indigo-600 min-w-[44px] text-right">{fps} FPS</span>
              </div>
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => setLoop(!loop)}
              disabled={frames.length === 0}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                loop
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-transparent border-slate-200 text-slate-400'
              }`}
            >
              {loop ? 'Loop Play' : 'Once-Through'}
            </button>
          </div>

        </div>
      </div>

      {/* Export Workspace & Settings Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Setting 1: Playback aspect ratios */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <span className="text-xs text-slate-450 font-mono tracking-wider uppercase flex items-center gap-1.5 font-bold">
            <Expand className="w-3.5 h-3.5 text-indigo-600" />
            Aspect Framing Plan
          </span>
          
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Original Source', value: 'source' },
              { label: 'Widescreen (16:9)', value: '16-9' },
              { label: 'Standard (4:3)', value: '4-3' },
              { label: 'Square (1:1)', value: '1-1' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setAspectRatioSetting(option.value as any)}
                className={`py-3 px-3.5 text-xs text-center border font-semibold rounded-xl transition-all cursor-pointer ${
                  aspectRatioSetting === option.value
                    ? 'bg-indigo-50 border-indigo-350 text-indigo-750 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50 hover:text-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
            {aspectRatioSetting === 'source' 
              ? 'Calculated dynamically based on initial storyboard dimensions.'
              : `Enforces standard target output container of ${renderWidth} × ${renderHeight} pixels.`}
          </p>
        </div>

        {/* Setting 2: Sequence ZIP Downloader */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="space-y-2">
            <span className="text-xs text-slate-450 font-mono tracking-wider uppercase flex items-center gap-1.5 font-bold">
              <ImageDown className="w-3.5 h-3.5 text-indigo-600" />
              ZIP Numbered Frames
            </span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Consolidates all current timeline photos in a single ZIP container, renamed sequentially (e.g. `frame_0001.jpg`, `frame_0002.jpg`), optimized for native integration with After Effects, Premiere, or DaVinci.
            </p>
          </div>

          <button
            onClick={handleDownloadFramesZip}
            disabled={frames.length === 0 || isZipping}
            className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            {isZipping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                <span>Renaming & packaging...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Sequence ZIP ({frames.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Setting 3: Render and Export MP4/WebM Video */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="space-y-2">
            <span className="text-xs text-slate-450 font-mono tracking-wider uppercase flex items-center gap-1.5 font-bold">
              <Film className="w-3.5 h-3.5 text-indigo-600" />
              Compile Master Output
            </span>
            <p className="text-slate-500 text-xs leading-relaxed">
              Sequentially renders frames matching speed plans into raw track buffers and exports a fully processed, standalone video compatible with all media devices.
            </p>
          </div>

          {finishedVideoBlob ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCompileVideo}
                className="py-3 px-2 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer bg-white"
              >
                Recompile
              </button>
              <button
                onClick={downloadVideo}
                className="py-3 px-2 bg-emerald-650 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md shadow-emerald-100"
              >
                <FileVideo className="w-3.5 h-3.5 text-white" />
                Export Media
              </button>
            </div>
          ) : (
            <button
              onClick={handleCompileVideo}
              disabled={frames.length === 0 || isCompiling}
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 text-white disabled:bg-slate-105 disabled:text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-150"
            >
              <FileVideo className="w-3.5 h-3.5" />
              <span>Compile & Save Video Block</span>
            </button>
          )}
        </div>

      </div>

      {/* Info status if video downloaded */}
      {finishedVideoBlob && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between text-xs text-emerald-800 gap-2 shadow-sm">
          <span className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Master Timelapse Compiled successfully!
          </span>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-150 text-emerald-700 font-semibold shadow-sm">
            Size: {formatSize(finishedVideoBlob.size)} • {getSupportedMimeType().includes('mp4') ? 'MPEG-4 Container' : 'WebM Streams'}
          </span>
        </div>
      )}
    </div>
  );
}
