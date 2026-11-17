# Manual device checklist

Automated tests cover logic and flows. These checks need a real iPad, because
they are about touch, sound and iPadOS behaviour. Run them after each deploy
that changes audio, layout or the service worker. Tick each box on the device.

Device: ____________ iPadOS: ________ App version: ________ Date: ________

## 1. Install

- [ ] Open the site in **Safari**. Share → **Add to Home Screen**. The icon and the name "Reading" appear.
- [ ] Open the app **from the home screen** once while online. It opens full screen with no Safari bars.
- [ ] Parent area → About shows "Ready to work offline".
- [ ] Turn on **Airplane Mode**. Force-quit the app (swipe it away) and open it again. It starts normally.
- [ ] Still in Airplane Mode: start a Solo session and open a Coach story. Text, pictures and recorded audio all work.

## 2. Audio unlock

- [ ] After a cold start, tapping the big Start button is enough for sound to work for the rest of the visit.
- [ ] Lock the iPad for a minute, unlock it, and tap a sound dot: it still plays.
- [ ] Switch to another app and back: sound still plays.

## 3. Latency feel (target: under 50 ms tap to sound)

- [ ] In sound-it-out, each dot plays its sound the instant it is touched. There is no "press, pause, sound".
- [ ] Sliding the blend thumb slowly holds continuous sounds (m, s, a…) and plays stop sounds (b, t, p…) once.
- [ ] Sliding quickly runs the sounds together into the word.
- [ ] Sound Studio → Test blend sounds smooth, with no clicks between sounds.

## 4. Touch targets

- [ ] Every button she uses can be hit first time with a child's finger (targets are 60 pt or more).
- [ ] Letter tiles can be dragged into boxes, and tapping a tile also places it.
- [ ] The parent gear needs a full 3-second hold. A quick tap does nothing.
- [ ] Leaving a Solo session needs a 2-second hold on the home icon.
- [ ] No text can be selected, and no magnifier or copy menu appears on a long press.

## 5. Guided Access

- [ ] Settings → Accessibility → Guided Access is on, with a passcode.
- [ ] In the app, triple-click the top (or Home) button → Start. She cannot leave the app.
- [ ] Triple-click again and enter the passcode to end Guided Access.

## 6. Orientation and layout

- [ ] Landscape: nothing is clipped on the home screen, each Solo activity, Coach reading and the parent area.
- [ ] Portrait: the same screens reflow and stay usable. In Coach mode the scoring strip moves below the text.
- [ ] Rotating in the middle of an item keeps her place.
- [ ] The safe areas are respected (nothing sits under the home indicator).

## 7. Muted or silent device

- [ ] With the volume at zero the app still runs and nothing is blocked.
- [ ] With **Quiet mode** on (Parent area → Settings), a Solo session skips sound matching and word building, and the session log shows the note.

## 8. Sound Studio

- [ ] The first recording asks for microphone permission, and recording works after allowing it.
- [ ] A recorded clip plays back trimmed (no silence before or after) and at a comfortable level.
- [ ] Re-recording replaces the clip. Deleting it returns the status to "Not recorded".

## 9. Data safety

- [ ] Progress is still there after a force-quit and after restarting the iPad.
- [ ] Backup → Export produces `readingapp-backup-YYYYMMDD.json` through the share sheet.
- [ ] Parent area → Backup shows "Storage protection: on".
