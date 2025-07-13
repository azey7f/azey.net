export function uptime() {
	let now = window.performance.now ? window.performance.now() : Date.now();
	return window.clock_start ? now-window.clock_start : 0;
}
export function timestamp(msg) {
	let ms = uptime();
	let timestamp = `${Math.floor(ms/1000)}.${Math.floor((ms%1000)*1000).toString().padStart(6, '0')}`.padStart(12);
	return `[${timestamp}] ${msg}`;
}
