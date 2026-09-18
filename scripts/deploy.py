#!/usr/bin/env python3
"""Commit and push the current project branch for deployment."""

from __future__ import annotations

import os
import shlex
import subprocess
import sys


DEFAULT_MESSAGE = "chore: deploy"


class DeployError(RuntimeError):
    """Raised when the repository cannot be deployed safely."""


def run_git(
    *args: str,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        check=True,
        capture_output=capture_output,
        text=True,
    )


def select_remote() -> str:
    remotes = run_git("remote", capture_output=True).stdout.splitlines()
    configured = os.environ.get("DEPLOY_GIT_REMOTE", "").strip()

    if configured:
        if configured in remotes:
            return configured
        raise DeployError(f"Git remote '{configured}' is not configured.")
    if "github" in remotes:
        return "github"
    if remotes:
        return remotes[0]
    raise DeployError("No Git remote configured.")


def current_branch() -> str:
    branch = run_git("branch", "--show-current", capture_output=True).stdout.strip()
    if not branch:
        raise DeployError("Cannot deploy from a detached HEAD.")
    return branch


def should_skip() -> str | None:
    if os.environ.get("SKIP_DEPLOY") == "1":
        return "SKIP_DEPLOY=1, skipping deployment."
    if os.environ.get("CF_PAGES") or os.environ.get("CI"):
        return "CI/Cloudflare environment detected, skipping deployment."
    return None


def deploy(message: str) -> None:
    remote = select_remote()
    branch = current_branch()

    print("======================================", flush=True)
    print("  Publish to GitHub / Cloudflare Pages", flush=True)
    print(f"  Remote: {remote}    Branch: {branch}", flush=True)
    print("======================================", flush=True)

    run_git("add", "-A")
    staged_diff = subprocess.run(["git", "diff", "--cached", "--quiet"])
    if staged_diff.returncode == 0:
        print("-> No changes; skipping commit", flush=True)
    elif staged_diff.returncode == 1:
        print(f"-> Commit: {message}", flush=True)
        run_git("commit", "-m", message)
    else:
        raise subprocess.CalledProcessError(staged_diff.returncode, staged_diff.args)

    print(f"-> Push {branch} to {remote}", flush=True)
    run_git("push", "-u", remote, branch)
    print("Deployment push completed.", flush=True)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    message = args[0] if args else DEFAULT_MESSAGE

    skip_reason = should_skip()
    if skip_reason:
        print(skip_reason)
        return 0

    try:
        deploy(message)
    except DeployError as error:
        print(f"Deployment failed: {error}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as error:
        command = shlex.join(str(part) for part in error.cmd)
        print(
            f"Deployment failed: {command} exited with status {error.returncode}.",
            file=sys.stderr,
        )
        if error.stderr:
            print(error.stderr.rstrip(), file=sys.stderr)
        return error.returncode or 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
