#!/usr/bin/env python3
"""
Nauxica production deployment gate — CLAUDE.md Rule 16.

PreToolUse hook on Bash. Input: JSON on stdin {"command": "..."}.
Outputs {"permissionDecision": "ask", "message": "..."} when a
deployment or version-control write command is detected, forcing
explicit human approval regardless of the active permission mode.
Outputs nothing and exits 0 if no gated command is detected.
"""
import sys
import json

GATES = [
    (
        "supabase db push",
        "NAUXICA Rule 16: `supabase db push` applies live database migrations to production. "
        "This requires explicit human instruction per CLAUDE.md. "
        "Approve only if you are explicitly directing this action right now.",
    ),
    (
        "supabase functions deploy",
        "NAUXICA Rule 16: `supabase functions deploy` deploys Edge Functions to production. "
        "This requires explicit human instruction per CLAUDE.md. "
        "Approve only if you are explicitly directing this action right now.",
    ),
    (
        "git commit",
        "NAUXICA Rule 16: `git commit` requires explicit human instruction per CLAUDE.md. "
        "Approve only if you have explicitly instructed Claude to commit now.",
    ),
    (
        "git push",
        "NAUXICA Rule 16: `git push` requires explicit human instruction per CLAUDE.md. "
        "Approve only if you have explicitly instructed Claude to push now.",
    ),
]


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    cmd = data.get("command", "")
    for trigger, message in GATES:
        if trigger in cmd:
            print(json.dumps({"permissionDecision": "ask", "message": message}))
            sys.exit(0)


if __name__ == "__main__":
    main()
