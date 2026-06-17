/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Film, 
  RefreshCw, 
  Clock, 
  Github, 
  HelpCircle,
  FileImage,
  Sparkles,
  Info
} from 'lucide-react';
import PlayerPreview from './components/PlayerPreview';
import TimelineGrid from './components/TimelineGrid';
import HEICConverter from './components/HEICConverter';
import { TimelineFrame, ActiveTab } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('converter');
  const [frames, setFrames] = useState<TimelineFrame[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Appends converted JPGs straight into the Timelapse timeline
  const handleAddConvertedToTimelapse = (newFramesFetched: Omit<TimelineFrame, 'id'>[]) => {
    const formattedFrames: TimelineFrame[] = newFramesFetched.map(f => ({
      ...f,
      id: crypto.randomUUID()
    }));

    setFrames((prev) => [...prev, ...formattedFrames]);
    
    // Switch to Timelapse tab automatically so user can watch the result!
    setActiveTab('timelapse');
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      
      {/* Top Professional Control Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-150">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-800 flex items-center gap-2">
                Chronos Pro Studio
                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-2 py-0.5 rounded border border-indigo-100">
                  v1.2
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                HEIC folder transcoder and premium browser timelapse builder
              </p>
            </div>
          </div>

          {/* Single-screen tab switches */}
          <div className="flex bg-slate-100 border border-slate-200/80 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setActiveTab('converter')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'converter'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>HEIC Batch Converter</span>
            </button>

            <button
              onClick={() => setActiveTab('timelapse')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'timelapse'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Timelapse Workspace</span>
              {frames.length > 0 && (
                <span className={`px-1.5 py-0.5 font-mono text-[9px] rounded font-bold ${
                  activeTab === 'timelapse' 
                    ? 'bg-indigo-900/20 text-indigo-100' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {frames.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Sandbox Workspace Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activeTab === 'timelapse' ? (
          /* SECTION 1: Interlocking Time lapse workspace */
          <div className="grid grid-cols-1 gap-6">
            
            {/* Player preview frame container */}
            <PlayerPreview 
              frames={frames} 
              currentIndex={currentIndex} 
              setCurrentIndex={setCurrentIndex} 
            />

            {/* Sequence list storyboard container */}
            <TimelineGrid 
              frames={frames} 
              setFrames={setFrames} 
              currentIndex={currentIndex} 
              setCurrentIndex={setCurrentIndex} 
            />

          </div>
        ) : (
          /* SECTION 2: Decoupled HEIC to JPG Batch transcoder */
          <HEICConverter 
            onAddToTimelapse={handleAddConvertedToTimelapse}
            timelapseFrameCount={frames.length}
          />
        )}
      </main>

      {/* Trust & Privacy Guard footer */}
      <footer className="border-t border-slate-200 bg-white py-10 px-6 mt-12 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-slate-400" />
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-xl">
              <strong className="text-slate-700">100% Browser Sealed Privacy Guarantee:</strong> No images or metadata details are processed on external servers. All custom HEIC transcodes, aspect orientations, storyboard timelines, and video compiles are run completely locally inside browser storage context via high performance web workers, safeguarding original quality and bandwidth.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span>Powered by heic2any & JSZip</span>
            <span>•</span>
            <span>Google AI Studio Applet</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
