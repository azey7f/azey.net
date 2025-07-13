## foreword
This file uses typed pseudocode for brevity:
- `str`: string, `obj`: JS object, `arr`: continuous array
- `int` & `uint` are signed and unsigned integers respectively (unbound)
- `err`: one of the errors defined in `err.js`, `int` type
- `!`: function does not- `<type>?`:
    - if return value: function can return either `<type>` or `err` - `<type>` can also be 0, which is just the number 0
    - if argument: arg can be undefined, behavior in that case should be described return
- `fd`: open file index in the kernel's `window.proc[...].files`, `uint` type
- `sab`: a JS SharedArrayBuffer (size either unbound, or sab[n] where byteLength >= n)
- `pid`: process index in `window.proc`, `uint` type
- `proc`: object representing a process in the kernel, structure:
```js
{
    pid,
    group,      // ref to process group in window.pgrp
    children,   // array of refs to children
    cmdline,    // array of str, the process' argv
    cwd,        // str, current working directory
    env,        // array of env vars
    files,      // open files, see FS.md
    parent,     // ref to parent process
    signals,    // object, keeps track of signal handlers
    state,      // single-letter str; R, Z or D
    sysret,     // Int32Array of a SharedArrayBuffer, self.__sysret in userland
    target,     // EventTarget, used in wait()
    worker,     // JS web worker Worker object
}
```
- `pgrp`: object representing a process group in the kernel, structure:
```js
{
    id,         // index in window.pgrp
    session,    // ref to session in window.pses
    proc,       // array of refs to processes in window.proc
}
```
- `pses`: object representing a session in the kernel, structure:
```js
{
    id,         // index in window.pses
    groups,     // array of refs to proc groups in window.pgrp
    tty,        // ref to VFS node object representing the session's controlling TTY
}
```

# syscalls
Kernel functions which can be called from userspace. The standard process for making a syscall is this (see `/lib/libjs/sys/__syscall.js`):
1. make a `self.postMessage(arr)` call, with `arr` being `[ str syscallname, arr args ]`
2. `Atomics.wait(self.__sysret, 0, 0)` to block until the syscall completes. Some syscalls like `read()` aren't thread-safe, so this is necessary
3. `Atomics.exchange(self.__sysret, 0, 0)` to reset `self.__sysret` to 0 and get the return value

File-related syscalls (see [FS.md](FS.md) for details, these are mostly wrappers around VFS functions):
- `fd? open(str path, obj open_flags)`: open a file/dir and return the file descriptor
- `fd? reopen(fd, obj open_flags)`: reopen a file with different flags, fd number stays the same
- `fd? dup(fd, fd newfd)`: duplicate a file descriptor - if newfd is undefined, the lowest available is used
    - after the call both fd and newfd will refer to the same internal file struct, and the CLOSPAWN flag will be set to false
- `0? close(fd)`: close an open file
- `uint? read(fd, sab, uint count)`: read up to `count` bytes into `sab` and return number of bytes read (<= `count` and <= `sab.byteLength`)
- `uint? write(fd, str)`: write a string into file, return number of bytes written
- `uint? seek(fd, uint n, str type)`: seek within a file
- `0? remove(str path, obj remove_flags)`: remove a file or directory
- `0? rename(str path, str new_path)`: rename a file/dir on the same FS mount
- `0? path(fd, sab)`: returns the full path of an open file
- `0? pipe(sab[2] fd, open_flags)`: creates a pipe, puts the read fd and write fd as 32-bit uints into `fd` - `open_flags` applied to both ends
- `0? mount(str target, str driver, str device, obj options)`: mount a filesystem
- `0? umount(str target)`: unmount a filesystem

Process-related syscalls:
- `0? chdir(fd)`: changes current directory to dir pointed to by file descriptor
- `0? setsid()`: creates a new session, if process isn't already a process group leader
- `0? setpgid(pid, uint pgid)`: creates a new process group or moves process to existing one, can be performed on self or children
    - if `pgid` == 0, the lowest available is used
- `0? signal(str sig, str handler)`: modifies a signal handler
    - if a signal is emitted afterwards, one of the following happens depending on the value of `handler`:
        - `default`, use the default behavior
        - `ignore`, ignores the signal
        - `handle`, the signal is sent to the process in a `postMessage`
    - this syscall does not affect `SIGKILL` and `SIGSTOP`
- `! exit(uint ret)`: exits the current process with return code
- `pid? wait(sab?)`: waits until a child exits, sets `sab[0]` byte to the return value (if sab specified) and returns the child's PID
- `pid? spawn(str path, arr argv, arr envp, sab? waitsab)`: spawns a process
    - if `waitsab` is specified the worker is spawned and the function returns immediately, but the first message with argv/envp/sysret isn't sent to it until int32 waitsab[0] !== 0
        - this can be used to e.g. set a child's PGID before it starts, generally it's for stuff you'd normally do between `fork()` and `exec()`

Miscellaneus syscalls:
- `0? insmod(str path)`: load driver module - if `path` ends with `.js` it is used as-is, otherwise it refers to `azix/drivers/${path}.js`
- `0? rmmod(str name)`: unload driver module
