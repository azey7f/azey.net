import { terminate } from './process.js';

export function signal(pid, sig) {
	if (!(sig in signals)) return EINVAL;

	if (pid <= 0) { // process as -PGID
		if (!(-pid in window.pgrp)) return EINVAL;
		for (const _pid in window.pgrp[-pid].proc)
			if (sig in window.proc[_pid].signals) {
				actions[window.proc[_pid].signals[sig]](_pid, sig);
			} else signals[sig](_pid, sig);
		return 0;
	} else if (!(pid in window.proc)) return EINVAL;

	if (sig in window.proc[pid].signals)
		sig = window.proc[pid].signals[sig];
	else sig = signals[sig](pid);
	return sig;
}
export default signal;

const actions = {
	term: (pid) => terminate(pid),
	ignore: () => 0,
	handle: (pid, sig) => {
		window.proc[pid].worker.postMessage(sig);
		return 0;
	}
};

// mostly copied from Linux
export const signals = {
	"SIGKILL":  actions.term,
	"SIGINT":   actions.term,
	"SIGSTP":   actions.ignore, // TODO
	"SIGPIPE":  actions.term,
	"SIGHUP":   actions.term,
	"SIGWINCH": actions.ignore,
	"SIGCHLD":  actions.ignore,
	"SIGTTIN":  actions.ignore, // TODO
	"SIGTTOU":  actions.ignore, // TODO
};
