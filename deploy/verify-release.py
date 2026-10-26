#!/usr/bin/env python3
"""Verify and extract an uploaded package without links, traversal or extra files."""
import hashlib
import pathlib
import re
import sys
import tarfile


def extract(archive, destination):
    destination = pathlib.Path(destination)
    if not destination.is_dir() or any(destination.iterdir()):
        raise ValueError('Destination must be an existing empty directory')
    with tarfile.open(archive, 'r:gz') as package:
        count, total_size = 0, 0
        files = {}
        allowed = {'dist', 'server', 'deploy', 'README.md', 'package.json', 'SHA256SUMS'}
        for member in package:
            count += 1
            total_size += member.size
            if count > 2000 or total_size > 200 * 1024 * 1024:
                raise ValueError('Package exceeds release limits')
            name = member.name.removeprefix('./').rstrip('/')
            if name in ('', '.') and member.isdir():
                continue
            path = pathlib.PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] not in allowed:
                raise ValueError('Invalid package path')
            if not (member.isfile() or member.isdir()) or member.mode & 0o7000:
                raise ValueError('Unsupported file type or permission')
            if member.isfile():
                if name in files:
                    raise ValueError('Duplicate file')
                files[name] = member
        manifest = files.get('SHA256SUMS')
        if manifest is None or manifest.size > 1024 * 1024:
            raise ValueError('Missing or oversized checksum manifest')
        expected = {}
        for line in package.extractfile(manifest).read().decode('utf-8').splitlines():
            match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_. /-]+)', line)
            if not match or match[2] in expected:
                raise ValueError('Invalid checksum manifest')
            expected[match[2]] = match[1]
        if set(expected) != set(files) - {'SHA256SUMS'}:
            raise ValueError('Manifest does not cover exactly the packaged files')
        for name, digest in expected.items():
            if hashlib.file_digest(package.extractfile(files[name]), 'sha256').hexdigest() != digest:
                raise ValueError('Checksum mismatch')
        for required in ('server/index.mjs', 'server/domain.mjs', 'server/resources.mjs', 'dist/index.html', 'package.json'):
            if required not in files:
                raise ValueError('Missing runtime file')
        # Validate everything before writing; never use archive-supplied ownership/modes.
        for name, member in files.items():
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
            with package.extractfile(member) as source, target.open('xb') as output:
                while block := source.read(1024 * 1024):
                    output.write(block)
            target.chmod(0o644)


if __name__ == '__main__':
    try:
        extract(sys.argv[1], sys.argv[2])
    except (ValueError, OSError, tarfile.TarError, IndexError) as error:
        sys.exit(str(error))
