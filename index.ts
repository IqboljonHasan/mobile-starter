import "expo-router/entry";
// Defines the daily Telegram backup task. It has to happen here rather than in
// a route: when the OS starts the app in the background to run the task, no
// screen is rendered and no route file is ever loaded.
import "./lib/backupTask";
