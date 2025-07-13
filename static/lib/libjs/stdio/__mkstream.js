/* consider this file the library's FILE struct definition
 * yes I know JS has classes now, no I'm not using them
 *
 * inspired by musl's _IO_FILE
 * didn't include wbase cuz it seems to just be future
 * proofing in case they ever want to stop flushing the
 * buffer in __towrite(), so yk */

export function __mkstream(fd, flags, bufsize, iobuf='f', ops) {
	let stream = {
		fd, ops, flags, bufsize,
		buf: new SharedArrayBuffer(bufsize),
		rpos:0, rend:0,
		wpos:0, wend:0,
		iobuf, // buffering type, either 'f', 'l' or 'n'
	};
	if (flags.READ)  { stream.rpos = 0; stream.rend = 0; }
	if (flags.WRITE) { stream.wpos = 0; stream.wend = 0; }
	return stream;
};
export default __mkstream;
