import { TotalCommander } from "@/components/total-commander";
import { resolveOrg } from "@/lib/github/org";
import { envDefaults } from "@/lib/config";

export default function Home() {
  return <TotalCommander org={resolveOrg()} defaults={envDefaults()} />;
}
