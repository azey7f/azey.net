#!/usr/bin/env fish
# generate .index files

set gitroot (git rev-parse --show-toplevel)
for d in (find $gitroot/static -type d)
	cd $d

	echo $d
	ls -1F
	echo

	ls -1F > .index
end
