# Viessmann API Features Reference

This document lists the features available through the Viessmann API. These features can be accessed using the `viessmann-read` and `viessmann-write` nodes.

**Note:** Not all features are available on all devices. Use the `viessmann-device-features` node to discover which features are available on your specific device.

## Table of Contents

- [Device Features](#device-features)
- [Gateway Features](#gateway-features)
- [Heating Features](#heating-features)
- [Feature Usage Guide](#feature-usage-guide)

---

## Device Features

All device features are prefixed with `device.*`

### Device Information and Status

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.actorSensorTest` | Status of the actor and sensor test | ✓ | ✓ (activate) |
| `device.brand` | Member ID of the device in a cascade | ✓ | |
| `device.etn` | Electronic traceability number of the system | ✓ | |
| `device.heatingCircuitId` | ID of the heating circuit to which the device is connected | ✓ | ✓ (assign/unassign) |
| `device.hmi` | Installed HMI type with the device | ✓ | |
| `device.identification` | Request for the device identification status | ✓ | |
| `device.information` | Device manufacturer and model | ✓ | |
| `device.name` | Device name set by user | ✓ | |
| `device.productIdentification` | Device identification data | ✓ | |
| `device.productMatrix` | Product matrix details | ✓ | |
| `device.serial` | Serial number of connected device | ✓ | |
| `device.serial.internalComponents` | List of built-in components in the device | ✓ | |
| `device.status` | Device status (OK or not) | ✓ | |
| `device.type` | Information if heat pump is split or mono device | ✓ | |
| `device.variant` | Further information about the device-variant | ✓ | |

### Device Commissioning

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.commissioning.information` | Commissioning information | ✓ | |
| `device.commissioning.state` | Current state of the commissioning process | ✓ | |

### Device Configuration

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.configuration.houseLocation` | Object location | ✓ | |
| `device.configuration.measurementWeight` | Sensor's relative importance weight during computation of the room's state | ✓ | ✓ |
| `device.setDefaultValues` | Reset device default values | | ✓ (command) |
| `device.timezone` | Timezone set on the device | ✓ | ✓ |

### Device External Influences

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.demand.external` | Current demand status by an external influence | ✓ | |
| `device.lock.external` | Current lock status by an external influence | ✓ | |
| `device.lock.malfunction` | Current lock status by a malfunction | ✓ | |
| `device.offPeakSignal` | Device off-peak signal state | ✓ | |
| `device.offPeakSignal.active` | Whether off-peak is active or not | ✓ | |
| `device.offPeakSignal.configuration` | Whether off-peak is used or not | ✓ | ✓ (activate/deactivate) |
| `device.pvSignal` | If photovoltaic energy is available or not | ✓ | |
| `device.pvSignal.active` | Whether photovoltaic is active or not | ✓ | |

### Device Maintenance and Diagnostics

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.maintenance` | 'Maintenance' mode state for the device | ✓ | ✓ (reset) |
| `device.remoteReset` | Remote reset the device | | ✓ (command) |

### Device Messages

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.messages.errors.counter.d6` | Number of D6 errors | ✓ | |
| `device.messages.info.raw` | Active info messages of the controller | ✓ | |
| `device.messages.logbook` | Up to five most recent logbook entries | ✓ | |
| `device.messages.service.raw` | Active service messages of the controller | ✓ | |
| `device.messages.status.raw` | Active status messages of the controller | ✓ | |

### Device Power

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.power.battery` | Battery information | ✓ | |
| `device.power.consumption.limitation` | Configuration of consumption limitation | ✓ | |
| `device.power.statusReport.consumption` | Values of consumption limitation | ✓ | |
| `device.power.statusReport.production` | Values of production limitation | ✓ | |

### Device Sensors

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.sensors.humidity` | Humidity room sensor value | ✓ | |
| `device.sensors.temperature` | Temperature room sensor value | ✓ | |

### Device Time Configuration

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.time.daylightSaving` | Daylight saving time state and validity period | ✓ | ✓ (configure) |

### Device Timeseries

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.timeseries.burner.stops` | Frequency and reason for the device burner's stops | ✓ | |
| `device.timeseries.dhw.burner.stops` | Frequency and reason for DHW burner's stops | ✓ | |
| `device.timeseries.ignitionTimeSteps` | Ignition frequency separated into statistical classes | ✓ | |
| `device.timeseries.monitoringIonization` | Ionization frequency separated into statistical classes | ✓ | |
| `device.timeseries.water.pressure.peaks` | Water pressure peak frequency separated into statistical classes | ✓ | |

### Device Third-Party Integration

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.thirdparty.manufacturer` | Third-party device manufacturer's name | ✓ | |
| `device.thirdparty.model` | Model-name of a third party device | ✓ | |
| `device.thirdparty.name` | Name of a third party device | ✓ | |
| `device.thirdparty.version.software` | Software version of a third party device | ✓ | |

### Device Zigbee

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.zigbee.active` | Whether Zigbee is active or not | ✓ | |
| `device.zigbee.lqi` | Link quality indicator of the Zigbee signal | ✓ | |
| `device.zigbee.parent.id` | EUID number of the parent device | ✓ | |
| `device.zigbee.parent.rx` | Received link quality indicator from device to its parent | ✓ | |
| `device.zigbee.parent.tx` | Transport link quality indicator from device to its parent | ✓ | |
| `device.zigbee.status` | Status of the Zigbee | ✓ | |

### Device Parameter Identification

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `device.parameterIdentification.version` | Information about parameter identification version | ✓ | |

---

## Gateway Features

All gateway features are prefixed with `gateway.*`

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `gateway.bmuconnection` | Status of the connection between the Boiler Management Unit and the Boiler | ✓ | |
| `gateway.devices` | Lists the devices connected to the gateway | ✓ | |
| `gateway.wifi` | Information related to the WiFi in the gateway | ✓ | |

---

## Heating Features

All heating features are prefixed with `heating.*`

### Heating Boiler

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.boiler.ash.level.current` | Current fill-level of the ash container | ✓ | |
| `heating.boiler.operating.phase` | Connected solid fuel boiler state | ✓ | |
| `heating.boiler.pumps.circuit` | Boiler-circuit-pump current state | ✓ | |
| `heating.boiler.pumps.circuit.power.current` | Circuit pump current power | ✓ | |
| `heating.boiler.pumps.internal` | If internal circulation pump is on for circuit | ✓ | |
| `heating.boiler.pumps.internal.current` | Current value (percent) for internal pump | ✓ | |
| `heating.boiler.pumps.internal.target` | Target value (percent) for internal pump | ✓ | |
| `heating.boiler.sensors.temperature.commonReturn` | Common return temperature and sensor status | ✓ | |
| `heating.boiler.sensors.temperature.commonSupply` | Temperature sensor at the exit of heating installation | ✓ | |
| `heating.boiler.sensors.temperature.main` | Main temperature sensor info | ✓ | |
| `heating.boiler.serial` | Serial number of connected boiler (deprecated for E3 devices) | ✓ | |
| `heating.boiler.temperature` | Value of boiler temperature | ✓ | |
| `heating.boiler.temperature.current` | Set temperature of the primary heating circuit | ✓ | |

### Heating Buffer

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.buffer.charging.level.bottom` | Buffer cylinder charging state at the bottom | ✓ | |
| `heating.buffer.charging.level.middle` | Buffer cylinder charging state in the middle | ✓ | |
| `heating.buffer.charging.level.top` | Buffer cylinder charging state at the top | ✓ | |
| `heating.buffer.charging.level.total` | Buffer cylinder charging state in total | ✓ | |
| `heating.buffer.hysteresis` | Heat medium buffer temperature info | ✓ | |
| `heating.buffer.sensors.temperature.main` | Value and status of the buffer temperature sensor | ✓ | |
| `heating.buffer.sensors.temperature.midTop` | Middle-top temperature sensor in heating water buffer | ✓ | |
| `heating.buffer.sensors.temperature.top` | Buffer cylinder top temperature sensor details | ✓ | |

### Heating Burners

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.burners` | Device enabled burners list | ✓ | |
| `heating.burners.modulation.total` | Total modulation of the burner cascade | ✓ | |

### Heating Call For Heat

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.callForHeat` | If N heating circuit is enabled | ✓ | |
| `heating.callForHeat.configuration.regulation` | Regulation modes for CallForHeat function | ✓ | |
| `heating.callForHeat.demand` | If there is demand for CallForHeat function | ✓ | |
| `heating.callForHeat.heating.curve.presets` | Heating curve available presets for Call For Heat | ✓ | |
| `heating.callForHeat.pump` | If pump for CallForHeat is active | ✓ | |
| `heating.callForHeat.sensors.temperature` | Flow temperature for Call For Heat function | ✓ | |

### Heating Cascade

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.cascade` | If connected device is part of a cascade | ✓ | |
| `heating.cascade.dhw.mode` | Electronic traceability number of the system | ✓ | |
| `heating.cascade.sensors.temperature.commonSupply` | Common flow temperature over all cascade members | ✓ | |
| `heating.cascade.temperature.commonSupply` | Common supply temperature setpoint and command over all devices | ✓ | ✓ |

### Heating Circuits

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.circuits` | Circuits information | ✓ | |

**Note:** Circuit-specific features use the pattern `heating.circuits.N.*` where N is the circuit number (0, 1, 2, etc.)

### Heating Compressors

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.compressors` | List of enabled compressors | ✓ | |

### Heating Configuration

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.configuration.buffer.temperature.max` | Maximum temperature of the hot water buffer | ✓ | ✓ |
| `heating.configuration.bufferCylinderSize` | Buffer cylinder size in liters | ✓ | |
| `heating.configuration.centralHeatingCylinderSize` | Central heating cylinder size in liters | ✓ | |
| `heating.configuration.dhw.dryContact` | If aqua stat for the DHW is configured | ✓ | |
| `heating.configuration.dhw.highDemand.threshold` | High demand threshold for tapped volume | ✓ | ✓ |
| `heating.configuration.dhw.highDemand.timeframe` | High demand timeframe for tapped volume | ✓ | ✓ |
| `heating.configuration.dhw.temperature.comfortCharging` | Target DHW temperature for comfort charging (deprecated) | ✓ | ✓ |
| `heating.configuration.dhw.temperature.dhwCylinder.max` | Maximum temperature of DHW tank | ✓ | ✓ |
| `heating.configuration.dhw.temperature.hotWaterStorage.max` | Maximum temperature of DHW tank (deprecated) | ✓ | ✓ |
| `heating.configuration.dhw.temperature.minimumComfort` | Minimum comfort temperature (deprecated) | ✓ | |
| `heating.configuration.dhwCylinderPump` | Limits of the DHW cylinder pump | ✓ | |
| `heating.configuration.dhwCylinderSize` | DHW cylinder size in liters | ✓ | |
| `heating.configuration.dhwHeater` | If electric heater inside DHW-tank is free to be used | ✓ | |
| `heating.configuration.flow.temperature.max` | Maximum flow temperature | ✓ | ✓ |
| `heating.configuration.flow.temperature.min` | Minimum flow temperature | ✓ | ✓ |
| `heating.configuration.fuel.capacity` | Max fuel tank capacity | ✓ | ✓ |
| `heating.configuration.fuel.need` | Values related to the fuel need | ✓ | |
| `heating.configuration.gasType` | Configured gas type | ✓ | |
| `heating.configuration.heatingRod.dhw` | If electric heater is free to be used for DHW | ✓ | |
| `heating.configuration.heatingRod.heating` | If electric heater is free to be used for room heating | ✓ | |
| `heating.configuration.heatingRod.nominalPower` | Nominal power of the heating rod | ✓ | |
| `heating.configuration.houseHeatingLoad` | Heating load per square meter in kWh/year | ✓ | |
| `heating.configuration.houseLocation` | Object location | ✓ | |
| `heating.configuration.houseOrientation` | Object orientation in degrees | ✓ | |
| `heating.configuration.hydraulicMatrix` | Values of hydraulic matrix | ✓ | |
| `heating.configuration.internalPumpOne` | Limits of internal pump one | ✓ | |
| `heating.configuration.internalPumps` | Limits of the pump | ✓ | |
| `heating.configuration.internalPumpTwo` | Limits of internal pump two | ✓ | |
| `heating.configuration.pressure.total` | Pressure inside the system | ✓ | |
| `heating.configuration.smartGrid.heatingRod` | SG Ready influence on heating rod | ✓ | |
| `heating.configuration.temperature.outside.DampingFactor` | Damping factor for outside temperature | ✓ | ✓ |

### Heating Controller

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.calculated.temperature.outside` | Calculated outside temperature using sensor readings and damping factor | ✓ | |
| `heating.controller.serial` | Serial number of the controller | ✓ | |

### Heating COP (Coefficient of Performance)

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.cop.cooling` | Cooling COP | ✓ | |
| `heating.cop.dhw` | DHW COP | ✓ | |
| `heating.cop.green` | Green electricity COP | ✓ | |
| `heating.cop.heating` | Heating COP | ✓ | |
| `heating.cop.total` | Total COP | ✓ | |

### Heating CO2 Saving

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.co2.saving` | Statistics of CO2 saving (deprecated) | ✓ | |
| `heating.co2.saving.raw` | Raw statistics of CO2 saving | ✓ | |

### Heating Device

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.device.chargingScheme` | Charging scheme of suction module | ✓ | |
| `heating.device.fuel.current` | Current fuel tank level | ✓ | ✓ (adjust) |
| `heating.device.fuel.minimal` | Minimal filling value for fuel tank for refill notification | ✓ | |
| `heating.device.mainECU` | Information about mainECU | ✓ | |
| `heating.device.software` | Further information about device software | ✓ | |
| `heating.device.status` | Current device status | ✓ | |
| `heating.device.time` | Set time and date | | ✓ (command) |
| `heating.device.variant` | Further information about device variant | ✓ | |

### Heating DHW (Domestic Hot Water)

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.dhw` | If DHW is activated/present in the installation | ✓ | |
| `heating.dhw.actuator` | Actuator state for DHW preparation | ✓ | |
| `heating.dhw.charging` | Charging state in DHW storage | ✓ | |
| `heating.dhw.comfort` | If heat-exchanger for DHW is kept warm all the time (deprecated) | ✓ | |
| `heating.dhw.configuration.dryContact` | If aqua stat for the DHW is configured | ✓ | |
| `heating.dhw.configuration.highDemand.threshold` | High demand threshold for tapped volume | ✓ | ✓ |
| `heating.dhw.configuration.highDemand.timeframe` | High demand timeframe for tapped volume | ✓ | ✓ |
| `heating.dhw.configuration.pumps.circulation.parallelDhwHeating` | DHW circulation pump running in parallel with DHW heating | ✓ | |
| `heating.dhw.configuration.pumps.circulation.parallelHygiene` | DHW circulation pump running in parallel with hygiene | ✓ | |
| `heating.dhw.configuration.pumps.circulation.triggerCycleDuration` | Trigger for cycle duration of DHW circulation pump | ✓ | |
| `heating.dhw.configuration.temperature.comfortCharging` | Target DHW temperature for comfort charging | ✓ | ✓ |
| `heating.dhw.configuration.temperature.dhwCylinder.max` | Maximum DHW cylinder temperature | ✓ | ✓ |
| `heating.dhw.configuration.temperature.minimumComfort` | Minimum comfort temperature for heat pump's DHW | ✓ | ✓ |
| `heating.dhw.dhwCylinder.frostprotection` | Frost protection for DHW cylinder | ✓ | |
| `heating.dhw.dryContact` | If aqua stat for DHW is active | ✓ | |
| `heating.dhw.hygiene` | Hygiene function: heats DHW to kill legionella bacteria | ✓ | ✓ |
| `heating.dhw.hygiene.trigger` | Timing for hygiene function execution | ✓ | ✓ |
| `heating.dhw.oneTimeCharge` | One-time charge state of DHW | ✓ | ✓ |
| `heating.dhw.operating.modes.active` | Active operating mode for DHW | ✓ | ✓ |
| `heating.dhw.operating.modes.balanced` | Balanced operating mode for DHW | ✓ | ✓ |
| `heating.dhw.operating.modes.comfort` | Comfort operating mode for DHW | ✓ | ✓ |
| `heating.dhw.operating.modes.eco` | Eco operating mode for DHW | ✓ | ✓ |
| `heating.dhw.operating.modes.efficient` | Efficient DHW charge operating mode | ✓ | ✓ |
| `heating.dhw.operating.modes.efficientWithMinComfort` | Efficient with minimum comfort DHW mode | ✓ | ✓ |
| `heating.dhw.operating.modes.off` | Off operating mode for DHW | ✓ | ✓ |
| `heating.dhw.pumps.circulation` | Status of DHW circulation pump | ✓ | |
| `heating.dhw.pumps.circulation.schedule` | Circulation schedule of DHW pumps | ✓ | ✓ |
| `heating.dhw.pumps.primary` | Status of DHW primary pump | ✓ | |
| `heating.dhw.pumps.secondary` | Status of DHW secondary pump (compact devices) | ✓ | |
| `heating.dhw.scaldProtection` | DHW scald protection state | ✓ | |
| `heating.dhw.schedule` | DHW schedule | ✓ | ✓ |
| `heating.dhw.sensors.dhwCylinder.rustSurveillance.anode` | Status of anode control sensor | ✓ | |
| `heating.dhw.sensors.temperature.dhwCylinder` | Hot water storage sensor info | ✓ | |
| `heating.dhw.sensors.temperature.dhwCylinder.bottom` | Hot water storage bottom sensor info | ✓ | |
| `heating.dhw.sensors.temperature.dhwCylinder.midBottom` | Hot water storage mid-bottom sensor info | ✓ | |
| `heating.dhw.sensors.temperature.dhwCylinder.middle` | Hot water storage middle sensor info | ✓ | |
| `heating.dhw.sensors.temperature.dhwCylinder.top` | Hot water storage top sensor info | ✓ | |
| `heating.dhw.sensors.temperature.hotWaterStorage` | Hot water storage sensor info (deprecated) | ✓ | |
| `heating.dhw.sensors.temperature.hotWaterStorage.bottom` | Hot water storage bottom sensor info (deprecated) | ✓ | |
| `heating.dhw.sensors.temperature.hotWaterStorage.midBottom` | Hot water storage mid-bottom sensor info (deprecated) | ✓ | |
| `heating.dhw.sensors.temperature.hotWaterStorage.middle` | Hot water storage middle sensor info (deprecated) | ✓ | |
| `heating.dhw.sensors.temperature.hotWaterStorage.top` | Hot water storage top sensor info (deprecated) | ✓ | |
| `heating.dhw.sensors.temperature.outlet` | DHW temperature sensor info | ✓ | |
| `heating.dhw.sensors.temperature.tankLoadSystem.return` | Tankload system return temperature sensor info | ✓ | |
| `heating.dhw.sensors.temperature.tankLoadSystem.supply` | Tankload system supply temperature sensor info | ✓ | |
| `heating.dhw.temperature.hygiene` | Temperature setpoint for hygiene function | ✓ | ✓ |
| `heating.dhw.temperature.hysteresis` | DHW temperature hysteresis for heat pumps | ✓ | |
| `heating.dhw.temperature.levels` | Available DHW ranges and defaults for E3 systems | ✓ | |
| `heating.dhw.temperature.main` | Desired DHW temperature | ✓ | ✓ |
| `heating.dhw.temperature.temp2` | Desired value for DHW Temp 2 temperature | ✓ | ✓ |

### Heating External Lock

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.external.lock` | If device is locked by external lock influence | ✓ | |

### Heating Flue

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.flue.sensors.o2.lambda` | Calculated oxygen value and lambda sensor status | ✓ | |
| `heating.flue.sensors.temperature.main` | Status and measured temperature of flue gas sensor | ✓ | |

### Heating Power

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.power.consumption.cooling` | Power usage statistics for cooling | ✓ | |
| `heating.power.consumption.current` | Current electrical energy consumption | ✓ | |
| `heating.power.consumption.dhw` | Power usage statistics for heating up DHW | ✓ | |
| `heating.power.consumption.heating` | Power usage statistics for heating up rooms | ✓ | |
| `heating.power.consumption.total` | Statistics of total power usage | ✓ | |
| `heating.power.production.cumulative` | Information about produced power | ✓ | |

### Heating Primary Circuit

| Feature | Description | Read | Write |
|---------|-------------|------|-------|
| `heating.primaryCircuit.configuration.preVentilation` | Time for pre-ventilation before heat pump starts | ✓ | |

---

## Feature Usage Guide

### Discovering Available Features

Always use the `viessmann-device-features` node to discover which features are available on your specific device:

```javascript
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
// Connect to viessmann-device-features node
```

The output will show:
- Available features on your device
- Whether they're readable or writable
- Available commands and their parameters
- Current values

### Reading Features

Use the `viessmann-read` node:

```javascript
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
msg.feature = "heating.dhw.sensors.temperature.dhwCylinder";
// Connect to viessmann-read node
```

### Writing Features

Use the `viessmann-write` node with a command:

```javascript
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
msg.feature = "heating.dhw.operating.modes.active";
msg.command = "setMode";
msg.params = { mode: "comfort" };
// Connect to viessmann-write node
```

### Common Commands

Different features support different commands. Common ones include:

- **`setMode`**: Change operating mode
  - Used for: DHW modes, heating circuit modes
  - Parameters: `{ mode: "value" }`
  
- **`setTemperature`**: Set temperature setpoint
  - Used for: DHW temperature, heating temperature
  - Parameters: `{ temperature: 22 }`
  
- **`activate`**: Turn a feature on
  - Used for: One-time charge, hygiene function
  - Parameters: May vary
  
- **`deactivate`**: Turn a feature off
  - Parameters: May vary
  
- **`configure`**: Configure feature settings
  - Parameters: Vary by feature

### Feature Patterns

Most features follow predictable patterns:

1. **Sensors**: `*.sensors.*` - Usually read-only
2. **Operating Modes**: `*.operating.modes.*` - Usually writable with `setMode`
3. **Temperature**: `*.temperature.*` - May be readable or writable
4. **Configuration**: `*.configuration.*` - Settings, may be writable
5. **Status**: `*.status` - Usually read-only

### Best Practices

1. **Always discover first**: Use device-features to see what's available
2. **Check constraints**: Some parameters have enum constraints or min/max values
3. **Validate before writing**: Check if a command is executable before attempting to execute it
4. **Handle errors**: Not all features are available on all devices
5. **Respect rate limits**: Don't poll too frequently

### Troubleshooting

**Feature not found:**
- Check the feature name spelling
- Use device-features to get the exact name
- Feature may not be available on your device model

**Command not executable:**
- The feature may be read-only
- Check if the command exists in the commands object
- Device may be in a state that prevents the command

**Invalid parameters:**
- Check the parameter constraints in the command definition
- Enum parameters must match exactly (case-sensitive)
- Numeric parameters must be within min/max ranges

---

## Additional Resources

- [Viessmann API Documentation Portal](https://api.viessmann-climatesolutions.com/documentation) (requires login to Viessmann Developer Portal)
- [Viessmann API Base](https://api.viessmann-climatesolutions.com/)
- [Example Flows](examples/)
- [Main README](README.md)
- [Contributing Guide](CONTRIBUTING.md)

## Notes

- This list is based on the official Viessmann API documentation
- Not all features are available on all devices
- Some features are deprecated and may be removed in future API versions
- Always check `device-features` output for your specific device
- Feature availability depends on your device model and firmware version
