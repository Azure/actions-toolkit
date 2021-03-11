import * as fs from "fs";
import * as core from "@actions/core";
import { IExecSyncOptions, IExecSyncResult, ToolRunner } from "./toolrunner";
import {
  _endsWith,
  _ensureRooted,
  _isRooted,
  _normalizeSeparators,
  _startsWith
} from "./internal";
import child = require("child_process");
import path = require("path");
import events = require("events");
import stream = require("stream");
import os = require("os");
const shell = require("shelljs");
const minimatch = require("minimatch");

/**
 * Copies a file or folder.
 *
 * @param     source     source path
 * @param     dest       destination path
 * @param     options    string -r, -f or -rf for recursive and force
 * @param     continueOnError optional. whether to continue on error
 * @param     retryCount optional. Retry count to copy the file. It might help to resolve intermittent issues e.g. with UNC target paths on a remote host.
 */
export function cp(
  source: string,
  dest: string,
  options?: string,
  continueOnError?: boolean
): void {
  if (options) {
    shell.cp(options, source, dest);
  } else {
    shell.cp(source, dest);
  }

  checkShell("cp", continueOnError);
}

/**
 * Tests if error occurred in the last command and pipes it to runner logs
 *
 * @param     cmd     source path
 * @param     continueOnError optional. whether to continue on error
 */
export function checkShell(cmd: string, continueOnError?: boolean) {
  const se = shell.error();

  if (se) {
    core.debug(`${cmd} failed`);
    const errMsg = `Failed ${cmd}: ${se}`;
    core.debug(errMsg);

    if (!continueOnError) {
      throw new Error(errMsg);
    }
  }
}

/**
 * Make a directory.  Creates the full path with folders in between
 * Will throw if it fails
 *
 * @param     p       path to create
 * @returns   void
 */
export function mkdirP(p: string): void {
  if (!p) {
    throw new Error("p not supplied");
  }

  // build a stack of directories to create
  const stack: string[] = [];
  let testDir: string = p;
  while (true) {
    // validate the loop is not out of control
    if (stack.length >= (process.env["TASKLIB_TEST_MKDIRP_FAILSAFE"] || 1000)) {
      // let the framework throw
      core.debug("loop is out of control");
      fs.mkdirSync(p);
      return;
    }

    core.debug(`testing directory '${testDir}'`);
    let stats: fs.Stats;
    try {
      stats = fs.statSync(testDir);
    } catch (err) {
      if (err.code == "ENOENT") {
        // validate the directory is not the drive root
        const parentDir = path.dirname(testDir);
        if (testDir == parentDir) {
          throw new Error(
            `Unable to create directory ${p}. Root directory does not exist: ${testDir}`
          );
        }

        // push the dir and test the parent
        stack.push(testDir);
        testDir = parentDir;
        continue;
      } else if (err.code == "UNKNOWN") {
        throw new Error(
          `Unable to create directory ${p}. Unable to verify the directory exists: ${testDir}. If directory is a file share, please verify the share name is correct, the share is online, and the current process has permission to access the share.`
        );
      } else {
        throw err;
      }
    }

    if (!stats.isDirectory()) {
      throw new Error(
        `Unable to create directory ${p}. Conflicting file exists: ${testDir}`
      );
    }

    // testDir exists
    break;
  }

  // create each directory
  while (stack.length) {
    const dir = stack.pop()!; // non-null because `stack.length` was truthy
    core.debug(`mkdir '${dir}'`);
    try {
      fs.mkdirSync(dir);
    } catch (err) {
      throw new Error(`Unable to create directory ${p} . ${err.message}`);
    }
  }
}

/**
 * Recursively finds all paths for a given path. Returns an array of paths.
 *
 * @param     findPath  path to search
 * @returns   string[]
 */
