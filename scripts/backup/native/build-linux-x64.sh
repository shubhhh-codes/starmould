#!/bin/sh
set -eu
# Rebuild the self-contained Linux x64 client tools; never used during backup requests.
WORK=${BACKUP_NATIVE_BUILD_DIR:-/root/.cache/starmould-postgres17-build}
mkdir -p "$WORK"
cd "$WORK"
fetch() { test -f "$2" || curl -fsSL --retry 3 "$1" -o "$2"; }
fetch https://ftp.postgresql.org/pub/source/v17.12/postgresql-17.12.tar.gz postgres.tar.gz
fetch https://github.com/openssl/openssl/releases/download/openssl-3.5.9/openssl-3.5.9.tar.gz openssl.tar.gz
fetch https://github.com/openssl/openssl/releases/download/openssl-3.5.9/openssl-3.5.9.tar.gz.sha256 openssl.sha256
fetch https://zlib.net/zlib-1.4.tar.gz zlib.tar.gz
printf '%s  postgres.tar.gz\n' b46f61048797e9cf1728dd4ac459831f5126c4745581f729500541c86e59a8ac | sha256sum -c -
printf '%s  openssl.tar.gz\n' 603f5602e2eef00d77fbd429d34dcd5822bb301757a1bc9cdb24c670f1eb859a | sha256sum -c -
printf '%s  zlib.tar.gz\n' 02dd159783677a749c04adbdd02b55b8a2bcc7e054f51b76b549199a916ad584 | sha256sum -c -
sha256sum postgres.tar.gz openssl.tar.gz zlib.tar.gz > source-checksums.txt
PREFIX="$WORK/install"
JOBS=${BACKUP_NATIVE_BUILD_JOBS:-4}
test -d zlib-1.4 || tar -xzf zlib.tar.gz
cd zlib-1.4
CC=musl-gcc ./configure --static --prefix="$PREFIX" > "$WORK/zlib-build.log" 2>&1
make -j"$JOBS" >> "$WORK/zlib-build.log" 2>&1
make install >> "$WORK/zlib-build.log" 2>&1
cd "$WORK"
test -d openssl-3.5.9 || tar -xzf openssl.tar.gz
cd openssl-3.5.9
CC=musl-gcc ./Configure linux-x86_64 no-shared no-secure-memory no-tests no-module no-dso no-engine no-asm --prefix="$PREFIX" --openssldir=/etc/ssl > "$WORK/openssl-build.log" 2>&1
make -j"$JOBS" build_libs >> "$WORK/openssl-build.log" 2>&1
make install_dev >> "$WORK/openssl-build.log" 2>&1
cd "$WORK"
test -d postgresql-17.12 || tar -xzf postgres.tar.gz
cd postgresql-17.12
CC=musl-gcc CPPFLAGS="-I$PREFIX/include" LDFLAGS="-L$PREFIX/lib64 -L$PREFIX/lib" LDFLAGS_EX="-static" ./configure --prefix="$PREFIX" --without-readline --without-icu --without-lz4 --without-zstd --without-ldap --with-ssl=openssl > "$WORK/postgres-build.log" 2>&1
make -j"$JOBS" -C src/backend generated-headers >> "$WORK/postgres-build.log" 2>&1
# Static OpenSSL adds exit symbols to the unused shared libpq check; only static executables are shipped.
make -j1 -C src/bin/pg_dump enable_coverage=yes LIBS="-lpgcommon -lpgport -lpgcommon_shlib -lssl -lcrypto -lz -lm" >> "$WORK/postgres-build.log" 2>&1
strip src/bin/pg_dump/pg_dump src/bin/pg_dump/pg_restore
file src/bin/pg_dump/pg_dump src/bin/pg_dump/pg_restore
src/bin/pg_dump/pg_dump --version
src/bin/pg_dump/pg_restore --version
printf 'Portable-backup-tools-ready\n'
