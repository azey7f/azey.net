
export function seek(pid, fd, n, type) {
	const f = window.proc[pid].files[fd];
	if (f === undefined || !Number.isInteger(n) || typeof type !== 'string') return EINVAL;

	let newo;
	switch (type) {
		case 'SET': newo = +n; break;
		case 'CUR': newo = +f.offset + +n; break;
		case 'END': newo = +f.size + +n; break;
		default: return EINVAL;
	}

	// negative offset can be useful for device files that report size 0, if we're trying to seek from end
	// since drivers usually use .slice(f.offset, f.offset+n_bytes) to chop up data, this will work
	if ((f.size !== 0 || f.offset > 0) && newo < 0) return EINVAL;
	if (f.size > 0 && newo > f.size) return EINVAL;

	return (f.offset = newo) < 0 ? 0 : newo;
}
export default seek;
