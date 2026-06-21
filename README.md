# Fruit Rehab Ninja Prototype

Playable web prototype for the Digital Aiding 4 Aging Hackathon 2026 idea.

The app turns a Fruit Ninja style interaction into a light screening workflow:

- Free Choice mode estimates which hand is voluntarily preferred.
- Forced Hand mode compares left and right physical capability.
- Adaptive Training mode biases targets toward the side that appears to need more support.
- The analytics panel calculates Speed, Accuracy, Movement Quality, Physical Capability, Usage Preference, and Learned Non-Use Gap.

This is a prototype and should be described as a preliminary assessment aid, not a medical diagnosis tool.

## Run locally

Serve the folder. Camera and ES modules should be run from `localhost`, not by opening the file directly:

```powershell
python -m http.server 5173
```

Then visit `http://localhost:5173`.

## Controls

- Start session: begins spawning fruit.
- Mode: switches between Free Choice, Forced Hand, and Adaptive Training.
- Active hand: choose Left or Right with buttons or keyboard keys `L` and `R`.
- Pointer or touch: slice fruit.
- Load demo pattern: instantly populates a sample case where the left side has capability but low voluntary usage.
- Enable camera: starts MediaPipe Hands from CDN, shows a mirrored camera preview, and uses the index fingertip as the slice cursor.

## Camera tracking

- The preview is mirrored so the user's left hand feels like left on screen.
- MediaPipe handedness is normalized for mirror view before updating the active hand.
- If one hand is visible, that hand becomes the active slicer.
- If two hands are visible, the app chooses the hand nearest to the current fruit, or the hand with the most recent movement when no fruit is active.
- Manual Left/Right buttons and keyboard keys still temporarily override tracking when handedness needs correction.
- If MediaPipe CDN or camera permission fails, pointer and touch controls still work.

## Metrics

Usage Preference Score:

```text
free choices for a hand / free-choice opportunities * 100
```

Physical Capability Score:

```text
0.35 * Speed Score + 0.35 * Accuracy Score + 0.30 * Movement Quality Score
```

Learned Non-Use Gap:

```text
Physical Capability Score - Usage Preference Score
```

If one side has high capability but low voluntary usage, the app reports a possible learned non-use tendency instead of a diagnosis.
