"use client";

import { useEffect, useRef, useState } from 'react';
import { 
  X, Move, PanelTop, PanelBottom, PanelLeft, PanelRight, 
  Pin, Terminal, RefreshCw, Loader2 
} from 'lucide-react';

interface FloatingTerminalProps {
  onClose: () => void;
}

export default function FloatingTerminal({ onClose }: FloatingTerminalProps) {
  const [floatMode, setFloatMode] = useState<'bottom' | 'top' | 'left' | 'right' | 'free'>('bottom');
  const [floatH, setFloatH] = useState(280); // height for top/bottom
  const [floatW, setFloatW] = useState(550); // width for left/right
  const [floatRect, setFloatRect] = useState({ x: 250, y: 150, w: 750, h: 380 });
  const [connected, setConnected] = useState(false);
  const [resetting, setResetting] = useState(false);

  const terminalElRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Position and Size calculations
  const panelStyle: React.CSSProperties =
    floatMode === 'bottom'
      ? { position: 'fixed', bottom: 0, left: 0, right: 0, height: floatH }
      : floatMode === 'top'
      ? { position: 'fixed', top: 64, left: 0, right: 0, height: floatH } // 64px top offset for Toolbar
      : floatMode === 'left'
      ? { position: 'fixed', top: 64, bottom: 0, left: 0, width: floatW }
      : floatMode === 'right'
      ? { position: 'fixed', top: 64, bottom: 0, right: 0, width: floatW }
      : { position: 'fixed', left: floatRect.x, top: floatRect.y, width: floatRect.w, height: floatRect.h };

  const dockLabel = 
    floatMode === 'free' ? '自由浮动' : 
    floatMode === 'top' ? '固定在顶部' : 
    floatMode === 'bottom' ? '固定在底部' : 
    floatMode === 'left' ? '固定在左侧' : 
    '固定在右侧';

  useEffect(() => {
    let active = true;
    let term: any = null;
    let fitAddon: any = null;
    let es: EventSource | null = null;

    const initTerm = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      if (!active) return;

      term = new Terminal({
        fontSize: 13,
        fontFamily: 'SFMono-Regular,Consolas,monospace',
        scrollback: 5000,
        cursorBlink: true,
        convertEol: false,
        macOptionIsMeta: true,
        theme: {
          background: '#020205',
          foreground: '#e5e5e5',
          cursor: '#fbbf24', // amber/orange cursor
          selectionBackground: 'rgba(251, 191, 36, 0.3)',
        },
        allowProposedApi: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      if (terminalElRef.current) {
        term.open(terminalElRef.current);
        fitAddon.fit();
        term.focus();

        // Send initial dimensions to the backend PTY
        fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'resize', 
            data: { cols: term.cols, rows: term.rows } 
          }),
        });
      }

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Listen for window resize and notify backend PTY
      term.onResize((size: { cols: number; rows: number }) => {
        fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'resize', 
            data: { cols: size.cols, rows: size.rows } 
          }),
        });
      });

      // Connect to SSE stream
      es = new EventSource('/api/terminal');
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          term.write(data.text);
        } catch (err) {
          console.error('Terminal parse message error:', err);
        }
      };

      es.onerror = () => {
        setConnected(false);
      };

      term.onData((data: string) => {
        fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'write', data }),
        });
      });
    };


    initTerm();

    // Handle ResizeObserver
    const ro = new ResizeObserver(() => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
            const term = xtermRef.current;
            if (term) {
              fetch('/api/terminal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'resize',
                  data: { cols: term.cols, rows: term.rows }
                }),
              });
            }
          } catch (e) {}
        }
      }, 60);
    });

    if (terminalElRef.current) {
      ro.observe(terminalElRef.current);
    }

    return () => {
      active = false;
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      ro.disconnect();
      if (term) term.dispose();
      if (es) es.close();
    };
  }, []);

  // Trigger fit whenever sizing/modes change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
          const term = xtermRef.current;
          if (term) {
            fetch('/api/terminal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'resize', 
                data: { cols: term.cols, rows: term.rows } 
              }),
            });
          }
        } catch (e) {}
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [floatMode, floatH, floatW, floatRect.w, floatRect.h]);

  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill' }),
      });
      if (xtermRef.current) {
        xtermRef.current.clear();
      }
    } catch (e) {
      console.error('Reset terminal error:', e);
    } finally {
      setResetting(false);
    }
  };

  // Drag handler for free floating mode
  const startDrag = (e: React.MouseEvent) => {
    if (floatMode !== 'free') return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = floatRect.x;
    const initialY = floatRect.y;

    const handleMouseMove = (ev: MouseEvent) => {
      setFloatRect(prev => ({
        ...prev,
        x: initialX + ev.clientX - startX,
        y: initialY + ev.clientY - startY,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Resize handler
  const startResize = (e: React.MouseEvent, direction: 'height' | 'width' | 'free') => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialH = floatH;
    const initialW = floatW;
    const initialRect = { ...floatRect };

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;

      if (direction === 'height') {
        if (floatMode === 'bottom') {
          setFloatH(Math.max(140, initialH - deltaY));
        } else if (floatMode === 'top') {
          setFloatH(Math.max(140, initialH + deltaY));
        }
      } else if (direction === 'width') {
        if (floatMode === 'left') {
          setFloatW(Math.max(250, initialW + deltaX));
        } else if (floatMode === 'right') {
          setFloatW(Math.max(250, initialW - deltaX));
        }
      } else if (direction === 'free') {
        setFloatRect(prev => ({
          ...prev,
          w: Math.max(350, initialRect.w + deltaX),
          h: Math.max(180, initialRect.h + deltaY),
        }));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getDockButtonClass = (mode: typeof floatMode) => {
    return `p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition ${
      floatMode === mode ? 'text-amber-400 bg-slate-800/80' : ''
    }`;
  };

  return (
    <div 
      style={{
        ...panelStyle,
        zIndex: 100,
        boxShadow: '0 20px 50px rgba(0,0,0,0.65)'
      }}
      className={`bg-[#020205] border border-amber-500/20 flex flex-col overflow-hidden transition-all duration-75 ${
        floatMode === 'free' ? 'rounded-xl' : ''
      }`}
    >
      {/* Resizers */}
      {floatMode === 'bottom' && (
        <div 
          onMouseDown={e => startResize(e, 'height')} 
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-amber-500/30 transition-colors z-20"
        />
      )}
      {floatMode === 'top' && (
        <div 
          onMouseDown={e => startResize(e, 'height')} 
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-amber-500/30 transition-colors z-20"
        />
      )}
      {floatMode === 'left' && (
        <div 
          onMouseDown={e => startResize(e, 'width')} 
          className="absolute top-0 bottom-0 right-0 w-1.5 cursor-ew-resize hover:bg-amber-500/30 transition-colors z-20"
        />
      )}
      {floatMode === 'right' && (
        <div 
          onMouseDown={e => startResize(e, 'width')} 
          className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize hover:bg-amber-500/30 transition-colors z-20"
        />
      )}

      {/* Header bar */}
      <div 
        onMouseDown={startDrag} 
        className="h-9 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 select-none flex-shrink-0"
        style={{ cursor: floatMode === 'free' ? 'move' : 'default' }}
      >
        <div className="flex items-center gap-2">
          {floatMode === 'free' ? <Move size={13} className="text-slate-500" /> : <Terminal size={13} className="text-amber-500" />}
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs font-semibold text-slate-200">本地工作区终端</span>
          <span className="text-[10px] text-slate-500">· {dockLabel}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            title="重启终端会话" 
            onClick={handleReset} 
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition"
          >
            {resetting ? <Loader2 size={13} className="animate-spin text-amber-500" /> : <RefreshCw size={13} />}
          </button>
          
          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button title="钉在顶部" onClick={() => setFloatMode('top')} className={getDockButtonClass('top')}><PanelTop size={13} /></button>
          <button title="钉在底部" onClick={() => setFloatMode('bottom')} className={getDockButtonClass('bottom')}><PanelBottom size={13} /></button>
          <button title="钉在左侧" onClick={() => setFloatMode('left')} className={getDockButtonClass('left')}><PanelLeft size={13} /></button>
          <button title="钉在右侧" onClick={() => setFloatMode('right')} className={getDockButtonClass('right')}><PanelRight size={13} /></button>
          <button title="自由浮动" onClick={() => setFloatMode('free')} className={getDockButtonClass('free')}><Pin size={13} /></button>
          
          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button 
            title="关闭" 
            onClick={onClose} 
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-855 transition"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div 
        ref={terminalElRef} 
        className="flex-1 min-h-0 p-2 overflow-hidden text-left"
        style={{
          fontFamily: 'SFMono-Regular,Consolas,monospace',
        }}
      />

      {/* Free mode corner resize handle */}
      {floatMode === 'free' && (
        <div 
          onMouseDown={e => startResize(e, 'free')} 
          className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 z-20"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" className="text-amber-500/40">
            <line x1="6" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1" />
            <line x1="6" y1="3" x2="3" y2="6" stroke="currentColor" strokeWidth="1" />
            <line x1="6" y1="6" x2="5" y2="6" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  );
}
