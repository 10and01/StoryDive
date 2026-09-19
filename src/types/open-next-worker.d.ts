declare module "../../.open-next/worker.js" {
  const worker: ExportedHandler<CloudflareEnv>;
  export default worker;
  export const DOQueueHandler: DurableObjectClass;
  export const DOShardedTagCache: DurableObjectClass;
  export const BucketCachePurge: DurableObjectClass;
}

declare module "../../.open-next/cloudflare/init.js" {
  export function runWithCloudflareRequestContext<T>(
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext,
    handler: () => Promise<T>,
  ): Promise<T>;
}
