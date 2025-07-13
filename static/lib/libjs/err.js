// error codes, copied from kernel
self.EGENERIC		=-	 1; // generic failure
self.EPERM		=-	 2; // operation not permitted
self.EINVAL		=-	 3; // invalid argument
self.EBUSY		=-	 4; // target is busy
self.EBADDRV		=-	 5; // unknown driver/FS type
self.EDRV		=-	 6; // driver doesn't support this operation
self.EROFS		=-	 7; // driver doesn't support this operation
self.EIO		=-	 8; // input/output error
self.ENOENT		=-	 9; // file or directory does not exist
self.ENOTDIR		=-	10; // not a directory
self.EISDIR		=-	11; // not a file
self.ENOTEMPTY		=-	12; // directory not empty
self.EEXIST		=-	13; // already exists
self.EXDEV		=-	14; // path on a different filesystem
self.EBADF		=-	15; // bad file descriptor
self.EWOULDBLOCK	=-	16; // call would block
self.ENOTTY		=-	17; // file isn't a TTY
self.EPIPE		=-	18; // broken pipe

self.EIMPL		=-	99; // not implemented
