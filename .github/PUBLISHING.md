# Publishing Guide: CI/CD with GitHub Actions & npm OIDC

This document explains how to set up automated publishing to npm using GitHub Actions with OIDC (OpenID Connect) trusted publishing.

## Overview

The CI/CD pipeline (`.github/workflows/publish.yml`) automates:

- ✅ Running tests on every push and PR
- ✅ Running linting and validation
- ✅ Building the project
- ✅ Publishing to npm on release creation
- ✅ Creating GitHub release assets

## Prerequisites

1. **GitHub Repository**: Must be public for OIDC to work
2. **npm Account**: Need access to manage publishing settings
3. **Package**: Must be published at least once manually

## Setup Instructions

### Step 1: Publish v1.0.7 Manually (One-Time Setup)

First, publish the current version to npm manually to establish the package:

```bash
cd /Users/john_renaldi/claude-code-projects/google-workspace-mcp
npm publish --otp=<YOUR_6_DIGIT_CODE>
```

This creates the package on npm registry and enables OIDC configuration.

### Step 2: Configure OIDC Trusted Publisher on npm

Visit https://www.npmjs.com/ and:

1. **Log in** to your npm account
2. Go to **Account Settings** → **Publishing**
3. Click **Configure OIDC trusted publishers**
4. Click **Add a new trusted publisher**
5. Select:
   - **Where is the OIDC token coming from?**: GitHub Actions
   - **What kind of trusted publisher?**: GitHub repository
6. Fill in:
   - **GitHub repository owner** (username): `jrenaldi79`
   - **GitHub repository name**: `google-workspace-mcp`
   - **GitHub environment** (optional): leave blank or set to `publish`
7. Click **Add trusted publisher**

### Step 3: Verify Configuration

Check that the trusted publisher is configured correctly:

```bash
npm profile get
```

You should see the GitHub repository listed as a trusted publisher.

## Publishing a New Release

### Option A: Using GitHub Web Interface (Recommended)

1. Go to your GitHub repository
2. Click **Releases** → **Draft a new release**
3. Click **Choose a tag** and create a new tag matching your version (e.g., `v1.0.8`)
4. Set:
   - **Tag version**: `v1.0.8` (must match `package.json` version)
   - **Release title**: `Release v1.0.8` or description
   - **Description**: Add release notes
5. Click **Publish release**

The GitHub Actions workflow will automatically:

- ✅ Verify package version matches tag
- ✅ Run tests
- ✅ Run linting
- ✅ Build the project
- ✅ Publish to npm
- ✅ Upload dist files as release assets

### Option B: Using Git Command Line

```bash
# Update version in package.json
npm version patch  # or minor, major

# This automatically:
# - Updates package.json
# - Creates a git commit
# - Creates a git tag
# - Pushes to GitHub

# GitHub Actions will detect the tag and publish
```

### Option C: Manual Release + Workflow

```bash
# Update version
npm version minor --no-git-tag-version

# Commit
git add package.json
git commit -m "Bump version to 1.0.8"
git push origin master

# Create release on GitHub (via web interface)
# Tag: v1.0.8
# Workflow will automatically publish
```

## Workflow Details

### Triggers

The CI/CD pipeline runs on:

| Event                 | Behavior                                             |
| --------------------- | ---------------------------------------------------- |
| **Push to master**    | Run tests & linting only                             |
| **Pull Request**      | Run tests & linting                                  |
| **Release Published** | Run tests, lint, validate, build, **publish to npm** |

### Publishing Job Requirements

The `publish` job only runs when:

1. `test` job passes (all tests pass)
2. `validate` job passes (pre-publish checks pass)
3. Event is a release creation (`github.event_name == 'release'`)
4. Release action is 'published'

### Version Verification

The workflow verifies that:

- Package version in `package.json` matches the release tag
- Example: Tag `v1.0.8` must match `package.json` version `1.0.8`

If versions don't match, the publish job fails as a safety check.

## Environment Variables & Secrets

The workflow uses these variables:

| Variable          | Source      | Purpose                                        |
| ----------------- | ----------- | ---------------------------------------------- |
| `NODE_AUTH_TOKEN` | npm account | npm authentication (can be replaced with OIDC) |
| `GITHUB_TOKEN`    | GitHub      | Create release assets                          |
| `id-token: write` | Permissions | Enable OIDC token generation                   |

**Note**: With OIDC trusted publishing, you don't need `NPM_TOKEN`. The workflow can use OIDC automatically.

## Transitioning to OIDC Only (Advanced)

To remove the need for `NPM_TOKEN` secret entirely:

1. Update `.github/workflows/publish.yml`:

```yaml
# Change from:
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

# To: (nothing - npm will use OIDC automatically)
```

2. Remove `NPM_TOKEN` secret from GitHub (optional but cleaner)

3. npm will automatically use OIDC token from GitHub Actions

## Troubleshooting

### Build Fails on Push

**Problem**: Tests fail on push but you want to publish

**Solution**: Only publish job runs on release events, not on every push. Push tests failures won't block releases.

### Version Mismatch Error

**Problem**: Publish job fails with "Version mismatch"

**Solution**: Ensure the release tag matches the `package.json` version:

- Release tag: `v1.0.8`
- package.json: `"version": "1.0.8"`

### NPM Publish Fails with 404

**Problem**: Workflow tries to publish but gets 404 error

**Solution**:

1. Verify OIDC trusted publisher is configured on npm
2. Verify npm token has publish permissions
3. Run a manual publish first to create the package:
   ```bash
   npm publish --otp=<CODE>
   ```

### OIDC Token Rejected

**Problem**: npm rejects OIDC token

**Solution**:

1. Verify GitHub repository is **public**
2. Verify OIDC trusted publisher configuration on npm
3. Check that release tag matches package version
4. Verify permissions include `id-token: write`

## Manual Publishing (Fallback)

If the automated workflow fails, you can publish manually:

```bash
npm publish --otp=<YOUR_CODE>
```

Or with npm token (if configured):

```bash
NPM_TOKEN=<YOUR_TOKEN> npm publish
```

## Monitoring

After publishing:

1. **Check npm**: https://www.npmjs.com/package/@presto-ai/google-workspace-mcp
2. **Check GitHub Actions**: Repository → Actions tab
3. **Check GitHub Releases**: Repository → Releases
4. **Test Installation**:
   ```bash
   npm install @presto-ai/google-workspace-mcp@latest
   ```

## Security Best Practices

✅ **Recommended**:

- Use OIDC trusted publishing (no credentials stored)
- Require manual release creation (no auto-publish)
- Verify version before publishing
- Use Node.js LTS in CI/CD
- Run tests on all branches
- Cache npm dependencies

❌ **Avoid**:

- Storing npm tokens as secrets
- Auto-publishing on every commit
- Publishing without running tests
- Using old Node.js versions in CI

## References

- [npm OIDC Documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#publishconfig)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
