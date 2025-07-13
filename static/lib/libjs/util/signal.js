import * as sys from '../sys.js';

export let __sig_handlers = {};

export function signal(sig, handler) {
	switch (handler) {
		case 'ignore':
		case 'default':
			const ret = sys.signal(sig, handler);
			if (ret >= 0 && sig in __sig_handlers) delete __sig_handlers[sig];
			return ret;
		default: if (typeof handler === 'function') {
			const ret = sys.signal(sig, 'handle');
			if (ret >= 0) __sig_handlers[sig] = handler;
			return ret;
		} else return EINVAL;
	}
}
export default signal;
