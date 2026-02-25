# Release & Publishing Process

This repository uses release-please.

## Rules

- All commits must follow Conventional Commits
- Versioning is managed automatically
- Never manually edit version numbers or CHANGELOG.md

## How a release happens

1. Merge changes into `main`
2. release-please opens a release PR
3. Review the PR
4. Merge the PR to:
   - create a git tag
   - create a GitHub release
   - publish to npm (via GitHub Actions)

## Notes

- This repo is a single npm package
- Publishing is done from CI only
