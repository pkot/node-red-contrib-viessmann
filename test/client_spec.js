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
});
