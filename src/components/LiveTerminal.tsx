import React, { useState } from 'react';
import { TerminalLog } from '../types';
import { Terminal, CornerDownLeft, CircleDot, Play, Trash2 } from 'lucide-react';
import { RETRO_COMMANDS } from '../data';

interface LiveTerminalProps {
  logs: TerminalLog[];
  onClearLogs: () => void;
  onExecuteCommand: (cmdString: string) => void;
}

export default function LiveTerminal({
  logs,
  onClearLogs,
  onExecuteCommand
}: LiveTerminalProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onExecuteCommand(inputValue.trim());
    setInputValue('');
  };

  const handleCommandQuickrun = (cmdText: string) => {
    onExecuteCommand(cmdText);
  };

  return (
    <div id="live_terminal_container" className="border-4 border-black bg-neutral-950 text-[#00FF66] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none flex flex-col overflow-hidden max-w-7xl mx-auto my-6">
      {/* Terminal Title Bar */}
      <div className="bg-neutral-900 border-b-2 border-black p-3 flex justify-between items-center text-xs font-mono select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-yellow-400 animate-pulse" />
          <span className="font-extrabold text-white">SA FORGE - LIVE TRADING TERMINAL v1.1_SECURE</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <CircleDot className="w-3 h-3 text-[#00FF66] animate-ping" />
            <span className="text-[10px] text-gray-400">FEED_STREAM: ACTIVE</span>
          </div>
          <button 
            onClick={onClearLogs}
            className="p-1 bg-neutral-800 hover:bg-neutral-700 text-rose-400 border border-black hover:text-rose-300 rounded shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
            title="Sapu bersih log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[320px] overflow-hidden">
        {/* Command Guidelines Drawer (Left side) */}
        <div className="w-full lg:w-72 bg-neutral-900/60 p-4 border-b lg:border-b-0 lg:border-r border-black font-mono text-[10px] text-gray-400 overflow-y-auto max-h-[120px] lg:max-h-full">
          <div className="font-black text-white uppercase text-xs tracking-wide mb-2 pb-1 border-b border-neutral-800 text-yellow-400">
            Daftar Perintah Terminal
          </div>
          <p className="mb-3 leading-relaxed text-[9.5px]">
            Masukan perintah cepat secara manual di bawah, atau klik ikon putar <Play className="w-2.5 h-2.5 inline mx-0.5 py-0" /> di samping petunjuk instan:
          </p>
          <div className="space-y-2">
            {RETRO_COMMANDS.map((item, index) => (
              <div 
                key={`cmd-gui-${index}`} 
                className="p-1.5 hover:bg-neutral-800/80 border border-transparent hover:border-neutral-700 transition-all flex justify-between items-start gap-1 group rounded"
              >
                <div>
                  <span className="text-yellow-300 font-bold block">{item.cmd}</span>
                  <span className="text-[9.5px] italic text-neutral-500">{item.desc}</span>
                </div>
                <button 
                  onClick={() => handleCommandQuickrun(item.cmd.split(' <')[0])}
                  className="translate-y-0.5 opacity-60 group-hover:opacity-100 hover:text-white text-emerald-400"
                  title="Jalankan instan"
                >
                  <Play className="w-3 h-3 cursor-pointer" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live log monitors */}
        <div className="flex-1 flex flex-col justify-between bg-neutral-950 p-4">
          <div 
            id="terminal_output_scroll" 
            className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed pr-2 h-full select-text max-h-[200px] lg:max-h-full"
          >
            {logs.length === 0 ? (
              <div className="text-neutral-500 italic text-center py-10">
                &gt;&gt; Sunyi di terminal... Menunggu perintah atau fluktuasi harga global &lt;&lt;
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-1">
                  <span className="text-neutral-500 select-none">[{log.timestamp}]</span>
                  <span className={`font-semibold ${
                    log.type === 'success' ? 'text-emerald-400' :
                    log.type === 'error' ? 'text-rose-500 font-bold' :
                    log.type === 'warning' ? 'text-amber-400' :
                    log.type === 'trade' ? 'text-[#00FFFF] font-bold' : 'text-neutral-300'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Interactive Shell Input bar */}
          <form 
            onSubmit={handleSubmit}
            className="mt-4 border-2 border-dashed border-[#00FF66]/30 bg-neutral-900/40 p-1 flex items-center gap-2"
          >
            <span className="text-[#00FF66] font-bold pl-2 select-none font-mono text-sm">forge@trade:~$</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ketik perintah di sini... (contoh: status, buy BTC/USD 0.5)"
              className="flex-1 bg-transparent text-[#00FF66] font-mono text-xs focus:outline-none placeholder:text-neutral-700 p-1"
            />
            <button
              type="submit"
              className="py-1 px-3 bg-[#00FF66] text-black font-bold font-mono text-xs border border-transparent hover:bg-emerald-300 transition-colors flex items-center gap-1 active:translate-y-0.5"
            >
              Kirim
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
