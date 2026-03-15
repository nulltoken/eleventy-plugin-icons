import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'

const bento = new BentoCache({
  default: 'myCache',
  stores: {
    // A first cache store named "myCache" using 
    // only L1 in-memory cache
    myCache: bentostore()
      .useL1Layer(memoryDriver({ maxSize: '100mb' }))
}}
)

const _cache: Record<string, string> = {};

const get = (key: string): string | undefined => {
	return _cache[key];
};

const set = (key: string, value: string): void => {
 };

export const cache = { get, set, bento };
