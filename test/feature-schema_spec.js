const { expect } = require('chai');
const { validateWriteAgainstSchema } = require('../nodes/lib/feature-schema');

// A typical Viessmann feature shape, abbreviated to what the validator reads.
function makeFeature() {
    return {
        feature: 'heating.circuits.0.operating.modes.active',
        commands: {
            setMode: {
                name: 'setMode',
                isExecutable: true,
                params: {
                    mode: {
                        type: 'string',
                        required: true,
                        constraints: { enum: ['dhw', 'dhwAndHeating', 'standby'] }
                    }
                }
            },
            setTargetTemperature: {
                name: 'setTargetTemperature',
                isExecutable: true,
                params: {
                    targetTemperature: {
                        type: 'number',
                        required: true,
                        constraints: { min: 10, max: 30 }
                    }
                }
            }
        }
    };
}

describe('validateWriteAgainstSchema', function() {
    it('accepts a valid command with a valid enum value', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setMode', { mode: 'dhw' });
        expect(result.valid).to.equal(true);
        expect(result.errors).to.deep.equal([]);
    });

    it('rejects unknown command', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'noSuchCommand', { mode: 'dhw' });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('not declared');
    });

    it('rejects an enum violation with the allowed values listed', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setMode', { mode: 'rocket' });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('one of: dhw, dhwAndHeating, standby');
    });

    it('rejects unknown parameter keys', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setMode', { mode: 'dhw', extra: 1 });
        expect(result.valid).to.equal(false);
        expect(result.errors.join(' ')).to.include('Unknown parameter "extra"');
    });

    it('rejects missing required parameter', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setMode', {});
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('Missing required parameter "mode"');
    });

    it('rejects wrong type', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setMode', { mode: 42 });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('must be a string');
    });

    it('rejects number below min', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setTargetTemperature', { targetTemperature: 5 });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('>= 10');
    });

    it('rejects number above max', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setTargetTemperature', { targetTemperature: 99 });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('<= 30');
    });

    it('rejects non-finite number', function() {
        const result = validateWriteAgainstSchema(makeFeature(), 'setTargetTemperature', { targetTemperature: NaN });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('finite number');
    });

    it('reports non-executable command but still surfaces other errors', function() {
        const feat = makeFeature();
        feat.commands.setMode.isExecutable = false;
        const result = validateWriteAgainstSchema(feat, 'setMode', { mode: 'dhw' });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('not executable');
    });

    it('returns invalid when there is no feature data at all', function() {
        const result = validateWriteAgainstSchema(null, 'setMode', { mode: 'dhw' });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('No feature schema');
    });

    it('returns invalid when feature has no commands at all', function() {
        const result = validateWriteAgainstSchema({ feature: 'read.only' }, 'setMode', { mode: 'dhw' });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('declares no commands');
    });
});