export function find(findPath: string): string[] {
  if (!findPath) {
    core.debug("no path specified");
    return [];
  }

  // normalize the path, otherwise the first result is inconsistently formatted from the rest of the results
  // because path.join() performs normalization.
  findPath = path.normalize(findPath);

  // debug trace the parameters
  core.debug(`findPath: '${findPath}'`);

  // return empty if not exists
  try {
    fs.lstatSync(findPath);
  } catch (err) {
    if (err.code == "ENOENT") {
      core.debug("0 results");
      return [];
    }

    throw err;
  }

  try {
    const result: string[] = [];

    // push the first item
    const stack: _FindItem[] = [new _FindItem(findPath, 1)];
    const traversalChain: string[] = []; // used to detect cycles

    while (stack.length) {
      // pop the next item and push to the result array
      const item = stack.pop()!; // non-null because `stack.length` was truthy
      result.push(item.path);

      // stat the item.  the stat info is used further below to determine whether to traverse deeper
      //
      // stat returns info about the target of a symlink (or symlink chain),
      // lstat returns info about a symlink itself
      let stats: fs.Stats;
      // use lstat (not following symlinks)
      stats = fs.lstatSync(item.path);

      // note, isDirectory() returns false for the lstat of a symlink
      if (stats.isDirectory()) {
        core.debug(`  ${item.path} (directory)`);

        // push the child items in reverse onto the stack
        const childLevel: number = item.level + 1;
        const childItems: _FindItem[] = fs
          .readdirSync(item.path)
          .map(
            (childName: string) =>
              new _FindItem(path.join(item.path, childName), childLevel)
          );
        for (let i = childItems.length - 1; i >= 0; i--) {
          stack.push(childItems[i]);
        }
      } else {
        core.debug(`  ${item.path} (file)`);
      }
    }

    core.debug(`${result.length} results`);
    return result;
  } catch (err) {
    throw new Error(`Failed find: ${err.message}`);
  }
}

/**
 * Applies glob patterns to a list of paths. Supports interleaved exclude patterns.
 *
 * @param  list         array of paths
 * @param  patterns     patterns to apply. supports interleaved exclude patterns.
 * @param  patternRoot  optional. default root to apply to unrooted patterns. not applied to basename-only patterns when matchBase:true.
 * @param  options      optional. defaults to { dot: true, nobrace: true, nocase: process.platform == 'win32' }.
 */
export function match(
  list: string[],
  patterns: string[] | string,
  patternRoot?: string,
  options?: MatchOptions
): string[] {
  // trace parameters
  core.debug(`patternRoot: '${patternRoot}'`);
  options = options || _getDefaultMatchOptions(); // default match options
  _debugMatchOptions(options);

  // convert pattern to an array
  if (typeof patterns == "string") {
    patterns = [patterns];
  }

  // hashtable to keep track of matches
  const map: { [item: string]: boolean } = {};

  const originalOptions = options;
  for (let pattern of patterns) {
    core.debug(`pattern: '${pattern}'`);

    // trim and skip empty
    pattern = (pattern || "").trim();
    if (!pattern) {
      core.debug("skipping empty pattern");
      continue;
    }

    // clone match options
    const options = _cloneMatchOptions(originalOptions);

    // skip comments
    if (!options.nocomment && _startsWith(pattern, "#")) {
      core.debug("skipping comment");
      continue;
    }

    // set nocomment - brace expansion could result in a leading '#'
    options.nocomment = true;

    // determine whether pattern is include or exclude
    let negateCount = 0;
    if (!options.nonegate) {
      while (pattern.charAt(negateCount) == "!") {
        negateCount++;
      }

      pattern = pattern.substring(negateCount); // trim leading '!'
      if (negateCount) {
        core.debug(`trimmed leading '!'. pattern: '${pattern}'`);
      }
    }

    const isIncludePattern =
      negateCount == 0 ||
      (negateCount % 2 == 0 && !options.flipNegate) ||
      (negateCount % 2 == 1 && options.flipNegate);

    // set nonegate - brace expansion could result in a leading '!'
    options.nonegate = true;
    options.flipNegate = false;

    // expand braces - required to accurately root patterns
    let expanded: string[];
    const preExpanded: string = pattern;
    if (options.nobrace) {
      expanded = [pattern];
    } else {
      // convert slashes on Windows before calling braceExpand(). unfortunately this means braces cannot
      // be escaped on Windows, this limitation is consistent with current limitations of minimatch (3.0.3).
      core.debug("expanding braces");
      const convertedPattern =
        process.platform == "win32" ? pattern.replace(/\\/g, "/") : pattern;
      expanded = minimatch.braceExpand(convertedPattern);
    }

    // set nobrace
    options.nobrace = true;

    for (let pattern of expanded) {
      if (expanded.length != 1 || pattern != preExpanded) {
        core.debug(`pattern: '${pattern}'`);
      }

      // trim and skip empty
      pattern = (pattern || "").trim();
      if (!pattern) {
        core.debug("skipping empty pattern");
        continue;
      }

      // root the pattern when all of the following conditions are true:
      if (
        patternRoot && // patternRoot supplied
        !_isRooted(pattern) && // AND pattern not rooted
        // AND matchBase:false or not basename only
        (!options.matchBase ||
          (process.platform == "win32"
            ? pattern.replace(/\\/g, "/")
            : pattern
          ).includes("/"))
      ) {
        pattern = _ensureRooted(patternRoot, pattern);
        core.debug(`rooted pattern: '${pattern}'`);
      }

      if (isIncludePattern) {
        // apply the pattern
        core.debug("applying include pattern against original list");
        const matchResults: string[] = minimatch.match(list, pattern, options);
        console.log(`##[debug]${matchResults.length} matches`);

        // union the results
        for (const matchResult of matchResults) {
          map[matchResult] = true;
        }
      } else {
        // apply the pattern
        core.debug("applying exclude pattern against original list");
        const matchResults: string[] = minimatch.match(list, pattern, options);
        console.log(`##[debug]${matchResults.length} matches`);

        // substract the results
        for (const matchResult of matchResults) {
          delete map[matchResult];
        }
      }
    }
  }

  // return a filtered version of the original list (preserves order and prevents duplication)
  const result: string[] = list.filter((item: string) =>
    map.hasOwnProperty(item)
  );
  console.log(`##[debug]${result.length} final results`);
  return result;
}

