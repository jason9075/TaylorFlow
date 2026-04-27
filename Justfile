set shell := ["sh", "-c"]

default:
    @just --list

dev:
    @echo "\033[36m[TaylorFlow] Starting dev server on :8080...\033[0m"
    live-server --port=8080 --no-browser .

refresh:
    @echo "\033[34m[TaylorFlow] Refreshing...\033[0m"
    touch index.html

check:
    @live-server --version 2>&1 || true
    @just --version
