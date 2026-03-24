import type { CausalJsonDocument } from "@/lib/causal-json";

export const SAMPLE_CAUSAL_DOCUMENT: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "示範：天氣與出行",
  nodes: [
    { id: "rain", label: "降雨", x: 80, y: 120 },
    { id: "road", label: "路面溼滑", x: 360, y: 80 },
    { id: "traffic", label: "車流速度", x: 360, y: 220 },
    { id: "mood", label: "通勤壓力", x: 640, y: 150 },
  ],
  edges: [
    {
      id: "e-rain-road",
      source: "rain",
      target: "road",
      direction: "one-way",
      polarity: "positive",
    },
    {
      id: "e-road-traffic",
      source: "road",
      target: "traffic",
      direction: "one-way",
      polarity: "negative",
    },
    {
      id: "e-traffic-mood",
      source: "traffic",
      target: "mood",
      direction: "bidirectional",
      polarity: "negative",
    },
  ],
};
