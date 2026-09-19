import { Suspense } from "react";
import { CreateWizard } from "@/components/works/create-wizard";

export default function Page() {
  return <Suspense><CreateWizard /></Suspense>;
}
