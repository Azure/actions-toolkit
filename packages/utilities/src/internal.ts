import path = require("path");

export function _endsWith(str: string, end: string): boolean {
  return str.slice(-end.length) == end;
}

export function _isRooted(p: string): boolean {
  p = _normalizeSeparators(p);
  if (!p) {
    throw new Error('isRooted() parameter "p" cannot be empty');
  }

  if (process.platform == "win32") {
    return (
      _startsWith(p, "\\") || /^[A-Z]:/i.test(p) // e.g. \ or \hello or \\hello
    ); // e.g. C: or C:\hello
  }

  return _startsWith(p, "/"); // e.g. /hello
}

export function _ensureRooted(root: string, p: string) {
  if (!root) {
    throw new Error('ensureRooted() parameter "root" cannot be empty');
  }

  if (!p) {
    throw new Error('ensureRooted() parameter "p" cannot be empty');
  }

  if (_isRooted(p)) {
    return p;
  }

  if (process.platform == "win32" && root.match(/^[A-Z]:$/i)) {
    // e.g. C:
    return root + p;
  }

  // ensure root ends with a separator
  if (
    _endsWith(root, "/") ||
    (process.platform == "win32" && _endsWith(root, "\\"))
  ) {
    // root already ends with a separator
  } else {
    root += path.sep; // append separator
  }

  return root + p;
}

export function _normalizeSeparators(p: string): string {
  p = p || "";
  if (process.platform == "win32") {
    // convert slashes on Windows
    p = p.replace(/\//g, "\\");

    // remove redundant slashes
    const isUnc = /^\\\\+[^\\]/.test(p); // e.g. \\hello
    return (isUnc ? "\\" : "") + p.replace(/\\\\+/g, "\\"); // preserve leading // for UNC
  }

  // remove redundant slashes
  return p.replace(/\/\/+/g, "/");
}

export function _startsWith(str: string, start: string): boolean {
  return str.slice(0, start.length) == start;
}
