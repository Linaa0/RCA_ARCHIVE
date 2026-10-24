#!/usr/bin/env bash
# Data safe helpers for the backend deploy.
#
#   backend-sync.sh dirs   <backend_dir> <env_file>
#       Print the absolute runtime data folders (uploads, submissions, ...).
#   backend-sync.sh backup <backend_dir> <env_file> <backup_root>
#       Archive uploads and submissions into <backup_root>, keep the 3 newest.
#       Never fails: any problem prints a warning and returns 0.
#   backend-sync.sh sync   <source_server_dir> <backend_dir> <env_file>
#       rsync the code with --delete while protecting every runtime data folder.
#
# Runtime data (student submissions, uploaded papers, assignment attachments,
# teacher resources, backups) must never be removed by a deploy.
set -euo pipefail

# Folders inside the backend directory that hold runtime data, never code.
STATIC_RUNTIME_DIRS=(uploads submissions backups tmp logs)

read_env_var() {
  local env_file="$1" key="$2" value=""
  if [[ -f "$env_file" ]]; then
    value=$(grep -E "^${key}=" "$env_file" | tail -1 | cut -d= -f2- | sed 's/[[:space:]]#.*$//' | tr -d '\r"'"'"'' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//') || true
  fi
  printf '%s' "$value"
}

# Resolve a path the same way the Node server does (relative paths are
# relative to the backend working directory used by PM2).
resolve_path() {
  local base="$1" p="$2"
  if [[ "$p" == /* ]]; then printf '%s' "${p%/}"; else printf '%s' "${base%/}/${p%/}"; fi
}

uploads_dir() {
  local backend_dir="$1" env_file="$2" v
  v=$(read_env_var "$env_file" UPLOADS_DIR)
  if [[ -n "$v" ]]; then resolve_path "$backend_dir" "$v"; else printf '%s' "${backend_dir%/}/uploads"; fi
}

submissions_dir() {
  local backend_dir="$1" env_file="$2" v up
  v=$(read_env_var "$env_file" SUBMISSIONS_DIR)
  if [[ -n "$v" ]]; then
    resolve_path "$backend_dir" "$v"
  else
    # Same default as server/src/services/submissionStorage.js
    up=$(uploads_dir "$backend_dir" "$env_file")
    printf '%s' "$(dirname "$up")/submissions"
  fi
}

cmd_dirs() {
  local backend_dir="$1" env_file="$2"
  uploads_dir "$backend_dir" "$env_file"; echo
  submissions_dir "$backend_dir" "$env_file"; echo
}

cmd_backup() {
  local backend_dir="$1" env_file="$2" backup_root="$3"
  local up sub
  up=$(uploads_dir "$backend_dir" "$env_file")
  sub=$(submissions_dir "$backend_dir" "$env_file")

  local sources=()
  [[ -d "$up" ]] && sources+=("$up")
  [[ -d "$sub" ]] && sources+=("$sub")
  if [[ ${#sources[@]} -eq 0 ]]; then
    echo "Backup: no uploads or submissions folder exists yet, nothing to back up."
    return 0
  fi

  case "$backup_root/" in
    "${backend_dir%/}/"*)
      echo "Backup: WARNING backup folder is inside the deployed code tree, skipping backup."
      return 0 ;;
  esac

  if ! mkdir -p "$backup_root" 2>/dev/null; then
    echo "Backup: WARNING cannot create backup folder, skipping backup."
    return 0
  fi

  local data_kb free_kb
  data_kb=$(du -sk "${sources[@]}" 2>/dev/null | awk '{s+=$1} END {print s+0}')
  free_kb=$(df -Pk "$backup_root" 2>/dev/null | awk 'NR==2 {print $4+0}')
  if [[ -z "$free_kb" || "$free_kb" -lt $((data_kb * 2)) ]]; then
    echo "Backup: SKIPPED, free disk space (${free_kb:-unknown} KB) is below twice the data size (${data_kb} KB)."
    return 0
  fi

  local stamp archive
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  archive="${backup_root%/}/rca-data-${stamp}.tar.gz"
  local tar_args=()
  local s
  for s in "${sources[@]}"; do
    tar_args+=(-C "$(dirname "$s")" "$(basename "$s")")
  done

  if tar -czf "$archive" "${tar_args[@]}" 2>/dev/null; then
    echo "Backup: created $(basename "$archive") (${data_kb} KB of data)."
  else
    rm -f "$archive" 2>/dev/null || true
    echo "Backup: WARNING archive creation failed, continuing deploy."
    return 0
  fi

  # Keep the 3 newest archives
  local old
  old=$(ls -1t "${backup_root%/}"/rca-data-*.tar.gz 2>/dev/null | tail -n +4 || true)
  if [[ -n "$old" ]]; then
    echo "$old" | while read -r f; do rm -f "$f"; done
    echo "Backup: pruned older archives, 3 newest kept."
  fi
  return 0
}

cmd_sync() {
  local src="$1" backend_dir="$2" env_file="$3"
  backend_dir="${backend_dir%/}"
  mkdir -p "$backend_dir"

  local excludes=(--exclude=node_modules --exclude=/.env)
  local d
  for d in "${STATIC_RUNTIME_DIRS[@]}"; do
    excludes+=("--exclude=/${d}/")
  done

  # Protect custom data folders when they live inside the backend directory.
  for d in "$(uploads_dir "$backend_dir" "$env_file")" "$(submissions_dir "$backend_dir" "$env_file")"; do
    case "$d/" in
      "$backend_dir/"*)
        local rel="${d#"$backend_dir"/}"
        [[ -n "$rel" ]] && excludes+=("--exclude=/${rel}/")
        ;;
    esac
  done

  echo "Sync: protecting runtime data folders: ${excludes[*]}"
  rsync -a --delete "${excludes[@]}" "${src%/}/" "$backend_dir/"
}

main() {
  local cmd="${1:-}"; shift || true
  case "$cmd" in
    dirs)   cmd_dirs "$@" ;;
    backup) cmd_backup "$@" || { echo "Backup: WARNING unexpected error, continuing deploy."; return 0; } ;;
    sync)   cmd_sync "$@" ;;
    *) echo "Usage: $0 {dirs|backup|sync} ..." >&2; return 2 ;;
  esac
}

main "$@"
