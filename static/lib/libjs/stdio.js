import * as sys from './sys.js';

self.BUFSIZ = 4096;

// files are open by getty, then inherited by shell & others
// streams are initialized here in init()
self.STDIN_FILENO  = 0;
self.STDOUT_FILENO = 1;
self.STDERR_FILENO = 2;

// stdio streams, set in std.js
// self.stdin;
// self.stdout;
// self.stderr;

// re-exports
export * from './stdio/clear.js';
export * from './stdio/fclose.js';
export * from './stdio/fdopen.js';
export * from './stdio/fopen.js';
export * from './stdio/fprint.js';
export * from './stdio/fread.js';
export * from './stdio/fseek.js';
export * from './stdio/ftell.js';
export * from './stdio/fwrite.js';
export * from './stdio/fflush.js';
export * from './stdio/getdelim.js';
export * from './stdio/getline.js';
export * from './stdio/print.js';
export * from './stdio/println.js';
export * from './stdio/setvbuf.js';
