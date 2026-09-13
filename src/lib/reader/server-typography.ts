import { cookies } from "next/headers";
import {
  READER_TYPOGRAPHY_DEFAULTS,
  TYPOGRAPHY_STORAGE_KEY,
  sanitizeReaderTypography,
  type ReaderTypography,
} from "@/lib/reader/typography";

/** SSR 首帧排版：读 cookie（客户端双写），无 cookie 或数据损坏时回退默认值。 */
export async function getServerReaderTypography(): Promise<ReaderTypography> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TYPOGRAPHY_STORAGE_KEY)?.value;
  if (!raw) return { ...READER_TYPOGRAPHY_DEFAULTS };
  try {
    return sanitizeReaderTypography(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return { ...READER_TYPOGRAPHY_DEFAULTS };
  }
}
