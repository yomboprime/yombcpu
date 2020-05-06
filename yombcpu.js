/*

The MIT License

Copyright © 2020 Juan Jose Luna Espinosa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

-----

This is yombcpu firmware, to monitor CPU and memory usage and provide user buttons.

This is the host program that reads CPU and memory usage and sends them to the Arduino

The first Arduino user button toggles on/off the host monitor (and the Arduino display)

*/

// Configuration parameters

// Addon serial port name or device
var serialPortDevice = "/dev/ttyUSB0";
var baudRate = 115200;


// Requires

var os = require( 'os' );
var SerialPort = require( 'serialport' );
//var fs = require( 'fs' );
//var pathJoin = require( 'path' ).join;

var spawn = require( 'child_process' ).spawn;

// Global variables

var isAppEnding = false;
var cpuUsage = null;
var serialPort = null;
var serialWriteBuffer = [ ];

var prevButtons = 0;

var monitorIsOn = true;
var monitorForcedOn = false;
var monitorForcedOff = false;


// Main code

init();


// Functions

function init() {

	process.title = "yombcpu";

	// Termination signal
	process.on( "SIGINT", function() {

		console.error( " SIGINT Signal Received, shutting down." );

		terminate();

	} );

	connectSerial();

	monitorTask();


}

function connectSerial( onSerialConnected ) {

	serialPort = new SerialPort( serialPortDevice, { baudRate: baudRate }, ( err ) => {

		if ( err ) {

			console.error( "Error opening port " + serialPortDevice + ". Couldn't find the port or it was already in use, or insufficient privileges." );
			serialPort = null;
			terminate();

		}

		var parser = serialPort.pipe( new SerialPort.parsers.ByteLength( { length: 1 } ) );

		parser.on( 'data', function ( msg ) {

			if ( isAppEnding ) {

				return;

			}

			var buttons = msg[ 0 ];

			processButtons( buttons );

			// Get CPUs usage
			cpuUsage = getCoresUsage( cpuUsage );

			// Get memory usage
			var memUsage = 1 - ( os.freemem() / os.totalmem() );

			var numProcs = cpuUsage.length;

			numProcs = Math.min( 31, numProcs );

			// + 1 for the initial bytecount byte
			// + 1 for the memory usage bar at the end
			var numBytes = 1 + numProcs + 1 /*+ 4*/;

			if ( numBytes !== serialWriteBuffer.length ) {

				serialWriteBuffer = [];

				for ( var i = 0; i < numBytes; i ++ ) serialWriteBuffer[ i ] = 0;

			}

			// + 128: Start frame flag
			// + 1 for the memory usage bar at the end
			serialWriteBuffer[ 0 ] = 128 + numProcs + 1;

			for ( var i = 0; i < numProcs; i++ ) {

				var u = cpuUsage[ i ];

				serialWriteBuffer[ i + 1 ] = u.currentValid ? Math.floor( u.currentValue * 127 ) : 0;

			}
			/*
			serialWriteBuffer[ 4 ] = 30;
			serialWriteBuffer[ 5 ] = 40;
			serialWriteBuffer[ 6 ] = 50;
			serialWriteBuffer[ 7 ] = 60;
			*/

			// Fill in the memory usage
			serialWriteBuffer[ numBytes - 1 ] = memUsage * 127;

			serialPort.write( serialWriteBuffer );

		} );

		console.log( "Serial port opened at: " + serialPortDevice );

		if ( onSerialConnected ) {

			onSerialConnected();

		}

	} );

	serialPort.on( 'close', ( err ) => {

		serialPort = null;

		if ( err && err.disconnected === true ) {

			console.error( "Serial port abnormally closed at: " + serialPortDevice + " ." );

			terminate();

		}

	} );

}

function monitorTask() {

	var sleepTime = 500;

	if ( ! monitorIsOn ) {

		// Turn off monitor. It will turn on again by itself in a second or so.
		if ( ! monitorForcedOff ) {

			spawn( "xset", [ "dpms", "force", "off" ] );
			monitorForcedOff = true;

		}

	}
	else {

		if ( ! monitorForcedOn ) {

			spawn( "xset", [ "dpms", "force", "on" ] );
			monitorForcedOn = true;

		}

	}

	if ( monitorForcedOff ) {

		monitorForcedOff = false;

	}
	if ( monitorForcedOn ) {

		monitorForcedOn = false;

	}

	if ( ! isAppEnding ) {

		setTimeout( monitorTask, sleepTime );

	}

}

function disconnectSerial( onClosed ) {

	if ( serialPort ) {

		serialPort.drain( () => {

			serialPort.close( function () {

				serialPort = null;

				if ( onClosed ) {

					onClosed();

				}

			} );

		} );

	}
	else {

		if ( onClosed ) {

			onClosed();

		}

	}

}

function terminate() {

	isAppEnding = true;

	disconnectSerial( function() {

		process.exit( 0 );

	} );

}

function getCoresUsage( arr ) {

	var cpus = os.cpus();

	var numProcs = cpus.length;

	if ( ( ! arr ) || arr.length !== numProcs ) {

		arr = [];

		for ( var i = 0; i < numProcs; i ++ ) {

			arr[ i ] = {
				inited: false,
				currentValid: false,
				currentValue: 0,
				previousIdle: 0,
				previousSum: 0
			}

		}

	}

	for ( var i = 0; i < numProcs; i ++ ) {

		var cpu = cpus[ i ];

		var timeSum = 0;
		for ( j in cpu.times ) {

			timeSum += cpu.times[ j ];

		}

		var usageI = arr[ i ];

		var prevIdle = usageI.previousIdle;
		usageI.previousIdle = cpu.times.idle;
		var prevSum = usageI.previousSum;
		usageI.previousSum = timeSum;

		if ( usageI.inited ) {

			usageI.currentValue = 1 - ( usageI.previousIdle - prevIdle ) / ( usageI.previousSum - prevSum );
			usageI.currentValid = true;

		}
		else {

			usageI.inited = true;

		}

	}

	return arr;
}

function processButtons( buttons ) {

	var pressedButtons = ( ( ~ prevButtons ) & buttons );
	var depressedButtons = ( prevButtons & ( ~ buttons ) );

	if ( pressedButtons & 1 ) {

		console.log( "Monitor turn ON" );
		monitorIsOn = true;

	}
	else if ( depressedButtons & 1 ) {

		console.log( "Monitor turn OFF" );
		monitorIsOn = false;

	}

	prevButtons = buttons;

}
