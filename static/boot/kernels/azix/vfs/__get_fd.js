export function __get_fd(pid) {
	let fd = -1;
	while (window.proc[pid].files[++fd]);
	return fd;
}
export default __get_fd;
