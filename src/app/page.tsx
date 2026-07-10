import { getLatestDigest } from "@/lib/getDigest";
import { HomeClient } from "./components/HomeClient";

export default function Home() {
  const digest = getLatestDigest();
  return <HomeClient digest={digest} />;
}
