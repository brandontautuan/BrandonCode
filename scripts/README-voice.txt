Voice Activation Guide (BrandonCode)
====================================

Overview
--------
This voice listener runs in your current terminal session and waits for speech.
It supports:

1) Wake phrase flow:
   - say: "Brandon wake up"
   - opens Terminal in the same cwd where listener was started
   - runs BrandonCode command (default: npm run dev)
   - optionally enters dictation mode and types your spoken prompt

2) Global spoken shortcut:
   - say: "I want to check my usage" (or "check my usage")
   - opens Terminal in your current cwd
   - runs: claude
   - waits 5 seconds
   - sends: /usage + Enter

3) Global stop word:
   - say: "cancel" at top level to shut down the listener


Prerequisites
-------------
macOS dependency:
  brew install portaudio

Python packages (use same interpreter as python3):
  python3 -m pip install -r scripts/requirements-voice.txt

Recommended (venv):
  cd /path/to/BrandonCode
  python3 -m venv .venv-voice
  source .venv-voice/bin/activate
  python3 -m pip install -r scripts/requirements-voice.txt

If you used plain pip and imports fail, reinstall with:
  python3 -m pip install -r scripts/requirements-voice.txt


macOS Permissions
-----------------
You may need to allow these:

1) Microphone:
   System Settings -> Privacy & Security -> Microphone
   Enable your terminal app (Terminal/iTerm/Cursor terminal host).

2) Accessibility (for simulated keystrokes):
   System Settings -> Privacy & Security -> Accessibility
   Enable your terminal app so script can type commands and press Enter.


How To Run
----------
From repo root:
  npm run voice:wake

Useful variants:
  npm run voice:wake:verbose
  npm run voice:wake:sensitive

Direct:
  python3 scripts/wake_listen.py

Stop manually:
  Ctrl+C


Wake Phrase Flow
----------------
Say:
  Brandon wake up

Behavior:
  - opens Terminal session in the same directory where listener started
  - runs command from BRANDONCODE_WAKE_CMD (default: npm run dev)
  - if dictation enabled, starts prompt capture:
      * speak prompt in one or more chunks
      * say "done" / "send" / "submit" to type prompt + Enter
      * trailing control is supported (example: "... done")
      * say "cancel" to abort only that dictation prompt

Top-level cancel:
  Saying "cancel" outside dictation stops the whole listener process.


Global Usage Shortcut
---------------------
Supported phrases:
  - "i want to check my usage"
  - "check my usage"
  - "show me my usage"

Behavior:
  1) opens Terminal in listener cwd
  2) runs: claude
  3) waits VOICE_WAKE_USAGE_WAIT_SEC (default 5)
  4) sends: /usage + Enter

Note:
  This shortcut is global while listener is running; no wake phrase required.


Configuration (Environment Variables)
-------------------------------------
Core:
  BRANDONCODE_WAKE_CMD
    Command run after wake phrase opens terminal.
    Default: npm run dev
    Example: export BRANDONCODE_WAKE_CMD="npm start"

  VOICE_WAKE_DICTATE
    1 = enable post-wake dictation (default)
    0 = disable dictation

Typing/shortcut timing:
  VOICE_WAKE_TYPE_DELAY
    Delay before keystroke typing via System Events.
    Default: 0.3 (usage shortcut may internally use a safer delay)

  VOICE_WAKE_USAGE_WAIT_SEC
    Wait after launching claude before sending /usage.
    Default: 5

  VOICE_WAKE_USAGE_OPEN_DELAY
    Optional extra delay before sending first shortcut keystrokes.

Recognition tuning:
  VOICE_WAKE_VERBOSE=1
    Extra logs (capture/transcribe details).

  VOICE_WAKE_SENSITIVE=1
    Lower cap for easier pickup of quiet speech.

  VOICE_WAKE_SKIP_AMBIENT=1
    Skip initial ambient calibration.

  VOICE_WAKE_ENERGY=<number>
    Manual energy threshold override.

  VOICE_WAKE_ENERGY_MAX=<number>
    Max cap used after calibration when VOICE_WAKE_ENERGY not set.

  VOICE_WAKE_PAUSE_SEC=<seconds>
    End-of-phrase pause threshold.

  VOICE_WAKE_PHRASE_SEC=<seconds>
    Per-capture phrase time limit.

Microphone device:
  VOICE_WAKE_LIST_MICS=1
    Print available microphone devices.

  VOICE_WAKE_MIC_INDEX=<n>
    Select specific microphone index.

Offline recognition:
  USE_SPHINX=1
    Use PocketSphinx instead of Google.
    Requires: python3 -m pip install pocketsphinx


Examples
--------
Basic:
  npm run voice:wake

Verbose debugging:
  VOICE_WAKE_VERBOSE=1 npm run voice:wake

Sensitive + verbose:
  npm run voice:wake:sensitive

Specific mic:
  VOICE_WAKE_MIC_INDEX=1 npm run voice:wake

Skip ambient calibration:
  VOICE_WAKE_SKIP_AMBIENT=1 VOICE_WAKE_SENSITIVE=1 npm run voice:wake

Custom wake launch command:
  export BRANDONCODE_WAKE_CMD="brandon agent --planner-only"
  npm run voice:wake

Longer usage wait:
  VOICE_WAKE_USAGE_WAIT_SEC=7 npm run voice:wake


Troubleshooting
---------------
Problem: "speech_recognition is not installed"
  Fix:
    python3 -m pip install -r scripts/requirements-voice.txt
  Make sure same python3 runs the script.

Problem: it hears me but does nothing
  - Check transcript lines in logs.
  - Phrase may not match exactly enough; speak clearly.
  - Try verbose mode to see recognized text.

Problem: mic seems dead
  - Verify Microphone permission for terminal app.
  - Try VOICE_WAKE_SENSITIVE=1.
  - Try VOICE_WAKE_LIST_MICS=1 and choose VOICE_WAKE_MIC_INDEX.

Problem: typing into Terminal fails
  - Grant Accessibility permission.
  - Ensure Terminal is frontmost.

Problem: /usage sends too early
  - Increase VOICE_WAKE_USAGE_WAIT_SEC (e.g. 7 or 10).

Problem: wake terminal opens wrong directory
  - Start listener from desired directory first.
  - New terminal follows listener cwd.


Alternative without Python listener
-----------------------------------
You can use macOS Voice Control to run launcher script directly:
  bash /full/path/to/BrandonCode/scripts/launch-brandoncode-terminal.sh
