# sms-scheduler

Sends SMS from the device's own SIM, at a wall-clock time, with no user
interaction and without the app being open. Android only.

## Why this exists

`expo-sms` cannot do this. It opens the system SMS composer with the message
pre-filled and waits for the user to press send — deliberately, because that is
the only thing an app can do without holding the `SEND_SMS` permission. Actually
sending needs `android.telephony.SmsManager`, which has no Expo wrapper, so this
is a local Expo module.

`expo-background-task` is also the wrong tool for the timing half. It runs on
WorkManager, whose minimum interval is about 15 minutes and which explicitly
will not promise a particular minute. "Send at 09:00" needs `AlarmManager`.

## How it works

```
AlarmManager.setExactAndAllowWhileIdle
        │  (fires even in Doze, app closed, process dead)
        ▼
SmsAlarmReceiver ──► SmsSender ──► SmsManager.sendTextMessage
        │                                  │
        │                                  ▼ (PendingIntent, seconds later)
        │                          SmsAlarmReceiver ──► send log
        ▼
re-arms the next occurrence
```

The important property: **nothing above touches React Native.** The alarm starts
the process, the receiver runs, the message goes out, the process dies again.
That is why it works with the app swiped away.

That forces one design decision — schedules live in `SharedPreferences`, not
AsyncStorage. At fire time there is no JS runtime to ask, so everything the
receiver needs has to be somewhere native code can read on its own.

Two events silently wipe every registered alarm: a reboot, and the app's own
package being replaced by an update. `SmsBootReceiver` listens for both and
re-arms. Without it, schedules keep looking healthy in the UI and simply never
fire again.

### Files

| File | Role |
| --- | --- |
| `SmsSchedulerModule.kt` | The JS-facing API |
| `SmsSchedule.kt` | The record, and the "when does this next fire" maths |
| `SmsScheduleStore.kt` | SharedPreferences persistence for schedules and the log |
| `SmsAlarmScheduler.kt` | Arms, cancels, and re-arms alarms |
| `SmsAlarmReceiver.kt` | Fires a schedule; records the carrier's result |
| `SmsBootReceiver.kt` | Re-arms after reboot and after app update |
| `SmsSender.kt` | `SmsManager` calls, multipart splitting, error decoding |

Repeating schedules store only `hour`/`minute` (plus weekdays), never an
absolute timestamp, and recompute the next occurrence in the device's current
time zone. So they survive reboots, travel, and DST without JS ever running.

## Requirements

This needs a native build. It is not in Expo Go:

```bash
bun run android
```

## API

```ts
import {
  isAvailable,
  requestPermissions,
  saveSchedule,
  listSchedules,
  cancelSchedule,
  sendNow,
  getLog,
} from "@/modules/sms-scheduler";

await requestPermissions();

await saveSchedule({
  recipients: ["+998901234567"],
  body: "Standup in 10 minutes.",
  repeat: "weekly",
  hour: 9,
  minute: 50,
  daysOfWeek: [2, 3, 4, 5, 6], // 1 = Sunday … 7 = Saturday
});
```

| Function | Notes |
| --- | --- |
| `isAvailable()` | False on iOS, web, Expo Go, and non-telephony devices |
| `getPermissions()` / `requestPermissions()` | `SEND_SMS` |
| `requestPhoneStatePermission()` | Only needed to list SIM slots |
| `canScheduleExactAlarms()` | See below |
| `isIgnoringBatteryOptimizations()` | See below |
| `openExactAlarmSettings()` / `openBatteryOptimizationSettings()` / `openAppSettings()` | Opens the relevant OS screen |
| `getSimSlots()` | Dual-SIM; empty without `READ_PHONE_STATE` |
| `listSchedules()` / `saveSchedule()` / `setScheduleEnabled()` / `cancelSchedule()` | CRUD |
| `rescheduleAll()` | Re-arms everything; recovery hatch |
| `sendNow()` | Bypasses the scheduler |
| `getLog()` / `clearLog()` | Last 200 send attempts with per-message outcome |
| `addSchedulesChangedListener()` | Fires when an alarm sends while the app is open |

`saveSchedule` with an existing `id` replaces that schedule and re-arms it.

## Three things that stop a message from being sent

Each of these fails quietly, which is why the Messages tab surfaces all three
rather than hiding them in Settings.

**1. `SEND_SMS` not granted.** A runtime permission. If it is revoked after a
schedule is created, the receiver disables the schedule and records
`"SMS permission was revoked"` rather than deleting it, so the reason is
visible.

**2. Exact alarms.** On Android 12 and 13 `SCHEDULE_EXACT_ALARM` is granted on
install. On **Android 14+ it is denied by default** and only the user can grant
it, from Settings → Alarms & reminders. Without it the module falls back to
`setAndAllowWhileIdle`: the message still goes out, but Android batches it, so
09:00 may become 09:12. `canScheduleExactAlarms()` reports which mode is in
effect.

There is a second permission, `USE_EXACT_ALARM`, that is granted automatically —
but Play policy restricts it to alarm clocks and calendars, so it is
deliberately not declared here.

**3. Battery optimisation.** The usual reason a schedule works on one phone and
not another. Xiaomi, Huawei, Oppo and Samsung builds are considerably more
aggressive than stock Android about killing alarms for non-exempt apps.
`openBatteryOptimizationSettings()` opens the list screen — the direct
"allow this app?" dialog needs `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, which
Play treats as restricted, so the list screen is the policy-safe route.

## Google Play

`SEND_SMS` is in Play's restricted SMS permission group. An app that requests it
must have core functionality that genuinely requires it, must fall into one of
Google's permitted use cases, and must submit a Permissions Declaration in Play
Console. Apps that do not qualify are expected to use the SMS composer intent
(what `expo-sms` does) instead, and are rejected otherwise.

This does not apply to sideloaded builds, internal testing, or MDM/enterprise
distribution. If the app is going to Play, settle the declaration before
building on top of this.

## Missed sends

A one-shot whose moment passed while the device was off is sent late if it is
less than 15 minutes overdue (`CATCH_UP_WINDOW_MS`), and otherwise marked
`missed` and disabled. The cutoff exists because a "leaving now" text arriving
four hours late is worse than one that never arrives. Repeating schedules just
skip to their next occurrence.

## Testing it

```bash
# What is actually armed
adb shell dumpsys alarm | grep -i smsscheduler

# Fake a reboot to check the boot receiver re-arms (emulator/userdebug)
adb shell am broadcast -a android.intent.action.BOOT_COMPLETED \
  -p com.iqboljonhasan.mobilestarter

# Watch a send happen
adb logcat -s SmsSender:* SmsAlarmReceiver:* SmsAlarmScheduler:*
```

An emulator has no radio, so sends fail with `RESULT_ERROR_NO_SERVICE` — the
scheduling half is still fully testable there, but the send half needs a real
device with a SIM. Two emulators can text each other using the other's port
number (`5556`) as the recipient.
