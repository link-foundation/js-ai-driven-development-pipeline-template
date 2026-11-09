#!/usr/bin/env bash
# Install a pinned lychee release with retries and a SHA-256 check.
#
# Adapted from link-assistant/hive-mind PR #4026 for issue #291.
# Retry downloads only; a broken link must still fail the checker.
#
# Usage: LYCHEE_VERSION=v0.24.2 scripts/install-lychee.sh [install-dir]
# Debug:  LYCHEE_INSTALL_DEBUG=1 prints every command.
set -euo pipefail
[ "${LYCHEE_INSTALL_DEBUG:-}" = 1 ] && set -x

version="${LYCHEE_VERSION:?LYCHEE_VERSION is required, e.g. v0.24.2}"
if ! [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error title=lychee install::LYCHEE_VERSION must be a pinned release such as v0.24.2, got '$version'." >&2
  exit 1
fi
install_dir="${1:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/lychee/bin}"
case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64 ;;
  aarch64 | arm64) arch=aarch64 ;;
  *)
    echo "::error title=lychee install::Unsupported architecture $(uname -m)." >&2
    exit 1
    ;;
esac
asset="lychee-${arch}-unknown-linux-gnu.tar.gz"
base_url="${LYCHEE_DOWNLOAD_BASE_URL:-https://github.com/lycheeverse/lychee/releases/download}/lychee-${version}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# --retry-all-errors also retries HTTP 5xx/429 and dropped connections; --fail
# keeps an error page from being saved as the archive.
fetch() {
  curl --fail --silent --show-error --location \
    --retry "${LYCHEE_DOWNLOAD_RETRIES:-5}" --retry-all-errors --retry-delay "${LYCHEE_DOWNLOAD_RETRY_DELAY:-5}" \
    --connect-timeout 20 --max-time 60 --retry-max-time 180 \
    --output "$2" "$1"
}

echo "Downloading ${base_url}/${asset}"
if ! fetch "${base_url}/${asset}" "$work/$asset" || ! fetch "${base_url}/${asset}.sha256" "$work/$asset.sha256"; then
  echo "::error title=lychee install::Could not download lychee ${version} (${asset}) after retries. GitHub's release download service may be unavailable; re-run the job." >&2
  exit 1
fi

expected="$(awk '{print $1; exit}' "$work/$asset.sha256")"
actual="$(sha256sum "$work/$asset" | awk '{print $1}')"
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "::error title=lychee install::Checksum mismatch for ${asset}: expected '${expected}', got '${actual}'." >&2
  exit 1
fi

tar -xzf "$work/$asset" -C "$work"
binary="$(find "$work" -type f -name lychee -perm -u+x | head -n 1)"
if [ -z "$binary" ]; then
  echo "::error title=lychee install::No lychee binary in ${asset}; the archive layout changed." >&2
  exit 1
fi
install -D -m 0755 "$binary" "$install_dir/lychee"
[ -n "${GITHUB_PATH:-}" ] && echo "$install_dir" >> "$GITHUB_PATH"
"$install_dir/lychee" --version
