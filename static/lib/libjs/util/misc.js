const encoder = new TextEncoder();
export function senc(str) {
	//return Int32Array.from(str, c => c.codePointAt());
	return encoder.encode(str);
}
export function sdec(str, count=Number.MAX_SAFE_INTEGER) {
	return String.fromCodePoint(...(new Uint8Array(str)).slice(0,count));
}

const sleep_sab = new Int32Array(new SharedArrayBuffer(4))
export function sleep(ms) {
	return Atomics.wait(sleep_sab, 0, 0, ms); // blocking sleep
}
export function sleepAsync(ms) {
	return Atomics.waitAsync(sleep_sab, 0, 0, ms);
}
