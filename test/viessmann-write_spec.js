const helper = require('node-red-node-test-helper');
const writeNode = require('../nodes/viessmann-write.js');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('viessmann-write Node', function() {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
        nock.cleanAll();
    });

    it('should be loaded', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        helper.load([configNode, writeNode], flow, function() {
            const n1 = helper.getNode('n1');
            expect(n1).to.have.property('name', 'test write');
            done();
        });
    });

    it('should write a value to a feature command', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock command execution endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .post('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active/commands/setMode')
            .reply(200, {});

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.have.property('success', true);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should write a value using datapoint alias', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock command execution endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .post('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active/commands/setMode')
            .reply(200, {});

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.have.property('success', true);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                datapoint: 'heating.circuits.0.operating.modes.active',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should handle missing installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should handle missing gatewaySerial', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should handle missing deviceId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225',
                feature: 'heating.circuits.0.operating.modes.active',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should handle missing feature', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225',
                deviceId: '0',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should handle missing command', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225',
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should handle missing params', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225',
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active',
                command: 'setMode'
            });
        });
    });

    it('should handle invalid installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            const invalidInputs = [
                { installationId: 'invalid', gatewaySerial: '7571381573112225', deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: '123abc', gatewaySerial: '7571381573112225', deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: -1, gatewaySerial: '7571381573112225', deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 0, gatewaySerial: '7571381573112225', deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 1.5, gatewaySerial: '7571381573112225', deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } }
            ];
            
            let errorCount = 0;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === invalidInputs.length) {
                    done();
                }
            });

            invalidInputs.forEach(input => n1.receive(input));
        });
    });

    it('should handle invalid gatewaySerial', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            const invalidInputs = [
                { installationId: 123456, gatewaySerial: 12345, deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 123456, gatewaySerial: '', deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 123456, gatewaySerial: '   ', deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 123456, gatewaySerial: null, deviceId: '0', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } }
            ];
            
            let errorCount = 0;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === invalidInputs.length) {
                    done();
                }
            });

            invalidInputs.forEach(input => n1.receive(input));
        });
    });

    it('should handle invalid deviceId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            const invalidInputs = [
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: 12345, feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '   ', feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } },
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: null, feature: 'heating.circuits.0.operating.modes.active', command: 'setMode', params: { mode: 'dhw' } }
            ];
            
            let errorCount = 0;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === invalidInputs.length) {
                    done();
                }
            });

            invalidInputs.forEach(input => n1.receive(input));
        });
    });

    it('should handle API errors gracefully', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock API error
        nock('https://api.viessmann-climatesolutions.com')
            .post('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active/commands/setMode')
            .reply(404, {
                error: 'Command not found'
            });

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should handle missing config node', function(done) {
        const flow = [
            { id: 'n1', type: 'viessmann-write', name: 'test write' }
        ];

        helper.load([writeNode], flow, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active',
                command: 'setMode',
                params: { mode: 'dhw' }
            });
        });
    });

    it('should update status based on config auth state', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const c1 = helper.getNode('c1');
            
            expect(n1).to.have.property('updateStatus');
            expect(typeof n1.updateStatus).to.equal('function');
            
            // Should be authenticated with token
            expect(c1.authState).to.equal('authenticated');
            done();
        });
    });

    it('should show error status when auth fails', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-write', name: 'test write', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: '',
                refreshToken: ''
            }
        };

        helper.load([configNode, writeNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const c1 = helper.getNode('c1');
            
            expect(n1).to.have.property('updateStatus');
            expect(typeof n1.updateStatus).to.equal('function');
            
            // Should be disconnected without token
            expect(c1.authState).to.equal('disconnected');
            done();
        });
    });
});
