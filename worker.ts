// Custom OpenNext entry: preserve the generated Next fetch handler and add
// the Cloudflare Queue consumer used by resumable story generation jobs.
import openNextWorker from "./.open-next/worker.js";
import { runWithCloudflareRequestContext } from "./.open-next/cloudflare/init.js";
import { processGenerationJob } from "./src/lib/works/generation";
import type { QueueGenerationMessage } from "./src/lib/works/types";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const worker = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return openNextWorker.fetch(request, env, ctx);
  },
  async queue(
    batch: MessageBatch<QueueGenerationMessage>,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    const contextRequest = new Request("https://queue.internal/story-generation");
    await runWithCloudflareRequestContext(contextRequest, env, ctx, async () => {
      for (const message of batch.messages) {
        try {
          await processGenerationJob(message.body);
          message.ack();
        } catch {
          message.retry({ delaySeconds: Math.min(300, 15 * Math.max(message.attempts, 1)) });
        }
      }
    });
  },
};

export default worker;
