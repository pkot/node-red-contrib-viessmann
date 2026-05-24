const { expect } = require('chai');
const { formatFeatureStatus, STATUS_PROPERTY_NAMES } = require('../nodes/lib/format');

describe('formatFeatureStatus', function() {
    // Table-driven cases. Each row is one observation of feature.properties
    // and the expected formatFeatureStatus(...) return. This replaces the
    // nine ~60-line integration tests in viessmann-read_spec.js that all
    // exercised the same pure shaping behavior via the Node-RED helper.
    const cases = [
        {
            name: 'value + unit',
            properties: { value: { type: 'number', value: 21.5, unit: 'celsius' } },
            expected: '21.5celsius'
        },
        {
            name: 'value only when unit is missing',
            properties: { value: { type: 'number', value: 42 } },
            expected: '42'
        },
        {
            name: 'status property with unit',
            properties: { status: { type: 'string', value: 'on', unit: '' } },
            // empty-string unit is falsy, so unit is dropped (consistent with prior behavior)
            expected: 'on'
        },
        {
            name: 'temperature property',
            properties: { temperature: { value: 18.2, unit: 'celsius' } },
            expected: '18.2celsius'
        },
        {
            name: 'strength property (no unit)',
            properties: { strength: { value: -75 } },
            expected: '-75'
        },
        {
            name: 'active boolean',
            properties: { active: { value: true } },
            expected: 'true'
        },
        {
            name: 'hours with unit',
            properties: { hours: { value: 1234, unit: 'h' } },
            expected: '1234h'
        },
        {
            name: 'starts (counter)',
            properties: { starts: { value: 56 } },
            expected: '56'
        },
        {
            name: 'multiple properties join with / in declared order',
            properties: {
                value: { value: 21.5, unit: 'celsius' },
                active: { value: true }
            },
            expected: '21.5celsius/true'
        },
        {
            name: 'unknown property ignored',
            properties: { rawSensor: { value: 999 } },
            expected: null
        },
        {
            name: 'null value skipped',
            properties: { value: { value: null } },
            expected: null
        },
        {
            name: 'undefined value skipped',
            properties: { value: { value: undefined } },
            expected: null
        },
        {
            name: 'missing slot skipped (declared but absent)',
            properties: { value: undefined, temperature: { value: 12 } },
            expected: '12'
        }
    ];

    for (const c of cases) {
        it(`returns ${JSON.stringify(c.expected)} for ${c.name}`, function() {
            expect(formatFeatureStatus(c.properties)).to.equal(c.expected);
        });
    }

    it('returns null for null/undefined properties', function() {
        expect(formatFeatureStatus(null)).to.equal(null);
        expect(formatFeatureStatus(undefined)).to.equal(null);
    });

    it('returns null for non-object properties', function() {
        expect(formatFeatureStatus('not-an-object')).to.equal(null);
        expect(formatFeatureStatus(42)).to.equal(null);
    });

    it('exposes the property order via STATUS_PROPERTY_NAMES', function() {
        expect(STATUS_PROPERTY_NAMES).to.deep.equal([
            'value', 'status', 'temperature', 'strength', 'active', 'hours', 'starts'
        ]);
    });
});
