Voice wake: "Brandon wake up"
================================

1) Install system dependency (macOS):
   brew install portaudio

2) Install Python deps into the SAME interpreter you use to run the script:
   python3 -m pip install -r scripts/requirements-voice.txt
   (If you used plain `pip install`, a different Python than `python3` may have gotten
   the packages — always use `python3 -m pip`.)

   Or use a venv (recommended):
   cd /path/to/BrandonCode
   python3 -m venv .venv-voice
   source .venv-voice/bin/activate
   python3 -m pip install -r scripts/requirements-voice.txt

3) Run the listener (keeps running; uses microphone):
   npm run voice:wake
   # or: python3 scripts/wake_listen.py

   Logs: each line starts with [voice-wake]. Successful speech-to-text shows as:
   [voice-wake] transcript: "what you said"
   For more detail (each capture, failed transcriptions): VOICE_WAKE_VERBOSE=1 npm run voice:wake

If the mic "doesn't pick you up":
   - macOS: Settings → Privacy & Security → Microphone → enable your terminal app.
   - Try: VOICE_WAKE_SENSITIVE=1 VOICE_WAKE_VERBOSE=1 npm run voice:wake
   - List inputs: VOICE_WAKE_LIST_MICS=1 npm run voice:wake
   - Use index: VOICE_WAKE_MIC_INDEX=1 npm run voice:wake
   - Skip noisy calibration: VOICE_WAKE_SKIP_AMBIENT=1 VOICE_WAKE_SENSITIVE=1 npm run voice:wake

4) Say clearly: "Brandon, wake up"
   A new Terminal window should open in the same directory you ran the listener from
   (e.g. the BrandonCode folder), and run: npm run dev
   After wake, dictation mode starts:
   - speak your prompt in one or more chunks
   - say "done" to submit (press Enter automatically)
   - say "cancel" to abort that prompt

5) Customize the command Terminal runs:
   export BRANDONCODE_WAKE_CMD="npm start"
   npm run voice:wake

Optional env toggles:
  VOICE_WAKE_DICTATE=0        disable post-wake prompt dictation
  VOICE_WAKE_TYPE_DELAY=0.3   delay before typing into Terminal

6) Offline recognition (worse accuracy):
   USE_SPHINX=1 npm run voice:wake
   (needs: pip install pocketsphinx)

Alternative without Python: macOS System Settings → Accessibility → Voice Control
→ customize commands to run:
   bash /full/path/to/BrandonCode/scripts/launch-brandoncode-terminal.sh
