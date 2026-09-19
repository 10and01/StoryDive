import { Suspense } from "react";
import { WorkDetailPage } from "@/components/works/work-detail-page";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><WorkDetailPage params={params} /></Suspense>;
}
