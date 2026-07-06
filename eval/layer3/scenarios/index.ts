import { morningBriefingScenarios } from "./morning-briefing";
import { taskScenarios } from "./tasks";
import { reminderScenarios } from "./reminders";
import { settingsScenarios } from "./settings";
import { mixedScenarios } from "./mixed-conversations";
import { longContextScenarios } from "./long-context";
import { weatherScenarios } from "./weather";
import { casualScenarios } from "./casual";
import { qrPlantScenarios } from "./qr-plant";

export const ALL_SCENARIOS = [
  ...weatherScenarios,
  ...morningBriefingScenarios,
  ...taskScenarios,
  ...reminderScenarios,
  ...settingsScenarios,
  ...mixedScenarios,
  ...longContextScenarios,
  ...casualScenarios,
  ...qrPlantScenarios,
];
