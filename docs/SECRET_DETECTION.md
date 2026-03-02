# Secret Detection

This project uses [gitleaks](https://github.com/gitleaks/gitleaks) to prevent committing secrets.

## How it works

A pre-commit hook automatically scans staged files for secrets before each commit. If secrets are detected, the commit is blocked.

## Installation

The hook is already installed at `.git/hooks/pre-commit`. If gitleaks is not installed, the hook will attempt to install it via Homebrew on first run.

Manual installation:
```bash
brew install gitleaks
```

## Handling false positives

If gitleaks flags something that isn't actually a secret:

1. Note the fingerprint from the error message (format: `file:rule:line`)
2. Add it to `.gitleaksignore`:
```
# Example
test-file.txt:generic-api-key:1
```

## Bypassing the hook (not recommended)

In rare cases where you need to bypass:
```bash
git commit --no-verify
```

⚠️ Only use this if you're absolutely certain there are no secrets in your commit.

## Testing

Test the hook:
```bash
echo "secret: sk_test_123456789" > test.txt
git add test.txt
git commit -m "test"  # Should be blocked
```
