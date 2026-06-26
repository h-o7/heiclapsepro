/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Trash2, 
  Download, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Settings,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import { logger, LogEntry } from '../utils/logger';

export default function WorkLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'system' | 'converter' | 'compiler'>('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleBodyRef = useRef<HTMLDivElement>(null);

  // Subscribe to logger updates
  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, []);

  // Handle auto-scrolling
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    const formattedText = logs
      .map(l => `[${l.timestamp}] [${l.category.toUpperCase()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    
    navigator.clipboard.writeText(formattedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Export logs as a file
  const handleExportLogs = () => {
    const formattedText = logs
      .map(l => `[${l.timestamp}] [${l.category.toUpperCase()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chronos_transcode_log_${new Date().toISOString().slice(0, 10)}.log`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear the logs? This will reset the workspace telemetry buffer.')) {
      logger.clear();
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    const matchesSearch = 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.level.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesLevel && matchesSearch;
  });

  // Calculate stats
  const errorCount = logs.filter(l => l.level === 'error').length;
  const warningCount = logs.filter(l => l.level === 'warn').length;
  const successCount = logs.filter(l => l.level === 'success').length;

  return (
    <div id="worklog-container" className="grid grid-cols-1 gap-6 animate-fade-in">
      
      {/* Telemetry Control Dashboard */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Terminal className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-800">Transcode & Stream Telemetry Logs</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Real-time internal processing telemetry. Use this panel to inspect frame pacing, encoder allocations, container wrappers, and error bounds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="Copy logs to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500 animate-scale-up" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Logs</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportLogs}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-50 border border-brand-100 text-brand-700 hover:bg-brand-100/80 transition-all cursor-pointer"
            title="Download full log file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log File</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-50 border border-red-100 text-red-600 hover:bg-red-100/80 transition-all cursor-pointer"
            title="Clear the telemetry buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertCircle className={`w-5 h-5 text-red-500 ${errorCount > 0 ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">Transcode Errors</div>
            <div className={`text-xl font-extrabold font-mono ${errorCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>{errorCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">Encoder Warnings</div>
            <div className="text-xl font-extrabold font-mono text-slate-700">{warningCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">System Successes</div>
            <div className="text-xl font-extrabold font-mono text-slate-700">{successCount}</div>
          </div>
        </div>
      </div>

      {/* Main Console Layout */}
      <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
        
        {/* Terminal Header & Toolbar */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Terminal Window dots */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 block"></span>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400 border-l border-slate-800 pl-3">
              bash - chronos_transcode.log
            </span>
          </div>

          {/* Interactive Filters */}
          <div className="flex flex-wrap items-center gap-3.5">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-48 lg:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search log messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs font-mono bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
              />
            </div>

            {/* Category Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">Module:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono font-semibold text-slate-300 px-2 py-1.5 focus:outline-none focus:border-slate-600 cursor-pointer"
              >
                <option value="all">All Modules</option>
                <option value="system">System Core</option>
                <option value="converter">Folder Transcoder</option>
                <option value="compiler">Timelapse Compiler</option>
              </select>
            </div>

            {/* Level Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">Level:</span>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono font-semibold text-slate-300 px-2 py-1.5 focus:outline-none focus:border-slate-600 cursor-pointer"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warnings</option>
                <option value="error">Errors</option>
                <option value="success">Success</option>
              </select>
            </div>

            {/* Auto Scroll Toggle */}
            <label className="flex items-center gap-1.5 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-800 bg-slate-900 text-brand-600 focus:ring-brand-500 focus:ring-offset-slate-950 w-3.5 h-3.5"
              />
              <span className="text-[10px] font-mono text-slate-400">Auto-scroll</span>
            </label>

          </div>
        </div>

        {/* Console logs body */}
        <div 
          ref={consoleBodyRef}
          className="p-6 h-[480px] overflow-y-auto font-mono text-[11px] leading-relaxed select-text bg-slate-950/40"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 gap-2.5">
              <Terminal className="w-8 h-8 text-slate-800 animate-pulse" />
              <div>
                <p className="font-bold">No telemetry matches current filter criteria.</p>
                <p className="text-[10px] text-slate-700 mt-0.5">Start an HEIC folder transcode or click "Compile Timelapse" to capture active logs.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => {
                // Determine styling based on level
                let levelBadgeStyle = 'text-slate-400 border border-slate-800 bg-slate-900/30';
                let messageStyle = 'text-slate-300';
                
                if (log.level === 'warn') {
                  levelBadgeStyle = 'text-amber-400 border border-amber-950 bg-amber-950/20';
                  messageStyle = 'text-amber-200/90';
                } else if (log.level === 'error') {
                  levelBadgeStyle = 'text-red-400 border border-red-950 bg-red-950/20';
                  messageStyle = 'text-red-200/90';
                } else if (log.level === 'success') {
                  levelBadgeStyle = 'text-emerald-400 border border-emerald-950 bg-emerald-950/20';
                  messageStyle = 'text-emerald-200/90';
                } else if (log.level === 'info') {
                  levelBadgeStyle = 'text-blue-400 border border-blue-950 bg-blue-950/20';
                  messageStyle = 'text-blue-100/95';
                }

                let categoryStyle = 'text-slate-500';
                if (log.category === 'system') categoryStyle = 'text-purple-400';
                else if (log.category === 'converter') categoryStyle = 'text-cyan-400';
                else if (log.category === 'compiler') categoryStyle = 'text-pink-400';

                return (
                  <div key={log.id} className="flex items-start gap-3 hover:bg-slate-900/40 py-0.5 px-1.5 rounded transition-colors group">
                    <span className="text-slate-600 select-none tracking-tighter shrink-0">{log.timestamp}</span>
                    
                    <span className={`w-16 text-center text-[9px] uppercase tracking-wide px-1.5 rounded font-bold select-none shrink-0 ${levelBadgeStyle}`}>
                      {log.level}
                    </span>
                    
                    <span className={`w-20 font-semibold select-none text-[10px] shrink-0 ${categoryStyle}`}>
                      [{log.category.toUpperCase()}]
                    </span>

                    <span className={`flex-1 break-all whitespace-pre-wrap ${messageStyle}`}>
                      {log.message}
                    </span>
                  </div>
                );
              })}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>

        {/* Console Status Bar */}
        <div className="bg-slate-950/80 px-6 py-2.5 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-emerald-500">Telemetry Stream Connected</span>
            </span>
            <span>•</span>
            <span>Buffered logs: {logs.length}</span>
            {filteredLogs.length !== logs.length && (
              <>
                <span>•</span>
                <span className="text-slate-400">Filtered: {filteredLogs.length}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600/80" />
            <span>Local sandbox isolated</span>
          </div>
        </div>

      </div>

    </div>
  );
}
