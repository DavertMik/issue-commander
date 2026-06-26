import { TotalCommander } from "@/components/total-commander";

export default function Home() {
  return <TotalCommander org={process.env.GITHUB_ORG ?? null} />;
}
