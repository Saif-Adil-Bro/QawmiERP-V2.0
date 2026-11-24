import { createHash } from 'node:crypto';

// Byte adapter for Supabase Lite's Storage API. Bytes never leave this process;
// bucket/object metadata and private reads still go through the real handlers.
export function snapshotStorage() {
  const bytes = new Map();
  return {
    driver: bytes, fault: null,
    async uploadObject(bucket, path, version, stream, mimetype, cacheControl) {
      if (this.fault === 'write') throw Error('Storage write unavailable');
      const body=Buffer.from(await new Response(stream).arrayBuffer());
      const metadata={size:body.length,contentLength:body.length,cacheControl,mimetype,lastModified:new Date(),eTag:createHash('sha256').update(body).digest('hex')};
      bytes.set(JSON.stringify([bucket,path]),{metadata,body});return metadata;
    },
    async getObject(bucket,path,version) {
      const saved=bytes.get(JSON.stringify([bucket,path]));
      if(!saved) throw Error('Snapshot not found');
      return {...saved,httpStatusCode:200,body:new Blob([this.fault==='readback'?'incomplete':saved.body])};
    },
    async headObject(...key) {return (await this.getObject(...key)).metadata},
    async deleteObject(bucket,path,version) {bytes.delete(JSON.stringify([bucket,path]))},
  };
}
