# Bundled PostgreSQL client tools

These are deployment assets, not database backups. They contain no credentials or database data. They are extracted locally on the app server and checked against manifest SHA-256 values. No token, runtime network download, desktop helper or external backup service is required.

- PostgreSQL 17.12 pg_dump and pg_restore; PostgreSQL License.
- Linux x64: statically linked musl, OpenSSL 3.5.9 (Apache-2.0), zlib 1.4 (zlib license). No system shared-library installation is required.
- Windows x64: client binaries and only their recursive DLL dependencies from EDB's PostgreSQL 17.12 binary distribution, including OpenSSL, libpq, libintl/libiconv, LZ4 and Zstandard.

Rebuild Linux from official sources with build-linux-x64.sh in a Linux build environment with musl-gcc, gcc/make, perl, bison, flex, pkgconf, curl and CA certificates. This build step is for maintainers, not app users or hosting runtime. Source URLs and checksums are recorded with the assets. Package with gzip and record SHA-256 of each executable in manifest.json; include upstream licenses. The runtime verifies these hashes before execution.

Source distributions: https://www.postgresql.org/ftp/source/v17.12/ , https://openssl-library.org/source/ , https://zlib.net/ , https://musl.libc.org/ , https://www.enterprisedb.com/download-postgresql-binaries . Windows transitive libraries: https://www.gnu.org/software/gettext/ , https://www.gnu.org/software/libiconv/ , https://github.com/lz4/lz4 , https://github.com/facebook/zstd . Their original licenses apply; keep the notices with redistributed tools.

Next.js traces the native assets into backup functions only. The writable runtime copy is created in the host's temporary directory. The supported production architecture is Linux x64, as used by this Vercel Node.js deployment. Unsupported platforms fail explicitly rather than falling back to a partial data export.
