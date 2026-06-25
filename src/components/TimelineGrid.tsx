/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Upload, 
  Image as ImageIcon,
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  FlipHorizontal, 
  Copy, 
  Trash2, 
  ArrowUpDown,
  ListRestart,
  RefreshCw,
  FolderOpen,
  Loader2,
  Sparkles
} from 'lucide-react';
import { TimelineFrame } from '../types';
import { convertHEICtoJPG, getImageDimensions } from '../utils/heic';

interface TimelineGridProps {
  frames: TimelineFrame[];
  setFrames: React.Dispatch<React.SetStateAction<TimelineFrame[]>>;
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

export default function TimelineGrid({ frames, setFrames, currentIndex, setCurrentIndex }: TimelineGridProps) {
  const [onTheFlyConverting, setOnTheFlyConverting] = useState<boolean>(false);
  const [onTheFlyCount, setOnTheFlyCount] = useState<number>(0);
  const [onTheFlyTotal, setOnTheFlyTotal] = useState<number>(0);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger file browse
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Handle files upload (JPG, PNG, WEBP, and HEIC with on-the-fly converters)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const uploadedList: File[] = Array.from(rawFiles) as File[];
    setOnTheFlyCount(0);
    setOnTheFlyTotal(uploadedList.length);
    setOnTheFlyConverting(true);

    const newFrames: TimelineFrame[] = [];

    for (let i = 0; i < uploadedList.length; i++) {
      const file = uploadedList[i];
      const nameLower = file.name.toLowerCase();
      const isHeic = nameLower.endsWith('.heic') || nameLower.endsWith('.heif');

      setOnTheFlyCount(i + 1);

      try {
        let finalBlob: Blob = file;
        let finalUrl = '';

        if (isHeic) {
          // Convert HEIC on-the-fly
          finalBlob = await convertHEICtoJPG(file);
          finalUrl = URL.createObjectURL(finalBlob);
        } else {
          finalUrl = URL.createObjectURL(file);
        }

        const dimensions = await getImageDimensions(finalUrl);

        newFrames.push({
          id: crypto.randomUUID(),
          name: isHeic ? file.name.replace(/\.(heic|heif)$/i, '') + '.jpg' : file.name,
          size: finalBlob.size,
          url: finalUrl,
          blob: finalBlob,
          width: dimensions.width,
          height: dimensions.height,
          rotation: 0,
          flipped: false,
          aspectRatio: dimensions.width / dimensions.height,
        });
      } catch (err: any) {
        console.error(`Failed to ingest frame "${file.name}": `, err);
      }
    }

    setFrames((prev) => [...prev, ...newFrames]);
    setOnTheFlyConverting(false);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Re-ordering frame adjustments
  const moveLeft = (index: number) => {
    if (index === 0) return;
    setFrames((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy;
    });
    if (currentIndex === index) {
      setCurrentIndex(index - 1);
    } else if (currentIndex === index - 1) {
      setCurrentIndex(index);
    }
  };

  const moveRight = (index: number) => {
    if (index === frames.length - 1) return;
    setFrames((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy;
    });
    if (currentIndex === index) {
      setCurrentIndex(index + 1);
    } else if (currentIndex === index + 1) {
      setCurrentIndex(index);
    }
  };

  const duplicateFrame = (index: number) => {
    setFrames((prev) => {
      const copy = [...prev];
      const src = copy[index];
      const duplicated: TimelineFrame = {
        ...src,
        id: crypto.randomUUID(),
        name: `${src.name.replace(/\.jpg$/i, '')}_copy.jpg`,
      };
      copy.splice(index + 1, 0, duplicated);
      return copy;
    });
  };

  const deleteFrame = (index: number) => {
    const target = frames[index];
    if (target) {
      URL.revokeObjectURL(target.url);
    }
    setFrames((prev) => prev.filter((_, idx) => idx !== index));
    
    // adjust selected index if out of limits
    if (currentIndex >= frames.length - 1 && frames.length > 1) {
      setCurrentIndex(frames.length - 2);
    }
  };

  const rotateFrame = (index: number) => {
    setFrames((prev) =>
      prev.map((f, idx) =>
        idx === index ? { ...f, rotation: (f.rotation + 90) % 360 } : f
      )
    );
  };

  const flipFrame = (index: number) => {
    setFrames((prev) =>
      prev.map((f, idx) =>
        idx === index ? { ...f, flipped: !f.flipped } : f
      )
    );
  };

  // Batch actions
  const handleSortAZ = () => {
    setFrames((prev) => {
      const copy = [...prev];
      return copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    });
    setCurrentIndex(0);
  };

  const handleSortZA = () => {
    setFrames((prev) => {
      const copy = [...prev];
      return copy.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
    });
    setCurrentIndex(0);
  };

  const handleReverse = () => {
    setFrames((prev) => [...prev].reverse());
    setCurrentIndex(0);
  };

  const handleRotateAll90 = () => {
    setFrames((prev) =>
      prev.map((f) => ({ ...f, rotation: (f.rotation + 90) % 360 }))
    );
  };

  const handleClearAll = () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000);
      return;
    }
    frames.forEach((f) => URL.revokeObjectURL(f.url));
    setFrames([]);
    setCurrentIndex(0);
    setIsConfirmingClear(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB'][i];
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      
      {/* Header and Batch Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-150 pb-6">
        <div>
          <h3 className="text-xs font-bold text-slate-800 font-mono tracking-wider uppercase">
            Timeline Storyboard ({frames.length} frames)
          </h3>
          <p className="text-slate-500 text-xs mt-1">
            Sort, duplicate, rotate individual photos or apply batch ordering to perfect your timing sequences.
          </p>
        </div>

        {/* Action Suite */}
        <div className="flex flex-wrap items-center gap-2">
          {/* A-Z Sort */}
          <button
            onClick={handleSortAZ}
            disabled={frames.length <= 1}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Sort frames matching numeric alphabetical order inside names"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-brand-600" />
            <span>Sort Name (A-Z)</span>
          </button>

          {/* Z-A Sort */}
          <button
            onClick={handleSortZA}
            disabled={frames.length <= 1}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            Sort (Z-A)
          </button>

          {/* Reverse Timeline */}
          <button
            onClick={handleReverse}
            disabled={frames.length <= 1}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <ListRestart className="w-3.5 h-3.5 text-brand-600" />
            <span>Reverse Order</span>
          </button>

          {/* Rotate All */}
          <button
            onClick={handleRotateAll90}
            disabled={frames.length === 0}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Rotate All 90°</span>
          </button>

          {/* Clear frames */}
          <button
            onClick={handleClearAll}
            disabled={frames.length === 0}
            className={`px-3.5 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isConfirmingClear
                ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 animate-pulse'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-none'
            }`}
          >
            <Trash2 className={`w-3.5 h-3.5 ${isConfirmingClear ? 'text-white' : 'text-rose-600'}`} />
            <span>{isConfirmingClear ? 'Click Again to Clear!' : 'Clear Timeline'}</span>
          </button>
        </div>
      </div>

      {/* Upload files into sequence inline */}
      <div className="flex items-center gap-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          multiple
          accept="image/*,.heic,.heif"
          className="hidden"
          id="timeline-uploader"
        />

        <button
          onClick={triggerFileInput}
          disabled={onTheFlyConverting}
          className="px-5 py-3 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer shadow-md shadow-brand-150"
        >
          {onTheFlyConverting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Decoding HEIC list ({onTheFlyCount}/{onTheFlyTotal})...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 ml-0.5 text-white" />
              <span>Add Photos to Timeline</span>
            </>
          )}
        </button>

        <span className="text-xs text-slate-400 font-mono">
          Supports JPG, PNG, WEBP and automatic on-the-fly HEIC processing
        </span>
      </div>

      {/* Frame Queue Matrix Grid */}
      {frames.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {frames.map((frame, index) => {
            const isSelected = currentIndex === index;

            return (
              <div
                key={frame.id}
                onClick={() => setCurrentIndex(index)}
                className={`relative bg-slate-50 border rounded-2xl overflow-hidden group transition-all duration-200 flex flex-col justify-between cursor-pointer shadow-sm ${
                  isSelected 
                    ? 'border-brand-500 bg-white shadow-md shadow-brand-100 ring-2 ring-brand-500/20 z-10' 
                    : 'border-slate-200 hover:border-brand-300 hover:bg-white'
                }`}
              >
                {/* Image panel with layout metrics */}
                <div className="aspect-square bg-slate-100 flex items-center justify-center p-2 relative overflow-hidden select-none">
                  
                  {/* Frame Index Badge */}
                  <span className="absolute top-1.5 left-1.5 bg-slate-900/90 text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded border border-slate-700/50 z-10">
                    #{index + 1}
                  </span>

                  {/* Dimension parameters */}
                  <span className="absolute bottom-1.5 left-1.5 bg-slate-900/90 text-slate-300 font-mono text-[8px] px-1.5 py-0.5 rounded border border-slate-700/50 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    {frame.width}×{frame.height}
                  </span>

                  <img
                    src={frame.url}
                    alt={`Frame ${index + 1}`}
                    className="w-full h-full object-cover rounded transition-all duration-300"
                    style={{
                      transform: `rotate(${frame.rotation}deg) scale(${frame.flipped ? '-1, 1' : '1, 1'})`,
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Detail column with parameters */}
                <div className="p-3 space-y-1.5 pb-2">
                  <div className="flex items-center justify-between min-w-0 gap-1.5">
                    <p className="text-slate-800 text-[10px] font-bold truncate flex-grow leading-tight" title={frame.name}>
                      {frame.name}
                    </p>
                    <span className="text-[9px] text-slate-450 font-mono font-semibold flex-shrink-0">
                      {formatSize(frame.size)}
                    </span>
                  </div>

                  {/* Dynamic control tools on each card */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-slate-400">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rotateFrame(index);
                        }}
                        className="p-1 hover:text-brand-650 hover:bg-slate-100 rounded transition-all"
                        title="Rotate 90 degrees Clockwise"
                      >
                        <RotateCw className="w-3 h-3 text-brand-600" />
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          flipFrame(index);
                        }}
                        className="p-1 hover:text-brand-650 hover:bg-slate-100 rounded transition-all"
                        title="Flip Horizontally"
                      >
                        <FlipHorizontal className="w-3 h-3 text-brand-600" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateFrame(index);
                        }}
                        className="p-1 hover:text-brand-650 hover:bg-slate-100 rounded transition-all"
                        title="Duplicate frame"
                      >
                        <Copy className="w-3 h-3 text-brand-600" />
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFrame(index);
                      }}
                      className="p-1 hover:text-rose-600 hover:bg-slate-100 rounded transition-all"
                      title="Delete Frame"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                    </button>
                  </div>
                </div>

                {/* Quick Shift ordering overlay */}
                <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLeft(index);
                    }}
                    disabled={index === 0}
                    className="p-1 bg-white border border-slate-205 text-slate-600 hover:bg-slate-50 disabled:opacity-20 hover:text-slate-900 rounded shadow-sm cursor-pointer"
                    title="Move Frame Backward"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveRight(index);
                    }}
                    disabled={index === frames.length - 1}
                    className="p-1 bg-white border border-slate-205 text-slate-600 hover:bg-slate-50 disabled:opacity-20 hover:text-slate-900 rounded shadow-sm cursor-pointer"
                    title="Move Frame Forward"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-250 bg-slate-50/50 rounded-2xl p-16 text-center text-slate-400">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold text-sm">Your timeline storyboard is empty</p>
          <p className="text-slate-400 text-xs mt-1">
            Click &quot;Add Photos&quot; above, drag folders here, or import converted JPEGs from the HEIC tab!
          </p>
        </div>
      )}
    </div>
  );
}
