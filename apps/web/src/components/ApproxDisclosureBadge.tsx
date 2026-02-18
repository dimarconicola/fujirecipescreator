import { Badge } from "@mantine/core";

export function ApproxDisclosureBadge() {
  return (
    <Badge
      variant="gradient"
      gradient={{ from: "cyan.6", to: "indigo.6", deg: 40 }}
      size="md"
      tt="uppercase"
      title="Approximate visualizer for learning. Output is not camera-accurate JPEG simulation."
      aria-label="Approximate visualizer disclosure"
    >
      Approx
    </Badge>
  );
}
