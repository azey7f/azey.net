// non-C signature since there's no point using buffers
export function strerror(errno) {
	return errno in strerrs ? strerrs[errno] : errno.toString();
}
export default strerror;

export const strerrs = {
	[EGENERIC]:	"generic failure",
	[EPERM]:	"operation not permitted",
	[EINVAL]:	"invalid argument",
	[EBUSY]:	"target is busy",
	[EBADDRV]:	"unknown filesystem type",
	[EDRV]:		"filesystem doesn't support this operation",
	[EROFS]:	"read-only filesystem",
	[EIO]:		"input/output error",
	[ENOENT]:	"file or directory does not exist",
	[ENOTDIR]:	"not a directory",
	[EISDIR]:	"not a file",
	[ENOTEMPTY]:	"directory not empty",
	[EEXIST]:	"already exists",
	[EXDEV]:	"path on a different filesystem",
	[EBADF]:	"bad file descriptor",
	[EWOULDBLOCK]:	"call would block",
	[ENOTTY]:	"file isn't a TTY",
	[EPIPE]:	"broken pipe",

	[EIMPL]:	"not implemented",
};
