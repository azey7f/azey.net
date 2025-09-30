// error codes, copied from kernel
const err = {
	EGENERIC	:-	1, // generic failure
	EPERM		:-	2, // operation not permitted
	EINVAL		:-	3, // invalid argument
	EBUSY		:-	4, // target is busy
	EBADDRV		:-	5, // unknown filesystem type
	EDRV		:-	6, // filesystem doesn't support this operation
	EROFS		:-	7, // read-only filesystem
	EIO		:-	8, // input/output error
	ENOENT		:-	9, // file or directory does not exist
	ENOTDIR		:-	10, // not a directory
	EISDIR		:-	11, // not a file
	ENOTEMPTY	:-	12, // directory not empty
	EEXIST		:-	13, // already exists
	EXDEV		:-	14, // path on a different filesystem
	EBADF		:-	15, // bad file descriptor
	EWOULDBLOCK	:-	16, // call would block
	ENOTTY		:-	17, // file isn't a TTY
	EPIPE		:-	18, // broken pipe

	EIMPL		:-	99, // not implemented
};
for (const [e, code] of Object.entries(err)) self[e] = code;

export default err;
