import './err.js';
import { __sig_handlers } from './util/signal.js';

import { exit } from './sys.js';
import { fdopen, fclose, setvbuf } from './stdio.js';
import { __osl_head } from './stdio/__osl.js';

self.onmessage = (event) => {
	switch (typeof event.data) {
		// sent once, right after creation - args, env, etc
		case 'object':
			// SharedArrayBuffer(4), used as the return value of syscalls
			self.__sysret = new Int32Array(event.data.sysret);

			// open standard i/o streams
			self.stdin  = fdopen(STDIN_FILENO,  'r');
			self.stdout = fdopen(STDOUT_FILENO, 'a');
			self.stderr = fdopen(STDERR_FILENO, 'a');
			// disable stderr buffering
			if (!(stderr < 0)) setvbuf(stderr, undefined, _IONBF, undefined);

			// set env & run main func
			self.__environ = event.data.envp;
			let ret = self.main(event.data.argv, event.data.envp);

			// close all streams
			for (let s=__osl_head; s; s=s.next)
				fclose(s);

			// exit
			if (ret < 0) ret = -ret;
			exit(ret !== undefined ? ret : 0);
			break;

		// represents a signal (e.g. SIGINT)
		case 'string':
			if (event.data in __sig_handlers)
				__sig_handlers[event.data]();
			break;
	};
};
