#!/usr/bin/env python3
"""
Listen for the wake phrase \"brandon wake up\" (case-insensitive, fuzzy) and open Terminal with BrandonCode.

Requires:
  python3 -m pip install -r scripts/requirements-voice.txt
  macOS: brew install portaudio   # for PyAudio

Uses Google Web Speech API by default (needs network). Set USE_SPHINX=1 for offline (less accurate).

Stop with Ctrl+C.

Logs:
  Every successful transcription is printed as: [voice-wake] transcript: "…"
  Set VOICE_WAKE_VERBOSE=1 to also log each capture, failed transcriptions, and engine used.
  After wake phrase, dictation mode is enabled by default:
    - speak your prompt
    - say "done" to submit into the opened Terminal
    - say "cancel" to abort current prompt

If nothing is captured (no "audio captured" in verbose mode):
  macOS: System Settings → Privacy & Security → Microphone → enable Terminal (or iTerm).
  Try: VOICE_WAKE_SENSITIVE=1 npm run voice:wake
  List inputs: VOICE_WAKE_LIST_MICS=1 npm run voice:wake
  Pick device: VOICE_WAKE_MIC_INDEX=2 npm run voice:wake
"""

from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LAUNCH_SCRIPT = REPO_ROOT / "scripts" / "launch-brandoncode-terminal.sh"
LOG_PREFIX = "[voice-wake]"
DONE_WORDS = {"done", "send", "submit"}
CANCEL_WORDS = {"cancel", "stop", "never mind", "nevermind"}
USAGE_PATTERNS = [
    re.compile(r"\bi want to check my usage\b"),
    re.compile(r"\bcheck my usage\b"),
    re.compile(r"\bshow (?:me )?my usage\b"),
]


def _env_int(name: str, default: int | None = None) -> int | None:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw.strip())
    except ValueError:
        print(f"{LOG_PREFIX} invalid {name}={raw!r} — ignoring", file=sys.stderr, flush=True)
        return default


def _print_input_devices(sr: object) -> None:
    try:
        names = sr.Microphone.list_microphone_names()
    except OSError as e:
        print(f"{LOG_PREFIX} could not list microphones: {e}", file=sys.stderr, flush=True)
        return
    print(f"{LOG_PREFIX} available input devices:", flush=True)
    for i, name in enumerate(names):
        label = name if name else "(unnamed)"
        print(f"{LOG_PREFIX}   [{i}] {label}", flush=True)


def _resolve_mic_device_index(sr: object) -> int | None:
    idx = _env_int("VOICE_WAKE_MIC_INDEX")
    if idx is not None:
        print(f"{LOG_PREFIX} using VOICE_WAKE_MIC_INDEX={idx}", flush=True)
    return idx


def _transcribe(sr: object, recognizer: object, audio: object, use_sphinx: bool) -> str | None:
    try:
        if use_sphinx:
            return recognizer.recognize_sphinx(audio)
        return recognizer.recognize_google(audio)
    except sr.UnknownValueError:
        return None


def _send_text_to_front_terminal(text: str, submit: bool) -> None:
    # AppleScript string escaping for keystroke payload.
    escaped = text.replace("\\", "\\\\").replace('"', '\\"')
    delay_s = float(os.environ.get("VOICE_WAKE_TYPE_DELAY", "0.3"))

    parts = [
        'tell application "Terminal" to activate',
        f"delay {delay_s}",
        'tell application "System Events"',
        f'keystroke "{escaped}"',
    ]
    if submit:
        parts.append("key code 36")
    parts.append("end tell")

    cmd = ["osascript"]
    for p in parts:
        cmd.extend(["-e", p])
    subprocess.run(cmd, check=True)


def _open_terminal_in_listener_cwd() -> None:
    cwd = str(Path.cwd().resolve())
    run_cmd = f"cd {shlex.quote(cwd)}"
    subprocess.run(
        [
            "osascript",
            "-e",
            'tell application "Terminal" to activate',
            "-e",
            f'tell application "Terminal" to do script "{run_cmd}"',
        ],
        check=True,
    )


