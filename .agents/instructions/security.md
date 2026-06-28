# Security Guidelines

## Overview
Essential security constraints and boundaries for file and process management in the **yonru.clip** codebase.

## Rules

### 1. Absolute Path Validation
- **Traversal Prevention**: When implementing file deletions or reads on disk, always resolve absolute paths and validate against a base folder using `os.path.commonpath` to actively block directory traversal vulnerabilities.

### 2. Command Sanitization
- **Shell Injection Prevention**: Always escape or structure shell arguments securely to block command injection when spawning external FFmpeg, Node, or system subprocesses. Avoid raw string interpolation with user input in commands.
