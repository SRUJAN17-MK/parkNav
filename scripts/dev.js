'use strict';

/**
 * SmartPark - starts the backend and the Vite dev server together.
 *
 *   npm install:all      (once)
 *   npm run dev          -> API on :5000, UI on :5175
 *
 * Ctrl+C stops both processes.
 */

const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(name, cwd, args, color) {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: path.join(root, cwd),
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach((line) => target.write(`${prefix}${line}\n`));
    });
  };

  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`${prefix}exited with code ${code}\n`);
    }
    shutdown();
  });

  return child;
}

const children = [];
let closing = false;

function shutdown() {
  if (closing) return;
  closing = true;
  children.forEach((child) => {
    if (!child.killed) child.kill();
  });
  setTimeout(() => process.exit(0), 250);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('');
console.log('  SmartPark - starting both services');
console.log('  API  : http://localhost:5000/api');
console.log('  UI   : http://localhost:5175');
console.log('  Login: watchman / watch123');
console.log('');

children.push(run('api', 'backend', ['run', 'dev'], '36'));
setTimeout(() => {
  children.push(run('web', 'frontend', ['run', 'dev'], '35'));
}, 800);
