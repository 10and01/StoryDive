import { type NextRequest } from "next/server";
import { listPublicWorks } from "@/lib/db/queries/custom-works";
import { workDto } from "@/lib/works/api";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.slice(0, 100) || undefined;
  const tag = request.nextUrl.searchParams.get("tag")?.slice(0, 30) || undefined;
  const sort = request.nextUrl.searchParams.get("sort") === "popular" ? "popular" : "latest";
  const works = await listPublicWorks({ query, tag, sort });
  return Response.json({ works: works.map((work) => workDto(work)) });
}
