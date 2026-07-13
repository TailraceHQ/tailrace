import { CtaBand } from "@/components/home/cta-band";
import { HomeHero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { InProcess } from "@/components/home/in-process";
import { Integrations } from "@/components/home/integrations";
import { PlaygroundCta } from "@/components/home/playground-cta";

export default function HomePage() {
  return (
    <div className="home flex flex-1 flex-col">
      <HomeHero />
      <HowItWorks />
      <InProcess />
      <Integrations />
      <PlaygroundCta />
      <CtaBand />
    </div>
  );
}
