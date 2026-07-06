import { defineScenario, noState } from "@/eval/engine/scenario";

/**
 * QR / Plant flow is not implemented in the current Lekha codebase.
 * These scenarios are placeholders so the framework can validate the
 * flow once it is built. They are excluded from all suites until then.
 */
export const qrPlantScenarios = [
  defineScenario({
    id: "qr-valid",
    name: "QR / Plant — valid QR",
    category: "qr-plant",
    layer: 3,
    suite: [],
    state: noState(),
    userText: "I scanned a plant QR code",
    expected: {
      requiredTools: [],
    },
    notes: "Placeholder: implement once QR/plant feature exists.",
  }),
];
