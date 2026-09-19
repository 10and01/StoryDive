import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listModelProviders,
  publicProvider,
  saveModelProvider,
} from "@/lib/db/queries/custom-works";
import { encryptApiKey, maskApiKey } from "@/lib/models/crypto";
import { validateProviderBaseUrl } from "@/lib/models/provider-client";
import { errorResponse } from "@/lib/works/api";
import { normalizeMetadataText, WorkInputError } from "@/lib/works/validation";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const providers = await listModelProviders(auth.user.id);
  return Response.json({ providers: providers.map(publicProvider) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = normalizeMetadataText(body.name, 60);
    const model = normalizeMetadataText(body.model, 120);
    const apiKey = normalizeMetadataText(body.apiKey, 500);
    if (!name || !model || !apiKey) throw new WorkInputError("missing_fields", "请完整填写服务名称、模型名和 API Key。");
    const provider = await saveModelProvider({
      id: crypto.randomUUID(),
      userId: auth.user.id,
      name,
      baseUrl: validateProviderBaseUrl(normalizeMetadataText(body.baseUrl, 500)),
      encryptedApiKey: await encryptApiKey(apiKey),
      maskedApiKey: maskApiKey(apiKey),
      model,
      isDefault: body.isDefault === true,
      status: "untested",
    });
    return Response.json({ provider: publicProvider(provider) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
