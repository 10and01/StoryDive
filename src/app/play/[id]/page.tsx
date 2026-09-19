import { Suspense } from "react";
import { CustomPlayer } from "@/components/works/custom-player";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><CustomPlayer params={params} /></Suspense>;
}
