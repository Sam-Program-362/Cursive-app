"""Cursive Python runner.

Runs the user's entry file on Android with a real CPython interpreter
(Chaquopy) so interactive ``input()``, file access and cross-file imports all
behave like a desktop terminal.

Stdout/stderr and input requests are streamed back to the Capacitor layer
through static methods on ``PythonRunnerPlugin``.
"""

import builtins
import os
import sys
import traceback

from java import jclass

Bridge = jclass("com.cursive.app.PythonRunnerPlugin")

_original_input = builtins.input

# Set to True from the Java side when the user taps Stop.
stop_requested = False


class _Stream:
    """File-like object that forwards writes to the JS console panel."""

    def __init__(self, is_err):
        self._is_err = is_err

    def write(self, text):
        if not text:
            return 0
        try:
            if self._is_err:
                Bridge.onStderr(str(text))
            else:
                Bridge.onStdout(str(text))
        except Exception:
            # Never let a logging failure kill the user's program.
            pass
        return len(text)

    def flush(self):
        pass

    def isatty(self):
        return False

    def writable(self):
        return True

    def readable(self):
        return False


_stream_out = _Stream(False)
_stream_err = _Stream(True)


def _input(prompt=""):
    """Drop-in replacement for builtins.input that asks the UI for a line."""
    if prompt:
        _stream_out.write(str(prompt))
    value = Bridge.requestInput(str(prompt))
    if value is None:
        if stop_requested:
            raise KeyboardInterrupt("Stopped by user")
        raise EOFError("Input stream was closed")
    return value


def _trace(frame, event, arg):
    if stop_requested:
        raise KeyboardInterrupt("Stopped by user")
    return _trace


def request_stop():
    """Called from Java to interrupt a running program."""
    global stop_requested
    stop_requested = True


def run(entry_path, project_dir):
    """Execute the entry file with ``project_dir`` as the working directory."""
    global stop_requested
    stop_requested = False

    sys.stdout = _stream_out
    sys.stderr = _stream_err
    builtins.input = _input

    if project_dir not in sys.path:
        sys.path.insert(0, project_dir)
    try:
        os.chdir(project_dir)
    except OSError:
        pass

    exit_code = 0
    try:
        with open(entry_path, "r", encoding="utf-8") as handle:
            source = handle.read()
        sys.settrace(_trace)
        module_globals = {"__name__": "__main__", "__file__": entry_path}
        exec(compile(source, entry_path, "exec"), module_globals)
    except KeyboardInterrupt:
        _stream_err.write("\nKeyboardInterrupt: execution stopped by user.\n")
        exit_code = 130
    except SystemExit as exc:
        code = exc.code
        if code is None:
            exit_code = 0
        elif isinstance(code, int):
            exit_code = code
        else:
            _stream_err.write(str(code) + "\n")
            exit_code = 1
    except BaseException:
        _stream_err.write(traceback.format_exc())
        exit_code = 1
    finally:
        sys.settrace(None)
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__
        builtins.input = _original_input

    Bridge.onExit(int(exit_code))
