
// Configuration parameters

// Addon serial port name or device
var serialPortDevice = "/dev/ttyUSB0";
var baudRate = 115200;


// Requires

var os = require( 'os' );
var SerialPort = require( 'serialport' );
//var fs = require( 'fs' );
//var pathJoin = require( 'path' ).join;


// Global variables

var isAppEnding = false;
var cpuUsage = null;
var serialPort = null;
var serialWriteBuffer = [ ];

// Main code

init();


// Functions

function init() {
	
	// Termination signal
	process.on( "SIGINT", function() {

		console.error( " SIGINT Signal Received, shutting down." );
		
		terminate();

	} );

	connectSerial();

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

			var status = msg[ 0 ];

			// Get CPUs usage
			cpuUsage = getCoresUsage( cpuUsage );
			
			// Get memory usage
			var memUsage = 1 - ( os.freemem() / os.totalmem() );
		
			var numProcs = cpuUsage.length;

			numProcs = Math.min( 31, numProcs );
			
			// + 1 for the initial bytecount byte
			// + 1 for the memory usage bar at the end
			var numBytes = 1 + numProcs + 1;

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
