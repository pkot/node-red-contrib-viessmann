const { expect } = require('chai');
const nock = require('nock');
const { ViessmannClient } = require('../nodes/lib/client');

const BASE_URL = 'https://example.test';

function makeFakeConfig({ token = 'token-1', onRefresh } = {}) {
    return {
        _token: token,
        getValidToken: async function() { return this._token; },
        refreshAccessToken: async function() {
            if (onRefresh) {
                await onRefresh(this);
            }
        }
    };
}

describe('ViessmannClient', function() {
    afterEach(function() {
        nock.cleanAll();
    });

    it('exposes get and post', function() {
        const c = new ViessmannClient(makeFakeConfig());
        expect(c.get).to.be.a('function');
        expect(c.post).to.be.a('function');
    });

    it('attaches Bearer token and uses the configured baseURL', async function() {
        nock(BASE_URL)
            .get('/path')
            .matchHeader('Authorization', 'Bearer my-token')
            .reply(200, { ok: true });

        const client = new ViessmannClient(makeFakeConfig({ token: 'my-token' }), { baseURL: BASE_URL });
        const response = await client.get('/path');

        expect(response.data).to.deep.equal({ ok: true });
    });

    it('refreshes token and retries on 401', async function() {
        let refreshes = 0;
        const config = makeFakeConfig({
            token: 'expired',
            onRefresh(self) { refreshes += 1; self._token = 'fresh'; }
        });

        nock(BASE_URL)
            .get('/path').matchHeader('Authorization', 'Bearer expired').reply(401, { message: 'expired' })
            .get('/path').matchHeader('Authorization', 'Bearer fresh').reply(200, { ok: true });

        const client = new ViessmannClient(config, { baseURL: BASE_URL });
        const response = await client.get('/path');

        expect(refreshes).to.equal(1);
        expect(response.data).to.deep.equal({ ok: true });
    });

    it('retries on 429 honoring Retry-After', async function() {
        let onRetryCalls = 0;

        nock(BASE_URL)
            .get('/p').reply(429, '', { 'Retry-After': '0' })
            .get('/p').reply(200, { ok: 1 });

        const client = new ViessmannClient(makeFakeConfig(), { baseURL: BASE_URL });
        const response = await client.get('/p', {
            onRetryWait: () => { onRetryCalls += 1; }
        });

        expect(response.data).to.deep.equal({ ok: 1 });
        expect(onRetryCalls).to.equal(1);
    });

    it('caps retries at the configured maxRetries', async function() {
        nock(BASE_URL)
            .get('/p').reply(429, '', { 'Retry-After': '0' })
            .get('/p').reply(429, '', { 'Retry-After': '0' });

        const client = new ViessmannClient(makeFakeConfig(), {
            baseURL: BASE_URL,
            maxRetries: 1
        });

        try {
            await client.get('/p', { onRetryWait: () => {} });
            throw new Error('expected throw');
        } catch (err) {
            expect(err.response.status).to.equal(429);
        }
    });

    it('does not retry non-retryable statuses', async function() {
        nock(BASE_URL)
            .get('/p').reply(404);

        const client = new ViessmannClient(makeFakeConfig(), { baseURL: BASE_URL });

        try {
            await client.get('/p');
            throw new Error('expected throw');
        } catch (err) {
            expect(err.response.status).to.equal(404);
        }
    });

    it('does not retry the same request twice on 401 if refresh succeeded but server still rejects', async function() {
        let refreshes = 0;
        const config = makeFakeConfig({
            token: 'tok',
            onRefresh(self) { refreshes += 1; self._token = 'tok2'; }
        });

        nock(BASE_URL)
            .get('/p').reply(401)
            .get('/p').reply(401);

        const client = new ViessmannClient(config, { baseURL: BASE_URL });

        try {
            await client.get('/p');
            throw new Error('expected throw');
        } catch (err) {
            expect(err.response.status).to.equal(401);
            // We refresh exactly once; the second 401 propagates as the original error.
            expect(refreshes).to.equal(1);
        }
    });

    describe('caching', function() {
        it('serves a second identical GET from cache within TTL', async function() {
            // Only one nock interceptor - the second .get must hit the cache or fail.
            nock(BASE_URL).get('/p').reply(200, { v: 1 });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 10000
            });

            const first = await client.get('/p');
            const second = await client.get('/p');

            expect(first.data).to.deep.equal({ v: 1 });
            expect(second.data).to.deep.equal({ v: 1 });
            expect(second).to.equal(first); // same reference => cached
        });

        it('honors options.cache: false to bypass cache', async function() {
            nock(BASE_URL)
                .get('/p').reply(200, { v: 1 })
                .get('/p').reply(200, { v: 2 });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 10000
            });

            const first = await client.get('/p');
            const second = await client.get('/p', { cache: false });

            expect(first.data).to.deep.equal({ v: 1 });
            expect(second.data).to.deep.equal({ v: 2 });
        });

        it('does not cache when cacheTTL is 0', async function() {
            nock(BASE_URL)
                .get('/p').reply(200, { v: 1 })
                .get('/p').reply(200, { v: 2 });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 0
            });

            const first = await client.get('/p');
            const second = await client.get('/p');

            expect(first.data).to.deep.equal({ v: 1 });
            expect(second.data).to.deep.equal({ v: 2 });
        });

        it('clears the cache on POST', async function() {
            nock(BASE_URL)
                .get('/p').reply(200, { v: 1 })
                .post('/q').reply(200, { ok: true })
                .get('/p').reply(200, { v: 2 });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 10000
            });

            const first = await client.get('/p');
            await client.post('/q', {});
            const third = await client.get('/p');

            expect(first.data).to.deep.equal({ v: 1 });
            expect(third.data).to.deep.equal({ v: 2 });
        });

        it('invalidateCache() drops cached responses', async function() {
            nock(BASE_URL)
                .get('/p').reply(200, { v: 1 })
                .get('/p').reply(200, { v: 2 });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 10000
            });

            await client.get('/p');
            client.invalidateCache();
            const second = await client.get('/p');

            expect(second.data).to.deep.equal({ v: 2 });
        });
    });

    describe('in-flight de-duplication', function() {
        it('coalesces concurrent identical GETs into a single upstream request', async function() {
            nock(BASE_URL).get('/p').reply(200, { v: 1 });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 0 // prove it's the in-flight dedup, not the cache
            });

            const [r1, r2, r3] = await Promise.all([
                client.get('/p'),
                client.get('/p'),
                client.get('/p')
            ]);

            expect(r1.data).to.deep.equal({ v: 1 });
            // All three callers should have received the same response object.
            expect(r2).to.equal(r1);
            expect(r3).to.equal(r1);
        });

        it('clears in-flight entry on failure so retries do not get stuck', async function() {
            nock(BASE_URL)
                .get('/p').reply(404)
                .get('/p').reply(200, { v: 'recovered' });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 0
            });

            try {
                await client.get('/p');
                throw new Error('expected throw');
            } catch (err) {
                expect(err.response.status).to.equal(404);
            }

            // A subsequent caller should see a fresh request, not the failed promise.
            const recovered = await client.get('/p');
            expect(recovered.data).to.deep.equal({ v: 'recovered' });
        });
    });

    describe('constructor validation', function() {
        it('rejects maxConcurrent < 1 (would deadlock the queue)', function() {
            expect(() => new ViessmannClient(makeFakeConfig(), { maxConcurrent: 0 })).to.throw(RangeError);
            expect(() => new ViessmannClient(makeFakeConfig(), { maxConcurrent: -1 })).to.throw(RangeError);
        });

        it('rejects non-numeric maxConcurrent', function() {
            expect(() => new ViessmannClient(makeFakeConfig(), { maxConcurrent: NaN })).to.throw(RangeError);
        });

        it('floors fractional maxConcurrent to an integer', function() {
            const c = new ViessmannClient(makeFakeConfig(), { maxConcurrent: 2.7 });
            expect(c._maxConcurrent).to.equal(2);
        });
    });

    describe('cache hygiene', function() {
        it('drops expired cache entries lazily on subsequent get', async function() {
            nock(BASE_URL)
                .get('/p').reply(200, { v: 1 })
                .get('/p').reply(200, { v: 2 });

            // 1 ms TTL - any later get sees expiry.
            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 1
            });

            await client.get('/p');
            // Wait past the 1ms TTL.
            await new Promise(r => setTimeout(r, 10));
            const second = await client.get('/p');

            expect(second.data).to.deep.equal({ v: 2 });
            // After lazy expiry + re-fetch, exactly one entry should be in the cache.
            expect(client._cache.size).to.equal(1);
        });

        it('skips cache write when an invalidation happens during the in-flight request (epoch race)', async function() {
            // Slow first GET; while it's in flight we POST to invalidate.
            // When the GET resolves, it must NOT write to the cache.
            nock(BASE_URL)
                .get('/p').delay(50).reply(200, { v: 'stale-after-write' })
                .post('/q').reply(200, { ok: true })
                .get('/p').reply(200, { v: 'fresh' });

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 10000
            });

            const getPromise = client.get('/p');
            // Let the GET start, then race in a POST.
            await new Promise(r => setTimeout(r, 10));
            await client.post('/q', {});
            await getPromise;

            // The next GET must hit the network, not the (would-be) cached value.
            const fresh = await client.get('/p');
            expect(fresh.data).to.deep.equal({ v: 'fresh' });
        });
    });

    describe('concurrency throttle', function() {
        it('caps concurrent upstream requests at maxConcurrent', async function() {
            // Bound is 2; we fire 5 different URLs and observe via nock delays
            // that no more than 2 are in flight at once.
            let active = 0;
            let maxObserved = 0;
            const replyFn = function(uri, body, cb) {
                active += 1;
                maxObserved = Math.max(maxObserved, active);
                setTimeout(() => {
                    active -= 1;
                    cb(null, [200, { ok: true }]);
                }, 30);
            };
            nock(BASE_URL)
                .get('/a').reply(replyFn)
                .get('/b').reply(replyFn)
                .get('/c').reply(replyFn)
                .get('/d').reply(replyFn)
                .get('/e').reply(replyFn);

            const client = new ViessmannClient(makeFakeConfig(), {
                baseURL: BASE_URL,
                cacheTTL: 0,
                maxConcurrent: 2
            });

            await Promise.all(['/a', '/b', '/c', '/d', '/e'].map(u => client.get(u)));
            expect(maxObserved).to.be.lessThanOrEqual(2);
        });
    });
});
