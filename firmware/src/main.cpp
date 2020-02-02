

// Includes

#include <Arduino.h>

#include <U8g2lib.h>

#include <Wire.h>


// Global variables

// Set 32 or 64 pixels screen height
#define SCREEN_Y 32

// Call here the proper constructor for your screen. Please see U8g2lib examples and documentation.
U8G2_SSD1306_128X32_UNIVISION_1_HW_I2C oled( U8G2_R0, U8X8_PIN_NONE);

#define MAX_CPUS SCREEN_Y
byte numCPU = 0;
byte cpuValues[ MAX_CPUS ];

byte screenBuffer[ 512 ];

// Function prototypes

void printCPUBars();
bool serialProtocol();
void draw();

//

void setup() {

	oled.begin();

	Serial.begin( 115200 );
	delay( 500 );

	cpuValues[ 0 ] = 0;
	cpuValues[ 1 ] = 0;
	cpuValues[ 2 ] = 0;
	cpuValues[ 3 ] = 0;

	printCPUBars();

	
}

void loop() {

	
	delay( 250 );
	
	if ( ! serialProtocol() ) {
		
		cpuValues[ 0 ] = 0;
		cpuValues[ 1 ] = 0;
		cpuValues[ 2 ] = 0;
		cpuValues[ 3 ] = 0;
		
		printCPUBars();
		
		delay( 500 );
		while ( Serial.available() ) Serial.read();
		
	}
	
	printCPUBars();

}

void printCPUBars() {
	
	oled.firstPage();  
	do {
	
		draw();

	} while ( oled.nextPage() );

}

void draw() {

	byte lineOffset = 0;
	byte lineHeight = 0;
	byte lineSeparation = 0;
	
	byte numLines = numCPU;

	byte totalLines = 1;
	while ( totalLines < numLines ) {

		totalLines <<= 1;

	}

	if ( totalLines <= ( SCREEN_Y >> 2 ) ) {
		
		lineOffset = ( SCREEN_Y >> 2 ) / totalLines;
		lineHeight = ( SCREEN_Y >> 1 ) / totalLines;
		lineSeparation = 2 * lineOffset + lineHeight;
		
	}
	else if ( totalLines <= ( SCREEN_Y >> 1 ) ) {

		lineOffset = 1;
		lineHeight = 1;
		lineSeparation = 2;

	}
	else if ( totalLines <= SCREEN_Y ) {

		lineHeight = 1;
		lineSeparation = 1;

	}

	byte y = 0;
	for ( byte i = 0; i < numLines; i ++ ) {

		byte v = cpuValues[ i ];
		
		if ( ( numLines & 1 ) && ( i == ( numLines - 1 ) ) ) {

			lineOffset *= numLines - 1;
			lineHeight *= numLines - 1;
			
			for ( byte j = 1; j <= 16; j ++ ) {
				
				oled.drawFrame( ( j << 3 ) - 1, y + lineOffset, 1, lineHeight );
				
			}

		}

		oled.drawBox( 0, y + lineOffset, v, lineHeight );
		
		y += lineSeparation;

	}

}

bool serialProtocol() {

	Serial.write( 0x00 );

	unsigned long t0 = millis();
	
	byte numBytes = 0;

	while ( numBytes == 0 ) {
		
		while ( Serial.available() == 0 ) { if ( millis() - t0 > 1000 ) return false; }
		
		byte b = Serial.read();
		
		if ( b & 128 ) {
			
			numBytes = b & 0x7F;
			
		}

	}
	
	numCPU = numBytes;
	
	// TODO parse protocol here
	
	if ( numCPU > MAX_CPUS ) numCPU = MAX_CPUS;

	byte numBytesRead = 0;

	t0 = millis();

	while ( numBytesRead < numBytes ) {
		
		while ( Serial.available() == 0 ) { if ( millis() - t0 > 1000 ) return false; }

		byte b = Serial.read();
		
		if ( b & 128 ) return false;
		
		cpuValues[ numBytesRead ++ ] = b;

	}

	return true;

}

