import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getModelProvider,
  publicProvider,
  updateModelProvider,
} from "@/lib/db/queries/custom-works";
import { testProviderConnection } from "@/lib/models/provider-client";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const provider = await getModelProvider(id, auth.user.id);
  if (!provider) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    await testProviderConnection(provider);
    const updated = await updateModelProvider(id, auth.user.id, { status: "active", lastTestedAt: new Date() });
    return Response.json({ ok: true, provider: publicProvider(updated!) });
  } catch {
    const updated = await updateModelProvider(id, auth.user.id, { status: "failed", lastTestedAt: new Date() });
    return Response.json(
      { ok: false, error: "connection_failed", message: "连接失败，请检查 Base URL、模型名和 API Key。", provider: publicProvider(updated!) },
      { status: 422 },
    );
  }
}