def _start_claude_in_new_terminal_session() -> None:
    cwd = str(Path.cwd().resolve())
    run_cmd = f"cd {shlex.quote(cwd)} && claude"
    subprocess.run(
        [
            "osascript",
            "-e",
            'tell application "Terminal" to activate',
            "-e",
            f'tell application "Terminal" to do script "{run_cmd}"',
        ],
        check=True,
    )


def _capture_prompt_until_done(
    *,
    sr: object,
    recognizer: object,
    source: object,
    use_sphinx: bool,
    verbose: bool,
    phrase_limit: int,
) -> str | None:
    print(f'{LOG_PREFIX} Dictation mode: say your prompt, then say "done" to submit.', flush=True)
    print(f'{LOG_PREFIX} Say "cancel" to abort the spoken prompt.', flush=True)

    segments: list[str] = []
    while True:
        try:
            if verbose:
                print(f"{LOG_PREFIX} dictation listening …", flush=True)
            audio = recognizer.listen(source, timeout=None, phrase_time_limit=phrase_limit)
            if verbose:
                print(f"{LOG_PREFIX} dictation captured — transcribing …", flush=True)
        except KeyboardInterrupt:
            print("\nExiting.")
            raise

        text = _transcribe(sr, recognizer, audio, use_sphinx)
        if text is None:
            if verbose:
                print(f"{LOG_PREFIX} dictation transcript: (no words recognized)", flush=True)
            continue

        clean = text.strip()
        if not clean:
            if verbose:
                print(f"{LOG_PREFIX} dictation transcript: (empty string)", flush=True)
            continue

        print(f'{LOG_PREFIX} dictation transcript: "{clean}"', flush=True)
        n = normalize(clean)
        maybe_text, maybe_control = _extract_trailing_control(clean)
        if maybe_control in DONE_WORDS:
            if maybe_text:
                segments.append(maybe_text)
                if verbose:
                    print(
                        f'{LOG_PREFIX} inline "{maybe_control}" detected — submitting captured text.',
                        flush=True,
                    )
            prompt = " ".join(segments).strip()
            if not prompt:
                print(f"{LOG_PREFIX} done heard, but no dictation captured.", flush=True)
                return None
            return prompt
        if n in CANCEL_WORDS or maybe_control in CANCEL_WORDS:
            print(f"{LOG_PREFIX} dictation canceled.", flush=True)
            return None

        segments.append(clean)

# Phrases that count as the wake command (spoken text, normalized)
WAKE_PATTERNS = [
    re.compile(r"brandon\s+wake\s+up"),
    re.compile(r"brandon\s+wakeup"),
    re.compile(r"brandon\s+wake\s*up"),
]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def is_usage_phrase(text: str) -> bool:
    n = normalize(text)
    return any(p.search(n) for p in USAGE_PATTERNS)


def run_usage_command_shortcut() -> None:
    print(f'{LOG_PREFIX} shortcut detected: "check usage"', flush=True)
    _start_claude_in_new_terminal_session()
    wait_sec = float(os.environ.get("VOICE_WAKE_USAGE_WAIT_SEC", "5"))
    print(f"{LOG_PREFIX} waiting {wait_sec:.1f}s before sending /usage …", flush=True)
    time.sleep(wait_sec)
    # Slightly longer focus delay to avoid dropping the first character.
    os.environ.setdefault("VOICE_WAKE_TYPE_DELAY", "0.8")
    _send_text_to_front_terminal("/usage", submit=True)
    print(f"{LOG_PREFIX} sent /usage in the same terminal session.", flush=True)


def _extract_trailing_control(text: str) -> tuple[str, str | None]:
    """
    If a phrase ends with a control word (e.g. "... done"), split it so users
    can say natural chunks like: "read the contacts folder done".
    """
    raw = text.strip()
    if not raw:
        return "", None
    # Strip trailing punctuation after dictation chunks.
    trimmed = re.sub(r"[^\w\s]+$", "", raw)
    n = normalize(trimmed)
    for control in sorted(DONE_WORDS | CANCEL_WORDS, key=len, reverse=True):
        if n == control:
            return "", control
        suffix = " " + control
        if n.endswith(suffix):
            cut = len(trimmed) - len(suffix)
            return trimmed[:cut].strip(), control
    return raw, None


