import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  deleteModelProvider,
  getModelProvider,
  publicProvider,
  updateModelProvider,
} from "@/lib/db/queries/custom-works";
import { encryptApiKey, maskApiKey } from "@/lib/models/crypto";
import { validateProviderBaseUrl } from "@/lib/models/provider-client";
import { errorResponse } from "@/lib/works/api";
import { normalizeMetadataText } from "@/lib/works/validation";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getModelProvider(id, auth.user.id);
    if (!current) return Response.json({ error: "not_found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const updates: Parameters<typeof updateModelProvider>[2] = {};
    if (body.name !== undefined) updates.name = normalizeMetadataText(body.name, 60);
    if (body.model !== undefined) updates.model = normalizeMetadataText(body.model, 120);
    if (body.baseUrl !== undefined) updates.baseUrl = validateProviderBaseUrl(normalizeMetadataText(body.baseUrl, 500));
    if (body.apiKey !== undefined) {
      const apiKey = normalizeMetadataText(body.apiKey, 500);
      if (apiKey) {
        updates.encryptedApiKey = await encryptApiKey(apiKey);
        updates.maskedApiKey = maskApiKey(apiKey);
      }
    }
    if (body.isDefault !== undefined) updates.isDefault = body.isDefault === true;
    updates.status = "untested";
    const provider = await updateModelProvider(id, auth.user.id, updates);
    return Response.json({ provider: publicProvider(provider!) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const deleted = await deleteModelProvider(id, auth.user.id);
  if (!deleted) {
    return Response.json(
      { error: "provider_in_use", message: "该模型仍被作品使用，请先切换作品模型后再删除。" },
      { status: 409 },
    );
  }
  return new Response(null, { status: 204 });
}