/**
 * Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
 * Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
 * Appropriate for short running tools
 * Returns IExecResult with output and return code
 *
 * @param     tool     path to tool to exec
 * @param     args     an arg string or array of args
 * @param     options  optional exec options.  See IExecSyncOptions
 * @returns   IExecSyncResult
 */
export function execSync(
  tool: string,
  args: string | string[],
  options?: IExecSyncOptions
): IExecSyncResult {
  const tr: ToolRunner = this.tool(tool);
  tr.on("debug", (data: string) => {
    console.log(`##[debug]${data}`);
  });

  if (args) {
    if (args instanceof Array) {
      tr.arg(args);
    } else if (typeof args === "string") {
      tr.line(args);
    }
  }

  return tr.execSync(options);
}

/**
 * Convenience factory to create a ToolRunner.
 *
 * @param     tool     path to tool to exec
 * @returns   ToolRunner
 */
export function tool(tool: string) {
  const tr: ToolRunner = new ToolRunner(tool);
  tr.on("debug", (message: string) => {
    console.log(`##[debug]${message}`);
  });

  return tr;
}

class _FindItem {
  path: string;
  level: number;

  constructor(path: string, level: number) {
    this.path = path;
    this.level = level;
  }
}

interface MatchOptions {
  debug?: boolean;
  nobrace?: boolean;
  noglobstar?: boolean;
  dot?: boolean;
  noext?: boolean;
  nocase?: boolean;
  nonull?: boolean;
  matchBase?: boolean;
  nocomment?: boolean;
  nonegate?: boolean;
  flipNegate?: boolean;
}

function _getDefaultMatchOptions(): MatchOptions {
  return <MatchOptions>{
    debug: false,
    nobrace: true,
    noglobstar: false,
    dot: true,
    noext: false,
    nocase: process.platform == "win32",
    nonull: false,
    matchBase: false,
    nocomment: false,
    nonegate: false,
    flipNegate: false
  };
}

function _debugMatchOptions(options: MatchOptions): void {
  core.debug(`matchOptions.debug: '${options.debug}'`);
  core.debug(`matchOptions.nobrace: '${options.nobrace}'`);
  core.debug(`matchOptions.noglobstar: '${options.noglobstar}'`);
  core.debug(`matchOptions.dot: '${options.dot}'`);
  core.debug(`matchOptions.noext: '${options.noext}'`);
  core.debug(`matchOptions.nocase: '${options.nocase}'`);
  core.debug(`matchOptions.nonull: '${options.nonull}'`);
  core.debug(`matchOptions.matchBase: '${options.matchBase}'`);
  core.debug(`matchOptions.nocomment: '${options.nocomment}'`);
  core.debug(`matchOptions.nonegate: '${options.nonegate}'`);
  core.debug(`matchOptions.flipNegate: '${options.flipNegate}'`);
}

function _cloneMatchOptions(matchOptions: MatchOptions): MatchOptions {
  return <MatchOptions>{
    debug: matchOptions.debug,
    nobrace: matchOptions.nobrace,
    noglobstar: matchOptions.noglobstar,
    dot: matchOptions.dot,
    noext: matchOptions.noext,
    nocase: matchOptions.nocase,
    nonull: matchOptions.nonull,
    matchBase: matchOptions.matchBase,
    nocomment: matchOptions.nocomment,
    nonegate: matchOptions.nonegate,
    flipNegate: matchOptions.flipNegate
  };
}