def is_wake_phrase(text: str) -> bool:
    n = normalize(text)
    return any(p.search(n) for p in WAKE_PATTERNS)


def launch_terminal() -> None:
    if not LAUNCH_SCRIPT.is_file():
        print(f"Missing launcher: {LAUNCH_SCRIPT}", file=sys.stderr)
        sys.exit(1)
    env = os.environ.copy()
    # New Terminal should cd to wherever this listener was started (e.g. repo root after `cd BrandonCode`).
    env["BRANDONCODE_WAKE_CWD"] = str(Path.cwd().resolve())
    subprocess.run(["/bin/bash", str(LAUNCH_SCRIPT)], check=True, env=env)


def main() -> None:
    try:
        import speech_recognition as sr
    except ImportError:
        exe = sys.executable
        print(
            "speech_recognition is not installed for the Python that runs this script.",
            file=sys.stderr,
        )
        print(f"  Interpreter: {exe}", file=sys.stderr)
        print(
            f"  Fix: {exe} -m pip install -r scripts/requirements-voice.txt",
            file=sys.stderr,
        )
        print("  (Use -m pip so packages match `python3`; macOS: brew install portaudio)", file=sys.stderr)
        sys.exit(1)

    verbose = os.environ.get("VOICE_WAKE_VERBOSE") == "1"
    list_mics = os.environ.get("VOICE_WAKE_LIST_MICS") == "1"
    sensitive = os.environ.get("VOICE_WAKE_SENSITIVE") == "1"
    skip_ambient = os.environ.get("VOICE_WAKE_SKIP_AMBIENT") == "1"
    pl = _env_int("VOICE_WAKE_PHRASE_SEC", 8)
    phrase_limit = 8 if pl is None else max(1, pl)

    if list_mics or verbose:
        _print_input_devices(sr)

    mic_index = _resolve_mic_device_index(sr)
    mic_kw: dict = {}
    if mic_index is not None:
        mic_kw["device_index"] = mic_index

    r = sr.Recognizer()
    explicit_energy = os.environ.get("VOICE_WAKE_ENERGY", "").strip()
    if explicit_energy:
        try:
            r.energy_threshold = float(explicit_energy)
        except ValueError:
            print(f"{LOG_PREFIX} invalid VOICE_WAKE_ENERGY={explicit_energy!r} — using 200", file=sys.stderr)
            r.energy_threshold = 200
    else:
        # Softer default; adjust_for_ambient_noise may raise this a lot in noisy rooms.
        r.energy_threshold = 200
    r.dynamic_energy_threshold = True
    # Shorter pause before end-of-phrase helps short commands; env can override.
    pause_sec = float(os.environ.get("VOICE_WAKE_PAUSE_SEC", "0.6"))
    r.pause_threshold = pause_sec

    print(f'{LOG_PREFIX} Listening for "Brandon wake up" … (Ctrl+C to stop)')
    if verbose:
        print(f"{LOG_PREFIX} VOICE_WAKE_VERBOSE=1 — extra logging on")
    if sensitive:
        print(f"{LOG_PREFIX} VOICE_WAKE_SENSITIVE=1 — capping sensitivity (quieter speech)", flush=True)
    print(
        f"{LOG_PREFIX} Tip: if the mic seems dead, grant Microphone to this terminal app in macOS Settings.",
        flush=True,
    )

    use_sphinx = os.environ.get("USE_SPHINX") == "1"
    engine = "sphinx" if use_sphinx else "google"

    # One open microphone for the whole session (re-opening each loop often hurts capture).
    with sr.Microphone(**mic_kw) as source:
        if not skip_ambient:
            ambient_dur = float(os.environ.get("VOICE_WAKE_AMBIENT_SEC", "1.0"))
            print(f"{LOG_PREFIX} calibrating for ambient noise ({ambient_dur}s) — stay quiet…", flush=True)
            r.adjust_for_ambient_noise(source, duration=ambient_dur)
        else:
            print(f"{LOG_PREFIX} skipping ambient calibration (VOICE_WAKE_SKIP_AMBIENT=1)", flush=True)

        # Loud calibration pushes threshold up and misses quiet voices — cap unless user set VOICE_WAKE_ENERGY.
        if not explicit_energy:
            cap = _env_int("VOICE_WAKE_ENERGY_MAX", 350) or 350
            if sensitive:
                cap = min(cap, 180)
            before = r.energy_threshold
            r.energy_threshold = min(r.energy_threshold, cap)
            if verbose or before != r.energy_threshold:
                print(
                    f"{LOG_PREFIX} energy_threshold={r.energy_threshold:.0f}"
                    + (f" (was {before:.0f}, capped)" if before != r.energy_threshold else ""),
                    flush=True,
                )
        else:
            print(f"{LOG_PREFIX} energy_threshold={r.energy_threshold} (VOICE_WAKE_ENERGY)", flush=True)

        try:
            sample_rate = getattr(source, "SAMPLE_RATE", None)
            extra = f" sample_rate={sample_rate}" if sample_rate else ""
            print(f"{LOG_PREFIX} microphone open{extra}", flush=True)
        except OSError:
            pass

        while True:
            try:
                if verbose:
                    print(
                        f"{LOG_PREFIX} waiting for speech (up to {phrase_limit}s per chunk) …",
                        flush=True,
                    )
                audio = r.listen(source, timeout=None, phrase_time_limit=phrase_limit)
                if verbose:
                    print(f"{LOG_PREFIX} audio captured — transcribing ({engine}) …", flush=True)
            except sr.WaitTimeoutError:
                continue
            except KeyboardInterrupt:
                print("\nExiting.")
                return

            text = ""
            try:
                t = _transcribe(sr, r, audio, use_sphinx)
                text = "" if t is None else t
            except sr.UnknownValueError:
                if verbose:
                    print(f"{LOG_PREFIX} transcript: (no words recognized)", flush=True)
                continue
            except sr.RequestError as e:
                print(f"{LOG_PREFIX} speech service error: {e}", file=sys.stderr, flush=True)
                continue

            if not text:
                if verbose:
                    print(f"{LOG_PREFIX} transcript: (empty string)", flush=True)
                continue

            print(f'{LOG_PREFIX} transcript: "{text}"', flush=True)
            if normalize(text) in CANCEL_WORDS:
                print(f"{LOG_PREFIX} stop word heard — shutting down listener.", flush=True)
                return
            if is_usage_phrase(text):
                try:
                    run_usage_command_shortcut()
                except subprocess.CalledProcessError as e:
                    print(f"{LOG_PREFIX} failed to run usage shortcut: {e}", file=sys.stderr)
                    print(
                        f"{LOG_PREFIX} If prompted, allow Accessibility control for this terminal app.",
                        file=sys.stderr,
                    )
                continue

            if is_wake_phrase(text):
                print(f"{LOG_PREFIX} wake phrase matched — opening Terminal …", flush=True)
                try:
                    launch_terminal()
                except subprocess.CalledProcessError as e:
                    print(f"Launch failed: {e}", file=sys.stderr)
                    continue

                if os.environ.get("VOICE_WAKE_DICTATE", "1") == "1":
                    try:
                        prompt = _capture_prompt_until_done(
                            sr=sr,
                            recognizer=r,
                            source=source,
                            use_sphinx=use_sphinx,
                            verbose=verbose,
                            phrase_limit=phrase_limit,
                        )
                    except KeyboardInterrupt:
                        return
                    if prompt:
                        try:
                            if is_usage_phrase(prompt):
                                run_usage_command_shortcut()
                            else:
                                print(f'{LOG_PREFIX} sending prompt to Terminal: "{prompt}"', flush=True)
                                _send_text_to_front_terminal(prompt, submit=True)
                        except subprocess.CalledProcessError as e:
                            print(f"{LOG_PREFIX} failed to type into Terminal: {e}", file=sys.stderr)
                            print(
                                f"{LOG_PREFIX} If prompted, allow Accessibility control for this terminal app.",
                                file=sys.stderr,
                            )
                    else:
                        # Let user try wake again without terminating listener.
                        time.sleep(0.2)


if __name__ == "__main__":
    main()
