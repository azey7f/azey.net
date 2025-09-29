## foreword
This file uses typed pseudocode for brevity. Functions should enforce this, and return EINVAL for invalid arg types:

- `pid`: uint index of the calling process in `window.proc`, used by the vast majority of functions functions – needs to be passed by argument since a global window.current would cause race conditions
- `str`: string, `obj`: JS object
- `int` & `uint` are signed and unsigned integers respectively (unbound)
- `err`: one of the errors defined in `err.js`, `int` type
- `<type>?`:
    - if return value: function can return either `<type>` or `err` - `<type>` can also be 0, which is just the number 0
    - if argument: arg can be undefined, behavior in that case should be described
- `fd`: file descriptor, uint index to a `file` object in `window.proc[pid].files`
- `file`: object representing an open file, structure:
```js
{
    flags,  // open_flags, inherited from initial open() call
    offset, // uint, current seek position
    node,   // reference to node in window.vfs
    op,     // reference to f_ops of the node's FS driver
    refs,   // number of references to this file struct in window.proc[pid].files, >1 if the FD was dup()ed
}
```
- `node`: VFS node, part of the actual file tree. root node is at `window.vfs.nodes[0]`
```js
{
    id,         // uint, index in window.vfs.nodes
    name,       // str, file name (shouldn't contain slashes)
    type,       // str, one of 'file', 'dir', 'mountpoint'
    parent,     // reference to parent node - undefined for /
    children,   // obj keyed by node names, contains refs to child nodes
    op,         // reference to node_ops of FS driver
    superblock, // reference to superblock
    refs,       // open FD count
}
```
- `superblock`: contains mount data, referenced by all nodes in a mount
```js
{
    driver,             // name of driver module in window.drivers
    device, options,    // args passed to FS mount() function
    op,                 // reference to super_ops of driver
    mountpoint,         // reference to mountpoint node
    refs,               // open FD count across the whole FS
}
```

# VFS
Extra types:
- `open_flags`: an object with one or more of these keys (set to true):
    - `DIR`: working with directories, ex. `DIR`+`CREATE` creates dirs
    - `CREATE`: create file/dir if it doesn't exist, pairable with `DIR`
    - `READ`: open for reading, pairable with `DIR` (see `read()`)
    - `WRITE`: open file for writing
    - `TRUNCATE`: truncate file to 0 size during open
    - `APPEND`: moves `offset` to end of file before each write, then moves it back
    - `CLOSPAWN`: don't copy the open file to child process when `spawn()`ing
    - `NOOPEN`: don't open the file, useful for creation or checking existence
        - returns 0, `reopen()` doesn't actually modify the open file struct
    - `NOBLOCK`: returns EWOULDBLOCK instead of blocking to e.g. wait for user input
    - `TTY`: if file isn't a TTY returns ENOTTY, no other functionality
- `remove_flags`: subset of `open_flags`, currently only supports `DIR`

Functions, most implemented as a syscall (though usually with a different signature, see SYSCALL.md):
- `fd? open(pid, str path, open_flags)` - open a file
- `fd? reopen(pid, fd, open_flags)` - reopen a file with different flags, fd number doesn't change
    - only flags to change should be supplied, e.g. if an FD was opened with `{ READ: true, NOBLOCK: true }`, you can set it to block with `reopen(fd, { NOBLOCK: false })`
- `fd? dup(pid, fd, uint newfd?)` - duplicate a file descriptor. if newfd is undefined, the lowest available fd is used
- `0? close(pid, fd)` - close an open file
- `str? read(pid, fd, uint n\_bytes)` - read file/dir contents
    - if `flags.DIR` is set, each call reads one entry (name of file) in the dir. `offset` increments by 1 every `read()` (instead of by length of string) and is used as an index of entries
        - if `n_bytes` is smaller than the length of the entry, returns EINVAL and doesn't increment `offset`
- `uint? write(pid, fd, str)` - write file contents at `offset`
    - if `flags.APPEND` is true, move FD offset to end of file before calling FS `op.write()`, then move it back
    - returns number of bytes written
- `uint? seek(pid, fd, uint n, str type)` - move `offset`, returns resulting offset
    - if `type` is `SET`, the offset is set to `n` bytes
    - if `type` is `CUR`, the offset is set to its current location plus `n`
    - if `type` is `END`, the offset is set to `size` plus `n`
- `0? remove(pid, str path, remove_flags)` - remove a file or directory
    - if attempting to remove a directory with `flags.DIR`, it must be empty
- `0? rename(pid, str path, str new_path)` - rename a file or directory on the same filesystem
- `str? path(node, node.id root)` - get path of `node` relative to `root` (if outside or `root == node.id`, returns EINVAL)
- `0? mount(str target, str driver, str device, obj options)` - mount a `driver` FS at `target` path
- `0? umount(str target)` - unmount `target` path

Internal functions which should not be used by syscalls and stuff are prefixed with `__`. Usable (obviously), but they usually have way fewer constraints and may mess everything up if used incorrectly. Here be dragons.

# FS drivers

Driver functions, should only be called by VFS (*do not* call these from other drivers and **especially not** from syscalls directly). They have zero constraints, and assume VFS does the necessary checking and flags parsing for them.

There's so many different functions to hopefully move as much otherwise duplicate logic from individual drivers into the VFS as possible. The `pid` arguments isn't used by most drivers, hence it's at the end.

Mount functions (`super_ops`):
- `0? __mount(pid?)`
- `0? __remount(pid?)`
- `0? __umount(pid?)`

Node functions (`node_ops`):
- `0? __removef/__removed(node, pid?)` - remove file/dir, return 0 on success
- `0? __creatf/__creatd(node, pid?)` - create file/dir, return 0 on success
- `bool __existf/__existd(node, pid?)` - check for existence
- `0? __rename(pid?, node, str new_name, node new_parent)` - rename file/dir within FS, return 0 on success
- `bool __isatty(node, pid?)` - check if file is a TTY
    - if true, these should also be implemented:
        - `str? __tty_get(node, str attr)` - get TTY attrs
        - `0?   __tty_set(node, str attr, str value)` - set TTY attrs
    - TTY attrs exposed by `ttyctl` in `/dev/tty/`:
        - `ctty` - path to current process' controlling TTY
        - `ftty` - index of currently focused TTY (VT)
        - `pgid` - foreground process group ID
        - `ldisc` - line discipline, either `n_tty`, `n_echo`, or `n_null`

File functions (`file_ops`):
- `uint? __openf/__opend(file, open_flags, pid?)` - open file/dir, return file size or dir entry count
- `0? __close(file, pid?)` - close file/dir, no requirements except returning 0 on success
- `str? __readf(file, uint n_bytes, pid?)` - read file contents, `n_bytes` from `offset`
- `str? __readd(file, pid?)` - read a single dir entry of any length
- `uint? __write(file, str, pid?)` - write string into file, return number of bytes written

TTY functions (`tty_ops`) – unimplemented in non-TTY drivers:
