import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as pty from 'node-pty';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GlobalTerminal {
  shellProcess: pty.IPty | null;
  outputBuffer: string;
  clients: Set<(chunk: string) => void>;
  cols: number;
  rows: number;
}

const globalTerm = globalThis as unknown as {
  _terminalSession?: GlobalTerminal;
};

if (!globalTerm._terminalSession) {
  globalTerm._terminalSession = {
    shellProcess: null,
    outputBuffer: '',
    clients: new Set(),
    cols: 80,
    rows: 24,
  };
}

const session = globalTerm._terminalSession;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const TERMINAL_ENABLED = process.env.AFSOS_ENABLE_TERMINAL === '1';

function isPtyProcess(proc: unknown): proc is pty.IPty {
  return Boolean(
    proc &&
    typeof (proc as pty.IPty).write === 'function' &&
    typeof (proc as pty.IPty).resize === 'function'
  );
}

function resolveProjectRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === 'ui' ? path.resolve(cwd, '..') : cwd;
}

function appendOutput(text: string) {
  session.outputBuffer += text;
  if (session.outputBuffer.length > 50000) {
    session.outputBuffer = session.outputBuffer.slice(-20000);
  }
  session.clients.forEach(cb => cb(text));
}

function clampSize(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function hostnameFromHostHeader(host: string | null) {
  if (!host) return '';
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  return host.split(':')[0];
}

function isLocalUrl(value: string | null) {
  if (!value) return true;
  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '');
    return LOCAL_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function isTerminalRequestAllowed(request: Request) {
  if (!TERMINAL_ENABLED) return false;

  const url = new URL(request.url);
  const host = hostnameFromHostHeader(request.headers.get('host')) || url.hostname;
  if (!LOCAL_HOSTS.has(host)) return false;

  return isLocalUrl(request.headers.get('origin')) && isLocalUrl(request.headers.get('referer'));
}

function terminalAccessDenied() {
  return NextResponse.json({
    error: 'Terminal API disabled. Set AFSOS_ENABLE_TERMINAL=1 and access from localhost to enable it.'
  }, { status: 403 });
}

function ensureShellRunning() {
  if (session.shellProcess && !isPtyProcess(session.shellProcess)) {
    try {
      (session.shellProcess as any).kill?.('SIGKILL');
    } catch {
      // Ignore stale non-PTY sessions from older dev-server code.
    }
    session.shellProcess = null;
  }

  if (session.shellProcess) {
    return;
  }

  const projectRoot = resolveProjectRoot();
  const shell = process.env.SHELL || '/bin/zsh';

  const child = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: session.cols,
    rows: session.rows,
    cwd: projectRoot,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
      CLICOLOR: '1',
    }
  });

  session.shellProcess = child;

  child.onData((text) => {
    appendOutput(text);
  });

  child.onExit(({ exitCode }) => {
    appendOutput(`\r\n[Shell exited with code ${exitCode}]\r\n`);
    session.shellProcess = null;
  });
}

export async function GET(request: Request) {
  if (!isTerminalRequestAllowed(request)) {
    return terminalAccessDenied();
  }

  ensureShellRunning();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send the current output buffer first to populate the terminal
      if (session.outputBuffer) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: session.outputBuffer })}\n\n`));
      }

      const onData = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        } catch (e) {
          session.clients.delete(onData);
        }
      };

      session.clients.add(onData);

      request.signal.addEventListener('abort', () => {
        session.clients.delete(onData);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: Request) {
  try {
    if (!isTerminalRequestAllowed(request)) {
      return terminalAccessDenied();
    }

    const { action, data } = await request.json();

    if (action === 'write') {
      ensureShellRunning();
      if (session.shellProcess) {
        session.shellProcess.write(String(data ?? ''));
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: 'Terminal process is not running' }, { status: 500 });
      }
    } else if (action === 'resize') {
      const cols = clampSize(data?.cols, session.cols, 20, 400);
      const rows = clampSize(data?.rows, session.rows, 4, 200);
      session.cols = cols;
      session.rows = rows;
      if (isPtyProcess(session.shellProcess)) {
        session.shellProcess.resize(cols, rows);
      }
      return NextResponse.json({ success: true, cols, rows });
    } else if (action === 'kill') {
      if (session.shellProcess) {
        session.shellProcess.kill();
        session.shellProcess = null;
      }
      session.outputBuffer = '';
      const text = '\r\n[Terminal Reset Success]\r\n';
      session.clients.forEach(cb => cb(text));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
