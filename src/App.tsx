/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  RefreshCw, 
  Github, 
  Info,
  Terminal,
  RefreshCw as RefreshIcon
} from 'lucide-react';
import HEICConverter from './components/HEICConverter';
import WorkLog from './components/WorkLog';
import { ActiveTab } from './types';
import packageJson from '../package.json';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('converter');

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-brand-500/20 selection:text-brand-900">
      
      {/* Top Professional Control Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-150">
              <RefreshCw className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-800 flex items-center gap-2">
                HEIC Batch Converter Pro
                <span className="text-[10px] bg-brand-50 text-brand-600 font-mono font-bold px-2 py-0.5 rounded border border-brand-100">
                  v{packageJson.version}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                High-performance offline batch image converter & resizer
              </p>
            </div>
          </div>

          {/* Single-screen tab switches */}
          <div className="flex bg-slate-100 border border-slate-200/80 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setActiveTab('converter')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'converter'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              <span>HEIC Batch Converter</span>
            </button>

            <button
              onClick={() => setActiveTab('worklog')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'worklog'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Work Log</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Sandbox Workspace Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activeTab === 'converter' && (
          /* SECTION 1: Decoupled HEIC to JPG Batch transcoder */
          <div className="animate-fade-in">
            <HEICConverter />
          </div>
        )}

        {activeTab === 'worklog' && (
          /* SECTION 2: Detailed Telemetry Transcode Work Log */
          <div className="animate-fade-in">
            <WorkLog />
          </div>
        )}
      </main>

      {/* Trust & Privacy Guard footer */}
      <footer className="border-t border-slate-200/60 bg-slate-50/40 py-6 px-6 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <p className="text-[10px] text-slate-400 leading-normal max-w-2xl">
              <strong className="text-slate-500 font-semibold">100% Browser Sealed Privacy Guarantee:</strong> No images or metadata details are processed on external servers. All custom HEIC transcodes, aspect orientations, and image resizing operations are run completely locally inside browser storage context via high performance WebAssembly decoders and canvas context, safeguarding original quality and bandwidth.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3.5 text-[10px] font-mono text-slate-400">
            <span>Powered by heic2any & JSZip</span>
            <span>•</span>
            <a 
              href="https://github.com/h-o7/HEICBatchConverter" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-brand-500 hover:text-brand-600 hover:underline flex items-center gap-1.5 font-bold transition-colors cursor-pointer"
              title="Need 10-bit HDR HEIC conversion? Get the Electron Desktop App from GitHub!"
            >
              <Github className="w-3 h-3 text-brand-500" />
              <span>HEIC Batch Converter Github</span>
            </a>
            <span>•</span>
            <span>Google AI Studio Applet</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
