# Fruit Rehab Ninja Prototype

Fullscreen camera prototype for the Digital Aiding 4 Aging Hackathon 2026.

The app now uses a minimal Monkeytype-style flow:

1. Open the app.
2. Click `start camera`.
3. Allow camera permission.
4. Slice fruit with left or right index finger in fullscreen.
5. Review hand preference, capability, and possible learned non-use in the end summary.

This prototype is a preliminary screening aid only. It is not a medical diagnosis tool.

## Run locally

Serve the folder from localhost:

```powershell
python -m http.server 5173
```

Then visit:

```text
http://localhost:5173
```

Do not open `index.html` directly when testing camera. Browser camera APIs and ES modules work best from `localhost`.

## Controls

- `start camera`: starts MediaPipe Hands from CDN and opens fullscreen play mode.
- `pointer demo`: starts fullscreen play mode without camera, useful when CDN/camera is unavailable.
- `L` / `R`: temporary manual override for active hand.
- `end`: ends the current session and opens the summary.
- `play again`: starts another 60-second session.
- `load demo pattern`: populates a sample left learned non-use scenario in the summary.

## Camera tracking

- MediaPipe is loaded from CDN, so internet access is required.
- Camera input is mirrored to feel natural to the user.
- MediaPipe handedness is normalized for mirror view.
- The index fingertip controls the slice cursor.
- The app uses `modelComplexity: 0`, 640x480 camera input, and throttled inference to reduce lag.

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
