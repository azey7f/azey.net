import * as sys from '../sys.js';
import { __sdec } from '../util/__ser.js';

export {
	__file_close as close,
	__file_read  as read,
	__file_write as write,
	__file_seek  as seek,
};

// impl
function __file_close(s) {
	return sys.close(s.fd);
}

function __file_read(s, buf, count) {
	const cnt = sys.read(s.fd, s.buf, s.bufsize);
	if (cnt <= 0) return 0;

	s.rpos = 0; s.rend = cnt;

	// copy count to buf
	const dst = new Uint8Array(buf);
	const src = new Uint8Array(s.buf);

	const min = Math.min(cnt, count);
	for (let i=0; i<min;)
		dst[i++] = src[s.rpos++];

	return min;
}

function __file_write(s, str, count) {
	let to_write = __sdec(s.buf, s.wpos) + str;
	let cnt;
	for (;;) {
		cnt = sys.write(s.fd, to_write);
		if (cnt == to_write.length) {
			s.wend = s.bufsize;
			s.wpos = 0;
			return count;
		}
		if (cnt < 0) {
			s.wpos = s.wend = 0;
			return 0;
		}
		to_write = to_write.slice(cnt);
	}
}

function __file_seek(s, n, type) {
	return sys.seek(s.fd, n, type);
}
